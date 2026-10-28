/* MAQON V1.6.10.1 - Evidencias privadas (apenas homologacao) */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const cfg=window.MAQON_SUPABASE_CONFIG||{};
 const notice=msg=>{$('evidence-notice').textContent=msg||'';};
 if(!window.supabase?.createClient||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||'')||!String(cfg.publishableKey||'').startsWith('sb_publishable_')){notice('Configuração pública Supabase indisponível.');return;}
 const db=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const bucket='maqon-documentos-privados-v1';
 const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
 let ctx=null, records=[], maintenances=[], cycle=0;
 const clear=()=>{cycle++;ctx=null;records=[];maintenances=[];$('evidence-form').reset();$('evidence-rows').replaceChildren();$('evidence-maintenance').replaceChildren(new Option('Selecione uma manutenção',''));notice('');};
 function sessionCheck(company,user,token){if(!ctx||ctx.company!==company||ctx.user!==user||token!==cycle)throw Error('A sessão mudou. Entre novamente.');}
 async function checkAccess(){
  const {data:ud,error:ue}=await db.auth.getUser();if(ue||!ud?.user)return null;
  const user=ud.user;
  const {data:membership,error:me}=await db.from('maqon_usuarios').select('empresa_id').eq('usuario_id',user.id);
  if(me||membership?.length!==1)throw Error('Empresa do usuário não foi validada.');
  return {user:user.id,company:membership[0].empresa_id};
 }
 async function load(){
  const token=++cycle;
  try{
   const access=await checkAccess();if(token!==cycle)return;
   if(!access){clear();return;}
   ctx=access;
   const [m,d]=await Promise.all([
    db.from('maqon_manutencoes').select('id,tipo,data_registro,atividade_ocorrencia').eq('empresa_id',access.company).order('data_registro',{ascending:false}).limit(100),
    db.from('maqon_documentos').select('id,titulo,nome_arquivo,storage_path,mime_type,prioridade,criado_em,manutencao_id').eq('empresa_id',access.company).order('criado_em',{ascending:false}).limit(100)
   ]);
   sessionCheck(access.company,access.user,token);
   if(m.error)throw m.error;if(d.error)throw d.error;
   maintenances=m.data||[];records=d.data||[];
   const sel=$('evidence-maintenance');sel.replaceChildren(new Option('Selecione uma manutenção',''));
   for(const item of maintenances){const n=(item.atividade_ocorrencia||'').slice(0,65);sel.add(new Option(`${item.data_registro} • ${item.tipo} • ${n}`,item.id));}
   render();notice(`Documentos privados carregados: ${records.length}.`);
  }catch(err){if(token===cycle){notice('Erro ao consultar evidências: '+(err.message||'falha desconhecida'));$('evidence-rows').replaceChildren();}}
 }
 function render(){
  const tbody=$('evidence-rows');tbody.replaceChildren();
  if(!records.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='Nenhum documento fictício nesta empresa.';tr.append(td);tbody.append(tr);return;}
  for(const rec of records){
   const tr=document.createElement('tr');
   for(const s of [rec.titulo,rec.nome_arquivo,rec.mime_type||'—',rec.prioridade||'—',(rec.criado_em||'').slice(0,10)]){const td=document.createElement('td');td.textContent=s||'—';tr.append(td);}
   const td=document.createElement('td'),btn=document.createElement('button');btn.type='button';btn.textContent='Baixar';btn.addEventListener('click',()=>download(rec));td.append(btn);tr.append(td);tbody.append(tr);
  }
 }
 async function download(rec){
  const company=ctx?.company,user=ctx?.user,token=cycle;if(!company){notice('Entre novamente.');return;}
  if(!rec.storage_path.startsWith(company+'/')){notice('Caminho fora da empresa atual.');return;}
  notice('Solicitando arquivo privado...');
  try{
   const {data,error}=await db.storage.from(bucket).download(rec.storage_path);if(error)throw error;
   sessionCheck(company,user,token);
   const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=rec.nome_arquivo||'arquivo';a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notice('Download solicitado.');
  }catch(err){notice('Não foi possível baixar: '+(err.message||'erro de autorização'));}
 }
 $('evidence-form').addEventListener('submit',async e=>{
  e.preventDefault();const company=ctx?.company,user=ctx?.user,token=cycle;if(!company){notice('Entre com uma conta autorizada.');return;}
  const btn=$('evidence-upload');btn.disabled=true;
  try{
   const maintenance=$('evidence-maintenance').value;
   if(!maintenances.some(x=>x.id===maintenance))throw Error('Selecione manutenção da empresa autenticada.');
   const file=$('evidence-file').files?.[0];if(!file)throw Error('Selecione um arquivo.');
   if(!allowed[file.type])throw Error('Formato não permitido.');
   if(file.size===0||file.size>10485760)throw Error('Arquivo precisa ter entre 1 byte e 10 MiB.');
   const title=$('evidence-title').value.trim();if(!title)throw Error('Informe o título da evidência.');
   const path=`${company}/${crypto.randomUUID()}.${allowed[file.type]}`;
   notice('Enviando ao Storage privado...');
   const uploaded=await db.storage.from(bucket).upload(path,file,{contentType:file.type,cacheControl:'0',upsert:false});if(uploaded.error)throw uploaded.error;
   sessionCheck(company,user,token);
   const values={empresa_id:company,manutencao_id:maintenance,titulo:title,nome_arquivo:file.name.slice(0,240),storage_path:path,mime_type:file.type,tamanho_bytes:file.size,
    sistema_conjunto:$('evidence-system').value.trim()||null,componente_item:$('evidence-component').value.trim()||null,condicao_identificada:$('evidence-condition').value.trim()||null,
    prioridade:$('evidence-priority').value||null,observacoes:$('evidence-notes').value.trim()||null};
   const {data,error}=await db.from('maqon_documentos').insert(values).select('id,empresa_id,storage_path');
   if(error||data?.length!==1||data[0].empresa_id!==company||data[0].storage_path!==path)
    throw Error('Arquivo enviado, mas o registro técnico não foi confirmado. Não reenvie; informe ao administrador para reconciliar o arquivo privado. '+(error?.message||''));
   sessionCheck(company,user,token);$('evidence-form').reset();await load();notice('Evidência fictícia salva no Storage privado e vinculada à manutenção.');
  }catch(err){notice('Falha: '+(err.message||'erro desconhecido'));}finally{btn.disabled=false;}
 });
 $('evidence-refresh').addEventListener('click',load);
 db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){clear();}else if(event==='SIGNED_IN'||event==='INITIAL_SESSION'){setTimeout(load,0);}});
 setTimeout(load,150);
})();
