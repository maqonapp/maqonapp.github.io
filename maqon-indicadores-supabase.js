/* MAQON V1.7 — dados de indicadores somente leitura, separados por empresa (RLS obrigatório). */
(async()=>{
 'use strict';
 const cfg=window.MAQON_SUPABASE_CONFIG||{};
 if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey)return;
 const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 async function load(){
   const {data:{user},error}=await db.auth.getUser();if(error||!user)return;
   const membership=await db.from('maqon_usuarios').select('empresa_id').eq('usuario_id',user.id);
   if(membership.error||membership.data?.length!==1)return;
   const company=membership.data[0].empresa_id;
   const tables=[['maqon_equipamentos','#equipmentCount'],['maqon_propostas','#fpc'],['maqon_leads','#kpiTotal'],['maqon_manutencoes','#maintenanceCount']];
   for(const [table,selector] of tables){
     const result=await db.from(table).select('id,empresa_id').eq('empresa_id',company).limit(1000);
     if(result.error||result.data?.some(x=>x.empresa_id!==company))continue;
     // Atualização de números apenas quando o seletor existe; sem sobrescrever módulos.
     const el=document.querySelector(selector);if(el)el.textContent=String(result.data?.length||0);
   }
 }
 document.addEventListener('DOMContentLoaded',()=>load().catch(()=>{}));
})();
