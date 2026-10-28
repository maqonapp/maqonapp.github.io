'use strict';
// Camada de permissão manual separada da homologação Mercado Pago.
const crypto=require('crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plans=new Set(['plataforma_premium']);
const safeEq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
module.exports=function registerMaqonAccess(app){
 const configured=()=>!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
 function root(){const u=new URL(process.env.SUPABASE_URL);if(u.protocol!=='https:'||!/\.supabase\.co$/.test(u.hostname))throw Error('Configuração Supabase inválida');return u.origin;}
 async function api(path,options={}){
  const headers={'apikey':process.env.SUPABASE_SERVICE_ROLE_KEY,'Authorization':`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Accept':'application/json'};
  if(options.body){headers['Content-Type']='application/json';headers['Prefer']='return=representation,resolution=merge-duplicates';}
  const r=await fetch(root()+'/rest/v1/'+path,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(8000)});
  const obj=await r.json().catch(()=>null);if(!r.ok)throw Error('Supabase REST HTTP '+r.status);return obj;
 }
 async function identity(req){
  const match=/^Bearer\s+(.+)$/i.exec(req.get('authorization')||'');if(!match)return null;
  const response=await fetch(root()+'/auth/v1/user',{headers:{'apikey':process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+match[1]},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return null;const user=await response.json();return uuid.test(user.id||'')?user:null;
 }
 function locked(res){res.set('Cache-Control','no-store');return res.status(503).json({ok:false,error:'Acesso comercial ainda não habilitado.'});}
 // Não há acesso ao dashboard por aqui: fornece decisão para operações sensíveis no backend.
 app.get('/api/maqon/acesso/status',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(process.env.MAQON_ACCESS_FEATURE_ENABLED!=='true'||!configured())return locked(res);
  try{
   const user=await identity(req);if(!user)return res.status(401).json({ok:false,error:'Sessão inválida.'});
   const memberships=await api('maqon_usuarios?select=empresa_id&usuario_id=eq.'+encodeURIComponent(user.id));
   if(!Array.isArray(memberships)||memberships.length!==1||!uuid.test(memberships[0].empresa_id))return res.status(403).json({ok:false,error:'Vínculo empresarial não autorizado.'});
   const cid=memberships[0].empresa_id;
   const entries=await api('maqon_acessos_comerciais?select=plano,ativo,expira_em&empresa_id=eq.'+encodeURIComponent(cid)+'&plano=eq.plataforma_premium&limit=1');
   const e=entries?.[0];const granted=Boolean(e?.ativo&&(!e.expira_em||Date.parse(e.expira_em)>Date.now()));
   return res.json({ok:true,empresa_id:cid,access_granted:granted,plan:granted?'plataforma_premium':null});
  }catch(err){console.error('[MAQON acesso] Falha de verificação',err.message);return res.status(503).json({ok:false,error:'Verificação indisponível.'});}
 });
 function admin(req,res,next){const secret=process.env.MAQON_ACCESS_ADMIN_TOKEN;
  if(!secret||!safeEq(req.get('x-maqon-access-admin'),secret))return res.status(401).json({ok:false,error:'Não autorizado.'});next();}
 app.post('/api/maqon/acesso/administrar',admin,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(process.env.MAQON_ACCESS_ADMIN_ENABLED!=='true'||!configured())return locked(res);
  const {empresa_id,plano,ativo,referencia_manual,expira_em}=req.body||{};
  if(!uuid.test(empresa_id||'')||!plans.has(plano)||typeof ativo!=='boolean'||typeof referencia_manual!=='string'||referencia_manual.trim().length<8||referencia_manual.length>160|| (expira_em!==null&&expira_em!==undefined&&(!Number.isFinite(Date.parse(expira_em)))))return res.status(400).json({ok:false,error:'Dados inválidos.'});
  try{
   const companies=await api('maqon_empresas?select=id&id=eq.'+encodeURIComponent(empresa_id));if(companies.length!==1)return res.status(404).json({ok:false,error:'Empresa inexistente.'});
   const previous=await api('maqon_acessos_comerciais?select=empresa_id,plano,ativo,expira_em&empresa_id=eq.'+encodeURIComponent(empresa_id)+'&plano=eq.'+plano);
   const before=previous?.[0]||null;
   const payload={empresa_id,plano,ativo,expira_em:ativo?(expira_em||null):null,referencia_manual:referencia_manual.trim(),atualizado_em:new Date().toISOString()};
   // Ação administrativa só após confirmação humana externa, nunca pelo webhook de teste.
   const result=await api('maqon_acessos_comerciais?on_conflict=empresa_id,plano',{method:'POST',body:payload});
   await api('maqon_acessos_auditoria',{method:'POST',body:{empresa_id,plano,acao:ativo?'conceder':'revogar',referencia_manual:payload.referencia_manual,anterior:before,posterior:result?.[0]||payload}});
   return res.json({ok:true,empresa_id,plano,ativo});
  }catch(err){console.error('[MAQON acesso] Falha administrativa',err.message);return res.status(503).json({ok:false,error:'Operação não concluída ou auditoria indisponível; conferir estado no banco antes de repetir.'});}
 });
};
