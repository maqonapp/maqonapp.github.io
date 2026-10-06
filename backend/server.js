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
const HUBSPOT_BASE = 'https://api.hubapi.com';
const HUBSPOT_API_VERSION = '2026-03';

const metaRequired = ['MAQON_ADMIN_TOKEN','TOKEN_ENCRYPTION_KEY','META_APP_ID','META_APP_SECRET','META_REDIRECT_URI','META_WEBHOOK_VERIFY_TOKEN'];
const waRequired = ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_WABA_ID','WHATSAPP_WEBHOOK_VERIFY_TOKEN'];
const missing = list => list.filter(k=>!process.env[k]);
const aiConfigured = () => !!process.env.OPENAI_API_KEY;
const hubspotConfigured = () => !!process.env.HUBSPOT_SERVICE_KEY;
const waConfigured = () => missing(waRequired).length === 0 && !!String(process.env.WHATSAPP_APP_SECRET||process.env.META_APP_SECRET||'');
const metaConfigured = () => missing(metaRequired).length === 0;

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
function defaultStore(){return {pages:[],selected_page_id:'',leads:[],webhook_subscribed:false,last_sync_at:null,whatsapp_leads:[],whatsapp_conversations:{},whatsapp_message_ids:[],whatsapp_ai_enabled:String(process.env.WHATSAPP_AI_ENABLED||'false').toLowerCase()==='true'};}
function readStore(){
 try{
  const env=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
  const d=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(env.iv,'base64'));
  d.setAuthTag(Buffer.from(env.tag,'base64'));
  const plain=Buffer.concat([d.update(Buffer.from(env.data,'base64')),d.final()]).toString('utf8');
  return {...defaultStore(),...JSON.parse(plain)};
 }catch(e){return defaultStore();}
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
 if(!r.ok || data.error)throw new Error(data.error?.message||`HTTP ${r.status}`);return data;
}

function compactProps(obj={}){return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()!==''));}
function splitName(name=''){
 const parts=String(name).trim().split(/\s+/).filter(Boolean);return {firstname:parts[0]||'',lastname:parts.slice(1).join(' ')};
}
async function hubspotRequest(pathname,options={}){
 if(!hubspotConfigured())throw new Error('HUBSPOT_SERVICE_KEY não configurada.');
 const url=new URL(`${HUBSPOT_BASE}${pathname.startsWith('/')?pathname:`/${pathname}`}`);
 const init={method:options.method||'GET',headers:{'Authorization':`Bearer ${process.env.HUBSPOT_SERVICE_KEY}`,'Accept':'application/json'}};
 if(options.body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(options.body);}
 return fetchJson(url,init);
}
async function hubspotSearch(objectType,propertyName,value,properties=[]){
 if(!String(value||'').trim())return null;
 const data=await hubspotRequest(`/crm/v3/objects/${encodeURIComponent(objectType)}/search`,{method:'POST',body:{filterGroups:[{filters:[{propertyName,operator:'EQ',value:String(value)}]}],properties,limit:1,after:'0',sorts:[]}});
 return data?.results?.[0]||null;
}
async function hubspotCreate(objectType,properties){
 return hubspotRequest(`/crm/objects/${HUBSPOT_API_VERSION}/${encodeURIComponent(objectType)}`,{method:'POST',body:{properties:compactProps(properties)}});
}
async function hubspotUpdate(objectType,id,properties){
 return hubspotRequest(`/crm/objects/${HUBSPOT_API_VERSION}/${encodeURIComponent(objectType)}/${encodeURIComponent(id)}`,{method:'PATCH',body:{properties:compactProps(properties)}});
}
async function hubspotUpsertContact(lead={}){
 const name=splitName(lead.nome||lead.name||'');
 const props=compactProps({email:lead.email,firstname:name.firstname,lastname:name.lastname,phone:lead.whatsapp||lead.phone||lead.telefone,city:lead.cidade||lead.city,state:lead.estado||lead.uf||lead.state});
 let existing=null;
 if(props.email)existing=await hubspotSearch('contacts','email',props.email,['email','firstname','lastname','phone','city','state']);
 if(!existing && props.phone)existing=await hubspotSearch('contacts','phone',props.phone,['email','firstname','lastname','phone','city','state']);
 if(existing)return {record:await hubspotUpdate('contacts',existing.id,props),created:false};
 return {record:await hubspotCreate('contacts',props),created:true};
}
async function hubspotUpsertCompany(lead={}){
 const name=String(lead.empresa||lead.company||'').trim();if(!name)return null;
 const domain=String(lead.dominio||lead.domain||'').trim();
 const props=compactProps({name,domain,city:lead.cidade||lead.city,state:lead.estado||lead.uf||lead.state,phone:lead.telefone_empresa||lead.company_phone});
 let existing=null;
 if(domain)existing=await hubspotSearch('companies','domain',domain,['name','domain','city','state','phone']);
 if(!existing)existing=await hubspotSearch('companies','name',name,['name','domain','city','state','phone']);
 if(existing)return {record:await hubspotUpdate('companies',existing.id,props),created:false};
 return {record:await hubspotCreate('companies',props),created:true};
}
async function hubspotSyncLead(lead={}){
 const contact=await hubspotUpsertContact(lead);
 const company=await hubspotUpsertCompany(lead);
 return {contact,company,deal:{ready:true,synced:false,reason:'Negócios serão ativados após validar o pipeline/etapa do portal MAQON para evitar registros incorretos.'}};
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

function waAppSecret(){return String(process.env.WHATSAPP_APP_SECRET||process.env.META_APP_SECRET||'');}
function normalizeWa(v=''){return String(v).replace(/\D/g,'');}
function nowIso(){return new Date().toISOString();}
function trimArray(a,max){return Array.isArray(a)?a.slice(-max):[];}
function detectIntent(text=''){
 const t=String(text).toLowerCase();
 if(/\b(humano|atendente|pessoa|consultor|falar com algu[eé]m|representante)\b/.test(t))return 'handoff';
 if(/\b(compra|comprar|aquisi[cç][aã]o)\b/.test(t))return 'compra';
 if(/\b(loc[aç][aã]o|alugar|aluguel)\b/.test(t))return 'locacao';
 if(/\b(custo.?hora|custo por hora)\b/.test(t))return 'custo_hora';
 if(/\b(manuten[cç][aã]o|preventiva|corretiva|preditiva)\b/.test(t))return 'manutencao';
 if(/\b(an[aá]lise|comparativo|comparar|produtividade|desempenho)\b/.test(t))return 'analise';
 return 'geral';
}
function upsertWhatsAppLead(store,{waId,name,text,intent}){
 store.whatsapp_leads=Array.isArray(store.whatsapp_leads)?store.whatsapp_leads:[];
 let lead=store.whatsapp_leads.find(x=>x.wa_id===waId);
 const now=nowIso();
 if(!lead){
  lead={id:`WA-${waId}`,wa_id:waId,nome:name||'Contato WhatsApp',whatsapp:waId,empresa:'',email:'',cidade:'',estado:'',tipoEquipamento:'',marcaModelo:'',compraLocacao:'Consultoria',orcamento:'',objetivo:'Atendimento recebido pelo WhatsApp Business.',observacoes:'',responsavel:'Equipe Comercial',origem:'WhatsApp',status:'Novo Lead',criadoEm:now,atualizadoEm:now,ultimaMensagem:text||'',intent:intent||'geral',handoff:false};
  store.whatsapp_leads.unshift(lead);
 }else{
  if(name)lead.nome=name;lead.ultimaMensagem=text||lead.ultimaMensagem;lead.intent=intent||lead.intent;lead.atualizadoEm=now;
 }
 return lead;
}
function conversationFor(store,waId,name=''){
 store.whatsapp_conversations=store.whatsapp_conversations||{};
 const c=store.whatsapp_conversations[waId]||{wa_id:waId,name:name||'Contato WhatsApp',messages:[],handoff:false,created_at:nowIso(),updated_at:nowIso()};
 if(name)c.name=name;c.updated_at=nowIso();store.whatsapp_conversations[waId]=c;return c;
}
function addConversationMessage(c,role,text,id=''){
 c.messages=trimArray([...(c.messages||[]),{role,text:String(text||'').slice(0,4000),id,at:nowIso()}],30);c.updated_at=nowIso();
}
function alreadyProcessed(store,id){
 if(!id)return false;store.whatsapp_message_ids=Array.isArray(store.whatsapp_message_ids)?store.whatsapp_message_ids:[];
 if(store.whatsapp_message_ids.includes(id))return true;
 store.whatsapp_message_ids=trimArray([...store.whatsapp_message_ids,id],500);return false;
}
async function sendWhatsAppText(to,body){
 if(!waConfigured())throw new Error('WhatsApp Cloud API ainda não está configurada.');
 const u=`${GRAPH_BASE}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`;
 return fetchJson(u,{method:'POST',headers:{'Authorization':`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:normalizeWa(to),type:'text',text:{preview_url:false,body:String(body).slice(0,4096)}})});
}
function aiInstructions(){return `Você é o Assistente Virtual MAQON, atendimento comercial inicial de uma consultoria brasileira especializada em máquinas e equipamentos pesados.
Objetivo: atender de forma breve, profissional e útil; entender a necessidade; qualificar o lead; e encaminhar para análise humana quando necessário.
Serviços MAQON: compra e locação; comparativos de equipamentos; análise técnica; custo/hora; produtividade e desempenho; manutenção preventiva, corretiva e preditiva; apoio à decisão para máquinas pesadas, linha amarela, caminhões, muncks e guindastes.
Regras obrigatórias:
- Responda em português do Brasil, salvo se o cliente usar outro idioma.
- Na primeira resposta, identifique-se de forma natural como Assistente Virtual MAQON.
- Faça no máximo 1 ou 2 perguntas por mensagem.
- Priorize coletar: nome/empresa, equipamento, marca/modelo se houver, cidade/UF, objetivo (compra, locação, análise, manutenção), prazo e orçamento/faixa apenas quando fizer sentido.
- Nunca invente preço, disponibilidade, especificação técnica, prazo, condição comercial ou promessa. Quando faltar dado, diga que a equipe técnica/comercial validará.
- Não feche proposta nem contrato automaticamente.
- Se o cliente pedir humano/consultor/atendente, informe que o atendimento será encaminhado e não continue tentando vender.
- Se houver emergência de segurança, acidente ou risco operacional, oriente a interromper a operação e procurar o responsável técnico/local; não ofereça instruções perigosas.
- Seja conciso: normalmente 2 a 5 linhas.
- Não solicite documentos pessoais sensíveis, senhas, códigos ou dados bancários.
- Finalize com uma pergunta útil quando ainda faltar qualificação.`;}
function responseText(data){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 for(const item of data?.output||[]){for(const c of item?.content||[]){if((c.type==='output_text'||c.type==='text')&&c.text)return String(c.text).trim();}}
 return '';
}
async function generateAiReply(conversation,message){
 if(!aiConfigured())throw new Error('OPENAI_API_KEY não configurada.');
 const history=(conversation?.messages||[]).slice(-10).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.text}));
 if(!history.length || history[history.length-1]?.content!==message)history.push({role:'user',content:message});
 const payload={model:process.env.OPENAI_MODEL||'gpt-6-luna',instructions:aiInstructions(),input:history,max_output_tokens:Number(process.env.OPENAI_MAX_OUTPUT_TOKENS||350)};
 const data=await fetchJson('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const out=responseText(data);if(!out)throw new Error('A IA não retornou texto.');return out;
}
async function processWhatsAppPayload(payload){
 if(payload.object!=='whatsapp_business_account')return;
 const store=readStore();
 for(const entry of payload.entry||[]){
  for(const change of entry.changes||[]){
   if(change.field!=='messages')continue;
   const value=change.value||{};const contacts=new Map((value.contacts||[]).map(c=>[normalizeWa(c.wa_id),c.profile?.name||'']));
   for(const m of value.messages||[]){
    if(alreadyProcessed(store,m.id))continue;
    const waId=normalizeWa(m.from);if(!waId)continue;
    const name=contacts.get(waId)||'';
    const text=m.type==='text'?String(m.text?.body||'').trim():`[${m.type||'mensagem'} recebido]`;
    const intent=detectIntent(text);const lead=upsertWhatsAppLead(store,{waId,name,text,intent});const c=conversationFor(store,waId,name);
    addConversationMessage(c,'user',text,m.id||'');
    if(intent==='handoff'){
      c.handoff=true;lead.handoff=true;lead.status='Em Atendimento';
      const reply='Claro. Vou deixar seu atendimento sinalizado para um consultor da MAQON continuar por aqui.';
      if(waConfigured()){try{await sendWhatsAppText(waId,reply);addConversationMessage(c,'assistant',reply);}catch(e){c.last_error='Falha ao enviar encaminhamento.';}}
      continue;
    }
    if(m.type!=='text'){
      if(store.whatsapp_ai_enabled && waConfigured()){
       const reply='Recebi seu arquivo. Para eu direcionar melhor, descreva em uma frase o que você precisa analisar ou envie o nome do equipamento.';
       try{await sendWhatsAppText(waId,reply);addConversationMessage(c,'assistant',reply);}catch(e){c.last_error='Falha ao responder mídia.';}
      }
      continue;
    }
    if(!store.whatsapp_ai_enabled || c.handoff)continue;
    try{
      const reply=await generateAiReply(c,text);
      await sendWhatsAppText(waId,reply);addConversationMessage(c,'assistant',reply);c.last_error='';lead.ultimaRespostaIA=reply;lead.atualizadoEm=nowIso();
    }catch(e){c.last_error=String(e.message||'Falha na automação').slice(0,180);}
   }
  }
 }
 writeStore(store);
}

app.get('/health',(req,res)=>res.json({ok:true,service:'MAQON Integrations + WhatsApp AI + HubSpot CRM',graph_version:GRAPH_VERSION,hubspot_api_version:HUBSPOT_API_VERSION,meta_configured:metaConfigured(),whatsapp_configured:waConfigured(),openai_configured:aiConfigured(),hubspot_configured:hubspotConfigured()}));

// Webhook Meta Lead Ads
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
  for(const entry of payload.entry||[]){for(const ch of entry.changes||[]){if(ch.field!=='leadgen'||!ch.value?.leadgen_id)continue;const page=store.pages.find(p=>String(p.id)===String(ch.value.page_id||entry.id));if(!page)continue;try{const lead=await fetchLead(ch.value.leadgen_id,page.access_token,{form_id:ch.value.form_id||'',ad_id:ch.value.ad_id||'',page_id:page.id,page_name:page.name||''});upsertLead(store,lead);}catch(e){}}}
  writeStore(store);
 })().catch(()=>{});
});

// Webhook WhatsApp Cloud API + IA MAQON
app.get('/api/whatsapp/webhook',(req,res)=>{
 if(req.query['hub.mode']==='subscribe' && safeEqual(req.query['hub.verify_token'],process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)) return res.status(200).send(String(req.query['hub.challenge']||''));
 res.sendStatus(403);
});
app.post('/api/whatsapp/webhook',express.raw({type:'application/json'}),(req,res)=>{
 const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from('');const secret=waAppSecret();
 if(!secret)return res.status(503).send('App Secret não configurado');
 const sig=String(req.headers['x-hub-signature-256']||'');const expected='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');if(!sig||!safeEqual(sig,expected))return res.sendStatus(403);
 let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch(e){return res.sendStatus(400)}
 res.status(200).send('EVENT_RECEIVED');processWhatsAppPayload(payload).catch(()=>{});
});

app.use(express.json({limit:'256kb'}));

app.post('/api/meta/connect-url',requireAdmin,(req,res)=>{
 const miss=missing(metaRequired);if(miss.length)return res.status(503).json({error:`Backend Meta incompleto: ${miss.join(', ')}`});
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
  store.webhook_subscribed=false;store.connected_at=nowIso();writeStore(store);
  if(store.selected_page_id){try{await subscribeSelectedPage(store)}catch(e){store.webhook_subscribed=false;store.webhook_error=e.message;writeStore(store);}}
  redirect.searchParams.set('meta','connected');
 }catch(e){redirect.searchParams.set('meta','error');redirect.searchParams.set('meta_error',String(e.message||'Falha OAuth').slice(0,180));}
 res.redirect(302,redirect.toString());
});

app.get('/api/meta/status',requireAdmin,(req,res)=>{
 const store=readStore(),pages=(store.pages||[]).map(publicPage),selected=(store.pages||[]).find(p=>String(p.id)===String(store.selected_page_id));
 res.json({configured:metaConfigured(),connected:!!(store.user_access_token&&store.pages?.length),graph_version:GRAPH_VERSION,pages,selected_page:publicPage(selected),webhook_subscribed:!!store.webhook_subscribed,webhook_error:store.webhook_error||'',last_sync_at:store.last_sync_at||null});
});
app.post('/api/meta/select-page',requireAdmin,async(req,res)=>{
 try{const store=readStore();const page=store.pages.find(p=>String(p.id)===String(req.body?.page_id));if(!page)return res.status(404).json({error:'Página não encontrada entre as autorizadas.'});store.selected_page_id=page.id;store.webhook_subscribed=false;writeStore(store);let subscribed=false;try{subscribed=await subscribeSelectedPage(store)}catch(e){store.webhook_error=e.message;writeStore(store);}res.json({ok:true,page:publicPage(page),webhook_subscribed:subscribed,webhook_error:store.webhook_error||''});}catch(e){res.status(400).json({error:e.message});}
});
app.post('/api/meta/sync',requireAdmin,async(req,res)=>{try{const store=readStore();const out=await syncLeads(store);res.json({ok:true,...out,last_sync_at:store.last_sync_at});}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/meta/leads',requireAdmin,(req,res)=>{const store=readStore();res.json({leads:(store.leads||[]).map(l=>({id:l.id,created_time:l.created_time||'',ad_id:l.ad_id||'',form_id:l.form_id||'',form_name:l.form_name||'',page_id:l.page_id||'',page_name:l.page_name||'',field_data:l.field_data||[]})),last_sync_at:store.last_sync_at||null});});

app.get('/api/whatsapp/status',requireAdmin,(req,res)=>{
 const store=readStore();
 const conversations=Object.values(store.whatsapp_conversations||{});
 res.json({cloud_configured:waConfigured(),openai_configured:aiConfigured(),ai_enabled:!!store.whatsapp_ai_enabled,phone_number_id_configured:!!process.env.WHATSAPP_PHONE_NUMBER_ID,waba_id_configured:!!process.env.WHATSAPP_WABA_ID,model:process.env.OPENAI_MODEL||'gpt-6-luna',leads:(store.whatsapp_leads||[]).length,conversations:conversations.length,handoffs:conversations.filter(c=>c.handoff).length});
});
app.post('/api/whatsapp/automation',requireAdmin,(req,res)=>{
 const store=readStore();const enabled=!!req.body?.enabled;
 if(enabled && !aiConfigured())return res.status(400).json({error:'Configure OPENAI_API_KEY antes de ativar a IA.'});
 if(enabled && !waConfigured())return res.status(400).json({error:'Configure a WhatsApp Cloud API antes de ativar respostas automáticas.'});
 store.whatsapp_ai_enabled=enabled;writeStore(store);res.json({ok:true,ai_enabled:enabled});
});
app.post('/api/ai/preview',requireAdmin,async(req,res)=>{
 try{const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({error:'Digite uma mensagem para testar.'});const reply=await generateAiReply({messages:[]},message);res.json({ok:true,reply,model:process.env.OPENAI_MODEL||'gpt-6-luna'});}catch(e){res.status(400).json({error:String(e.message||e)});}
});
app.get('/api/whatsapp/leads',requireAdmin,(req,res)=>{
 const store=readStore();res.json({leads:(store.whatsapp_leads||[]).map(l=>({...l,observacoes:l.observacoes||''}))});
});
app.get('/api/whatsapp/conversations',requireAdmin,(req,res)=>{
 const store=readStore();const limit=Math.min(50,Math.max(1,Number(req.query.limit||10)));
 const items=Object.values(store.whatsapp_conversations||{}).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,limit).map(c=>({wa_id:c.wa_id,name:c.name||'',handoff:!!c.handoff,updated_at:c.updated_at||'',last_error:c.last_error||'',last_message:(c.messages||[]).slice(-1)[0]||null,messages_count:(c.messages||[]).length}));
 res.json({conversations:items});
});
app.post('/api/whatsapp/handoff',requireAdmin,(req,res)=>{
 const waId=normalizeWa(req.body?.wa_id);const store=readStore();const c=(store.whatsapp_conversations||{})[waId];if(!c)return res.status(404).json({error:'Conversa não encontrada.'});c.handoff=!!req.body?.handoff;const lead=(store.whatsapp_leads||[]).find(x=>x.wa_id===waId);if(lead)lead.handoff=c.handoff;writeStore(store);res.json({ok:true,handoff:c.handoff});
});

// HubSpot CRM — Service Key MAQON
app.get('/api/hubspot/status',requireAdmin,async(req,res)=>{
 if(!hubspotConfigured())return res.json({configured:false,connected:false,api_version:HUBSPOT_API_VERSION});
 try{
  const data=await hubspotRequest(`/crm/objects/${HUBSPOT_API_VERSION}/contacts?limit=1&properties=email,firstname,lastname`);
  res.json({configured:true,connected:true,api_version:HUBSPOT_API_VERSION,sample_count:Array.isArray(data.results)?data.results.length:0});
 }catch(e){res.status(400).json({configured:true,connected:false,api_version:HUBSPOT_API_VERSION,error:String(e.message||e)});}
});
app.post('/api/hubspot/sync-lead',requireAdmin,async(req,res)=>{
 try{
  const lead=req.body?.lead||req.body||{};
  if(!lead || typeof lead!=='object')return res.status(400).json({error:'Lead inválido.'});
  if(!String(lead.email||lead.whatsapp||lead.phone||lead.telefone||'').trim())return res.status(400).json({error:'Informe pelo menos e-mail ou telefone do lead.'});
  const out=await hubspotSyncLead(lead);
  res.json({ok:true,...out,synced_at:nowIso()});
 }catch(e){res.status(400).json({error:String(e.message||e)});}
});
app.post('/api/hubspot/sync-whatsapp-leads',requireAdmin,async(req,res)=>{
 try{
  const store=readStore();const leads=Array.isArray(store.whatsapp_leads)?store.whatsapp_leads:[];
  const results=[];
  for(const lead of leads.slice(0,100)){
   try{results.push({id:lead.id,ok:true,...await hubspotSyncLead(lead)});}catch(e){results.push({id:lead.id,ok:false,error:String(e.message||e)});}
  }
  res.json({ok:true,total:leads.length,processed:results.length,succeeded:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results});
 }catch(e){res.status(400).json({error:String(e.message||e)});}
});

app.use((err,req,res,next)=>{if(err?.message==='Origem não autorizada')return res.status(403).json({error:err.message});res.status(500).json({error:'Erro interno no backend MAQON.'});});

app.listen(PORT,()=>{console.log(`MAQON backend ativo na porta ${PORT} (${GRAPH_VERSION}).`);if(!metaConfigured())console.warn('Meta incompleta:',missing(metaRequired).join(', '));if(!waConfigured())console.warn('WhatsApp incompleto:',missing(waRequired).join(', '));if(!aiConfigured())console.warn('IA incompleta: OPENAI_API_KEY ausente.');if(!hubspotConfigured())console.warn('HubSpot incompleto: HUBSPOT_SERVICE_KEY ausente.');else console.log(`HubSpot CRM configurado (${HUBSPOT_API_VERSION}).`);});
