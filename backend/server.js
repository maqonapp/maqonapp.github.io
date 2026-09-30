'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const FRONTEND_ORIGINS = String(process.env.FRONTEND_URL || '').split(',').map(s=>s.trim()).filter(Boolean);
const DATA_FILE = path.resolve(process.env.DATA_FILE || './data/meta-store.enc');

const required = ['MAQON_ADMIN_TOKEN','TOKEN_ENCRYPTION_KEY','META_APP_ID','META_APP_SECRET','META_REDIRECT_URI','META_WEBHOOK_VERIFY_TOKEN'];
const missing = () => required.filter(k=>!process.env[k]);

app.disable('x-powered-by');
app.use(cors({origin(origin,cb){if(!origin || FRONTEND_ORIGINS.includes(origin)) return cb(null,true);cb(new Error('Origem não autorizada'));},methods:['GET','POST','OPTIONS'],allowedHeaders:['Content-Type','Authorization']}));

function safeEqual(a,b){
 const aa=Buffer.from(String(a||'')), bb=Buffer.from(String(b||''));
 return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function requireAdmin(req,res,next){
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!process.env.MAQON_ADMIN_TOKEN || !safeEqual(token,process.env.MAQON_ADMIN_TOKEN)) return res.status(401).json({error:'Não autorizado.'});
 next();
}
function encryptionKey(){return crypto.createHash('sha256').update(String(process.env.TOKEN_ENCRYPTION_KEY||'')).digest();}
function ensureDir(){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});}
function readStore(){
 try{
  const env=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
  const d=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(env.iv,'base64'));
  d.setAuthTag(Buffer.from(env.tag,'base64'));
  const plain=Buffer.concat([d.update(Buffer.from(env.data,'base64')),d.final()]).toString('utf8');
  return JSON.parse(plain);
 }catch(e){return {pages:[],selected_page_id:'',leads:[],webhook_subscribed:false,last_sync_at:null};}
}
function writeStore(store){
 ensureDir();
 const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(store),'utf8'),cipher.final()]);
 const env={iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
 fs.writeFileSync(DATA_FILE,JSON.stringify(env),{mode:0o600});
}
function publicPage(p){return p?{id:p.id,name:p.name,instagram:p.instagram||null}:null;}
function returnAllowed(url){
 try{const u=new URL(url);return FRONTEND_ORIGINS.some(o=>{const x=new URL(o);return u.origin===x.origin;});}catch(e){return false;}
}
function stateSecret(){return String(process.env.OAUTH_STATE_SECRET||process.env.META_APP_SECRET||'');}
function signState(payload){
 const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
 const sig=crypto.createHmac('sha256',stateSecret()).update(body).digest('base64url');
 return `${body}.${sig}`;
}
function verifyState(value){
 const [body,sig]=String(value||'').split('.');if(!body||!sig)throw new Error('state inválido');
 const expected=crypto.createHmac('sha256',stateSecret()).update(body).digest('base64url');
 if(!safeEqual(sig,expected))throw new Error('state inválido');
 const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
 if(!p.exp || Date.now()>p.exp)throw new Error('state expirado');return p;
}
async function fetchJson(url,options={}){
 const r=await fetch(url,options);let data={};try{data=await r.json()}catch(e){}
 if(!r.ok || data.error)throw new Error(data.error?.message||`Meta API HTTP ${r.status}`);return data;
}
async function graph(pathname,token,options={}){
 const u=new URL(`${GRAPH_BASE}/${String(pathname).replace(/^\//,'')}`);if(token)u.searchParams.set('access_token',token);
 if(options.params)Object.entries(options.params).forEach(([k,v])=>v!==undefined&&v!==null&&u.searchParams.set(k,String(v)));
 const init={method:options.method||'GET',headers:{'Accept':'application/json'}};
 if(options.body){init.headers['Content-Type']='application/x-www-form-urlencoded';init.body=new URLSearchParams(options.body).toString();}
 return fetchJson(u,init);
}
async function graphAll(pathname,token,params={}){
 let u=new URL(`${GRAPH_BASE}/${String(pathname).replace(/^\//,'')}`);u.searchParams.set('access_token',token);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 const all=[];let guard=0;
 while(u && guard++<20){const d=await fetchJson(u);all.push(...(d.data||[]));u=d.paging?.next?new URL(d.paging.next):null;}
 return all;
}
async function subscribeSelectedPage(store){
 const page=store.pages.find(p=>String(p.id)===String(store.selected_page_id));if(!page)throw new Error('Página Meta não selecionada.');
 await graph(`${page.id}/subscribed_apps`,page.access_token,{method:'POST',body:{subscribed_fields:'leadgen'}});
 store.webhook_subscribed=true;store.webhook_error='';writeStore(store);return true;
}
function upsertLead(store,lead){
 store.leads=Array.isArray(store.leads)?store.leads:[];
 const i=store.leads.findIndex(x=>String(x.id)===String(lead.id));
 if(i>=0)store.leads[i]={...store.leads[i],...lead};else store.leads.unshift(lead);
}
async function fetchLead(leadId,pageToken,extra={}){
 const d=await graph(leadId,pageToken,{params:{fields:'id,created_time,ad_id,form_id,field_data'}});return {...d,...extra};
}
async function syncLeads(store){
 const page=store.pages.find(p=>String(p.id)===String(store.selected_page_id));if(!page)throw new Error('Selecione uma Página Meta antes da sincronização.');
 const forms=await graphAll(`${page.id}/leadgen_forms`,page.access_token,{fields:'id,name,status',limit:100});
 let total=0;
 for(const form of forms){
  const leads=await graphAll(`${form.id}/leads`,page.access_token,{fields:'id,created_time,ad_id,form_id,field_data',limit:100});
  for(const lead of leads){upsertLead(store,{...lead,form_name:form.name||'',page_id:page.id,page_name:page.name||''});total++;}
 }
 store.last_sync_at=new Date().toISOString();writeStore(store);return {forms:forms.length,total};
}

app.get('/health',(req,res)=>res.json({ok:true,service:'MAQON Meta Integration',graph_version:GRAPH_VERSION,configured:missing().length===0}));

// O webhook precisa do corpo bruto para validar X-Hub-Signature-256.
app.get('/api/meta/webhook',(req,res)=>{
 if(req.query['hub.mode']==='subscribe' && safeEqual(req.query['hub.verify_token'],process.env.META_WEBHOOK_VERIFY_TOKEN)) return res.status(200).send(String(req.query['hub.challenge']||''));
 res.sendStatus(403);
});
app.post('/api/meta/webhook',express.raw({type:'application/json'}),(req,res)=>{
 const sig=String(req.headers['x-hub-signature-256']||'');const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from('');
 const expected='sha256='+crypto.createHmac('sha256',String(process.env.META_APP_SECRET||'')).update(raw).digest('hex');
 if(!sig || !safeEqual(sig,expected))return res.sendStatus(403);
 let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch(e){return res.sendStatus(400)}
 res.status(200).send('EVENT_RECEIVED');
 (async()=>{
  if(payload.object!=='page')return;const store=readStore();
  for(const entry of payload.entry||[]){for(const ch of entry.changes||[]){if(ch.field!=='leadgen'||!ch.value?.leadgen_id)continue;const page=store.pages.find(p=>String(p.id)===String(ch.value.page_id||entry.id));if(!page)continue;try{const lead=await fetchLead(ch.value.leadgen_id,page.access_token,{form_id:ch.value.form_id||'',ad_id:ch.value.ad_id||'',page_id:page.id,page_name:page.name||''});upsertLead(store,lead);}catch(e){/* não registrar PII nem tokens */}}}
  writeStore(store);
 })().catch(()=>{});
});

app.use(express.json({limit:'256kb'}));

app.post('/api/meta/connect-url',requireAdmin,(req,res)=>{
 const miss=missing();if(miss.length)return res.status(503).json({error:`Backend incompleto: ${miss.join(', ')}`});
 const return_to=returnAllowed(req.body?.return_to)?req.body.return_to:FRONTEND_ORIGINS[0];if(!return_to)return res.status(400).json({error:'FRONTEND_URL não configurada.'});
 const state=signState({exp:Date.now()+10*60*1000,return_to,nonce:crypto.randomBytes(16).toString('hex')});
 const u=new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
 u.searchParams.set('client_id',process.env.META_APP_ID);u.searchParams.set('redirect_uri',process.env.META_REDIRECT_URI);u.searchParams.set('state',state);u.searchParams.set('response_type','code');
 if(process.env.META_CONFIG_ID){u.searchParams.set('config_id',process.env.META_CONFIG_ID);u.searchParams.set('override_default_response_type','true');}
 else u.searchParams.set('scope',process.env.META_SCOPES||'pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval,instagram_basic');
 res.json({url:u.toString()});
});

app.get('/api/meta/callback',async(req,res)=>{
 let st;try{st=verifyState(req.query.state);}catch(e){return res.status(400).send('Falha de segurança no retorno OAuth.');}
 const redirect=new URL(st.return_to);try{
  if(req.query.error)throw new Error(String(req.query.error_description||req.query.error));
  if(!req.query.code)throw new Error('Código OAuth ausente.');
  const tokenData=await fetchJson(new URL(`${GRAPH_BASE}/oauth/access_token?client_id=${encodeURIComponent(process.env.META_APP_ID)}&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI)}&client_secret=${encodeURIComponent(process.env.META_APP_SECRET)}&code=${encodeURIComponent(req.query.code)}`));
  let userToken=tokenData.access_token;
  try{const long=await graph('oauth/access_token',null,{params:{grant_type:'fb_exchange_token',client_id:process.env.META_APP_ID,client_secret:process.env.META_APP_SECRET,fb_exchange_token:userToken}});if(long.access_token)userToken=long.access_token;}catch(e){}
  const pages=await graphAll('me/accounts',userToken,{fields:'id,name,access_token,instagram_business_account{id,username,profile_picture_url}',limit:100});
  const store=readStore();store.user_access_token=userToken;store.pages=pages.map(p=>({id:p.id,name:p.name,access_token:p.access_token,instagram:p.instagram_business_account||null}));
  if(!store.pages.some(p=>String(p.id)===String(store.selected_page_id)))store.selected_page_id=store.pages[0]?.id||'';
  store.webhook_subscribed=false;store.connected_at=new Date().toISOString();writeStore(store);
  if(store.selected_page_id){try{await subscribeSelectedPage(store)}catch(e){store.webhook_subscribed=false;store.webhook_error=e.message;writeStore(store);}}
  redirect.searchParams.set('meta','connected');
 }catch(e){redirect.searchParams.set('meta','error');redirect.searchParams.set('meta_error',String(e.message||'Falha OAuth').slice(0,180));}
 res.redirect(302,redirect.toString());
});

app.get('/api/meta/status',requireAdmin,(req,res)=>{
 const store=readStore(),pages=(store.pages||[]).map(publicPage),selected=(store.pages||[]).find(p=>String(p.id)===String(store.selected_page_id));
 res.json({configured:missing().length===0,connected:!!(store.user_access_token&&store.pages?.length),graph_version:GRAPH_VERSION,pages,selected_page:publicPage(selected),webhook_subscribed:!!store.webhook_subscribed,webhook_error:store.webhook_error||'',last_sync_at:store.last_sync_at||null});
});
app.post('/api/meta/select-page',requireAdmin,async(req,res)=>{
 try{const store=readStore();const page=store.pages.find(p=>String(p.id)===String(req.body?.page_id));if(!page)return res.status(404).json({error:'Página não encontrada entre as autorizadas.'});store.selected_page_id=page.id;store.webhook_subscribed=false;writeStore(store);let subscribed=false;try{subscribed=await subscribeSelectedPage(store)}catch(e){store.webhook_error=e.message;writeStore(store);}res.json({ok:true,page:publicPage(page),webhook_subscribed:subscribed,webhook_error:store.webhook_error||''});}catch(e){res.status(400).json({error:e.message});}
});
app.post('/api/meta/sync',requireAdmin,async(req,res)=>{try{const store=readStore();const out=await syncLeads(store);res.json({ok:true,...out,last_sync_at:store.last_sync_at});}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/meta/leads',requireAdmin,(req,res)=>{const store=readStore();res.json({leads:(store.leads||[]).map(l=>({id:l.id,created_time:l.created_time||'',ad_id:l.ad_id||'',form_id:l.form_id||'',form_name:l.form_name||'',page_id:l.page_id||'',page_name:l.page_name||'',field_data:l.field_data||[]})),last_sync_at:store.last_sync_at||null});});

app.use((err,req,res,next)=>{if(err?.message==='Origem não autorizada')return res.status(403).json({error:err.message});res.status(500).json({error:'Erro interno no backend MAQON.'});});

app.listen(PORT,()=>{console.log(`MAQON Meta backend ativo na porta ${PORT} (${GRAPH_VERSION}).`);if(missing().length)console.warn('Variáveis ausentes:',missing().join(', '));});
