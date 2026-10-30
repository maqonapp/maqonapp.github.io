/* MAQON: indicadores de homologação baseados em contagem exata do Supabase.
   NÃO constitui substituição dos módulos locais, nem prova de RLS. */
(()=>{'use strict';
 const cfg=window.MAQON_SUPABASE_CONFIG||{};
 if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey)return;
 const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 let seq=0;
 async function refresh(){
   const turn=++seq;
   // Dashboard não deve exibir indicadores empresariais se seu bloqueio estiver ativo.
   if(document.documentElement.classList.contains('maqon-auth-locked'))return;
   const {data:{user},error}=await db.auth.getUser();if(error||!user)return;
   const member=await db.from('maqon_usuarios').select('empresa_id').eq('usuario_id',user.id);
   if(member.error||member.data?.length!==1||!member.data[0].empresa_id)return;
   const cid=member.data[0].empresa_id;
   const pairs=[['maqon_equipamentos','#equipmentCount'],['maqon_propostas','#fpc'],['maqon_leads','#kpiTotal'],['maqon_manutencoes','#maintenanceCount']];
   for(const [table,selector] of pairs){
     if(seq!==turn||document.documentElement.classList.contains('maqon-auth-locked'))return;
     const r=await db.from(table).select('id',{head:true,count:'exact'}).eq('empresa_id',cid);
     if(r.error||typeof r.count!=='number')continue;
     const el=document.querySelector(selector);if(el)el.textContent=String(r.count);
   }
 }
 // O controlador principal pode completar a autenticação depois do carregamento da página.
 document.addEventListener('DOMContentLoaded',()=>{
   const observer=new MutationObserver(()=>{if(!document.documentElement.classList.contains('maqon-auth-locked'))refresh().catch(()=>{});else seq++});
   observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
   refresh().catch(()=>{});
 });
})();
