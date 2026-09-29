(function(){
  const K='maqon_automation_v1';
  const STAGES=['Novo Lead','Diagnóstico','Qualificado','Análise Técnica','Proposta','Negociação','Fechado'];
  const load=()=>{try{const d=JSON.parse(localStorage.getItem(K))||{};return{...d,leads:Array.isArray(d.leads)?d.leads:[],events:Array.isArray(d.events)?d.events:[]}}catch(e){return{leads:[],events:[]}}};
  const save=d=>localStorage.setItem(K,JSON.stringify(d));
  const clean=v=>String(v??'').trim();
  const normEmail=v=>clean(v).toLowerCase();
  const normPhone=v=>clean(v).replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
  const score=l=>Math.min(100,(clean(l.nome)?10:0)+(clean(l.empresa)?10:0)+(clean(l.whatsapp)?15:0)+(clean(l.email)?10:0)+(clean(l.tipoEquipamento)?15:0)+(clean(l.marcaModelo)?10:0)+(clean(l.objetivo)?10:0)+(clean(l.orcamento)?10:0)+(clean(l.prazo)?10:0));
  const etapa=s=>s>=80?'Qualificado':s>=55?'Diagnóstico':s>=30?'Novo Lead':'Novo Lead';
  const stageRank=s=>STAGES.indexOf(s);

  function findExisting(leads,data){
    const phone=normPhone(data.whatsapp),email=normEmail(data.email);
    return leads.find(l=>(phone&&normPhone(l.whatsapp)===phone)||(email&&normEmail(l.email)===email));
  }

  function addLead(data){
    const d=load(),now=new Date().toISOString();
    data=Object.fromEntries(Object.entries(data||{}).map(([k,v])=>[k,typeof v==='string'?v.trim():v]));
    const existing=findExisting(d.leads,data);

    if(existing){
      const previousStatus=STAGES.includes(existing.status)?existing.status:'Novo Lead';
      const merged={...existing,...data,origem:'Diagnóstico MAQON',atualizadoEm:now};
      merged.score=score(merged);
      const suggested=etapa(merged.score);
      merged.status=stageRank(previousStatus)>stageRank(suggested)?previousStatus:suggested;
      Object.assign(existing,merged);
      d.events.unshift({tipo:'lead_atualizado_diagnostico',leadId:existing.id,status:existing.status,quando:now,origem:'Diagnóstico MAQON'});
      save(d);
      return {...existing,_automationAction:'atualizado'};
    }

    const s=score(data);
    const l={id:'LEAD-'+Date.now().toString(36).toUpperCase(),criadoEm:now,...data,score:s,status:etapa(s),origem:'Diagnóstico MAQON',atualizadoEm:now};
    d.leads.unshift(l);
    d.events.unshift({tipo:'lead_criado_diagnostico',leadId:l.id,status:l.status,quando:now,origem:'Diagnóstico MAQON'});
    save(d);
    return {...l,_automationAction:'criado'};
  }

  function nextAction(l){
    if(!clean(l.whatsapp)&&!clean(l.email))return'Completar contato';
    if(!clean(l.tipoEquipamento))return'Realizar diagnóstico';
    if(!clean(l.marcaModelo))return'Definir marca/modelo';
    if(!clean(l.orcamento))return'Levantar orçamento';
    if(l.status==='Qualificado')return'Preparar análise técnica';
    return'Acompanhar lead';
  }

  window.MAQON_AUTOMATION={addLead,listLeads:()=>load().leads,nextAction,database:load};
})();
