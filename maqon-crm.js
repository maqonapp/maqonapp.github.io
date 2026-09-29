(function(){
const K='maqon_automation_v1',STAGES=['Novo Lead','Diagnóstico','Qualificado','Análise Técnica','Proposta','Negociação','Fechado'];
const load=()=>{try{return JSON.parse(localStorage.getItem(K))||{leads:[],events:[]}}catch(e){return{leads:[],events:[]}}};
const save=d=>localStorage.setItem(K,JSON.stringify(d));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function normalize(db){db.leads=(db.leads||[]).map(l=>({...l,status:STAGES.includes(l.status)?l.status:(l.status==='Incompleto'?'Novo Lead':l.status)}));db.events=db.events||[];return db}
function move(id,status){let d=normalize(load()),l=d.leads.find(x=>String(x.id)===String(id));if(!l||!STAGES.includes(status))return;l.status=status;l.atualizadoEm=new Date().toISOString();d.events.unshift({tipo:'mudanca_etapa',leadId:id,status,quando:l.atualizadoEm});save(d);render()}
function next(id){let d=normalize(load()),l=d.leads.find(x=>String(x.id)===String(id));if(!l)return;if(l.status==='Proposta'||l.status==='Negociação'){location.href='maqon-negociacao.html?lead='+encodeURIComponent(id);return}if(l.status==='Fechado'){location.href='maqon-pos-venda.html?lead='+encodeURIComponent(id);return}let i=STAGES.indexOf(l.status);if(i<STAGES.length-1)move(id,STAGES[i+1])}
function removeLead(id){if(!confirm('Excluir este lead?'))return;let d=normalize(load());d.leads=d.leads.filter(x=>String(x.id)!==String(id));save(d);render()}
function card(l){return `<article class="card"><b>${esc(l.nome||'Sem nome')}</b><small>${esc(l.empresa||'Sem empresa')}</small><span>${esc(l.tipoEquipamento||'Equipamento a definir')}</span><span>${esc(l.marcaModelo||'Marca/modelo a definir')}</span><div class="score">Score ${esc(l.analiseTecnica?.scoreTecnico ?? l.score ?? 0)}/100</div><div class="actions"><button onclick="MAQON_CRM.next('${l.id}')">${l.status==='Fechado'?'Abrir pós-venda →':(l.status==='Proposta'||l.status==='Negociação'?'Abrir negociação →':'Avançar →')}</button><button class="ghost" onclick="MAQON_CRM.remove('${l.id}')">×</button></div></article>`}
function render(){
 let d=normalize(load()),root=document.getElementById('board'); if(!root)return;
 document.getElementById('total').textContent=d.leads.length;
 document.getElementById('qual').textContent=d.leads.filter(x=>['Qualificado','Análise Técnica','Proposta','Negociação','Fechado'].includes(x.status)).length;
 document.getElementById('prop').textContent=d.leads.filter(x=>['Proposta','Negociação'].includes(x.status)).length;
 document.getElementById('closed').textContent=d.leads.filter(x=>x.status==='Fechado').length;
 root.innerHTML=STAGES.map(s=>`<section class="col"><header>${s}<em>${d.leads.filter(x=>x.status===s).length}</em></header><div class="cards">${d.leads.filter(x=>x.status===s).map(card).join('')||'<i>Sem leads</i>'}</div></section>`).join('');
}
window.MAQON_CRM={render,move,next,remove:removeLead,stages:STAGES};addEventListener('DOMContentLoaded',render);
})();