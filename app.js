const STORAGE_KEY='maqon_leads_v1';
const seedLeads=[
['30/09/2026','Marcos Oliveira','Construtora Vale','(98) 99123-4567','Escavadeira','Novo Lead','Qualificação','Site'],
['30/09/2026','Ana Paula Santos','Transportes Lima','(11) 98765-4321','Munck','Em Atendimento','Diagnóstico','WhatsApp'],
['29/09/2026','Carlos Mendes','Mendes Engenharia','(62) 99876-1234','Motoniveladora','Proposta Enviada','Proposta','LinkedIn'],
['29/09/2026','João Ribeiro','Ribeiro Terraplenagem','(85) 99654-3210','Caminhão Basculante','Negociação','Negociação','Indicação'],
['28/09/2026','Fernanda Costa','Costa Logística','(31) 98987-6543','Retroescavadeira','Cliente','Fechado','Site']
];
let leads=loadLeads(); let editingIndex=null;
function loadLeads(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));return Array.isArray(x)?x:[]}catch(e){return []}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(leads))}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function badge(v){return `<span class="badge" data-status="${esc(v)}">${esc(v)}</span>`}
function loadCRMLeads(){try{const d=JSON.parse(localStorage.getItem('maqon_automation_v1'))||{};return Array.isArray(d.leads)?d.leads:[]}catch(e){return []}}
function renderRecent(){const crm=loadCRMLeads(),body=document.querySelector('#leadRows');if(!body)return;if(crm.length){body.innerHTML=crm.slice(0,5).map((l,n)=>`<tr><td>${n+1}</td><td>${esc(l.atualizadoEm?new Date(l.atualizadoEm).toLocaleDateString('pt-BR'):'—')}</td><td>${esc(l.nome||'')}</td><td>${esc(l.empresa||'')}</td><td>${esc(l.whatsapp||'')}</td><td>${esc(l.tipoEquipamento||'')}</td><td>${badge(l.status||'')}</td><td>${esc(l.status||'')}</td><td>${esc(l.origem||'')}</td><td class="actions"><button type="button" onclick="location.href='maqon-crm.html'" title="Abrir CRM">→</button></td></tr>`).join('');return}body.innerHTML=leads.slice(0,5).map((x,n)=>`<tr><td>${n+1}</td>${x.map((v,i)=>`<td>${i===5?badge(v):esc(v)}</td>`).join('')}<td class="actions"><button type="button" data-edit="${n}" title="Editar">✎</button> <button type="button" data-delete="${n}" title="Excluir">▣</button></td></tr>`).join('')}
function renderAll(a=leads){document.querySelector('#allLeads').innerHTML=a.map(x=>{const idx=leads.indexOf(x);return `<tr><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td><td>${esc(x[4])}</td><td>${badge(x[5])}</td><td>${esc(x[6])}</td><td>${esc(x[7])}</td><td class="actions"><button type="button" data-analysis="${idx}" title="Enviar para Análise Técnica">⚙</button> <button type="button" data-edit="${idx}" title="Editar">✎</button> <button type="button" data-delete="${idx}" title="Excluir">▣</button></td></tr>`}).join('')}
function updateKPIs(){
 const crm=loadCRMLeads();
 if(crm.length){
  const total=crm.length;
  const count=statuses=>crm.filter(x=>statuses.includes(x.status)).length;
  const novos=count(['Novo Lead']);
  const service=count(['Diagnóstico','Qualificado','Análise Técnica']);
  const proposal=count(['Proposta']);
  const negotiation=count(['Negociação']);
  const clients=count(['Fechado']);
  const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};
  set('#kpiTotal',total);set('#kpiNew',novos);set('#kpiService',service);set('#kpiProposal',proposal);set('#kpiClient',clients);set('#kpiConversion',total?`${(clients/total*100).toFixed(1).replace('.',',')}%`:'0,0%');
  const donut=document.querySelector('.donut b');if(donut)donut.textContent=total;
  const funnelValues=[total,service,proposal,negotiation,clients];
  document.querySelectorAll('.funnel>div').forEach((row,i)=>{const value=funnelValues[i]??0,b=row.querySelector('b'),small=row.querySelector('small');if(b)b.textContent=value;if(small)small.textContent=(i===0?(total?100:0):(total?Math.round(value/total*100):0))+'%'});
  return;
 }
 const total=leads.length,service=leads.filter(x=>x[5]==='Em Atendimento').length,proposal=leads.filter(x=>x[5]==='Proposta Enviada').length,negotiation=leads.filter(x=>x[5]==='Negociação').length,clients=leads.filter(x=>x[5]==='Cliente').length; const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};set('#kpiTotal',total);set('#kpiNew',leads.filter(x=>x[5]==='Novo Lead').length);set('#kpiService',service);set('#kpiProposal',proposal);set('#kpiClient',clients);set('#kpiConversion',total?`${(clients/total*100).toFixed(1).replace('.',',')}%`:'0,0%'); const donut=document.querySelector('.donut b');if(donut)donut.textContent=total; const funnelValues=[total,service,proposal,negotiation,clients];document.querySelectorAll('.funnel>div').forEach((row,i)=>{const value=funnelValues[i]??0;const b=row.querySelector('b'),small=row.querySelector('small');if(b)b.textContent=value;if(small)small.textContent=(i===0?(total?100:0):(total?Math.round(value/total*100):0))+'%'})
}
function render(){renderRecent();renderAll();updateKPIs();try{updateSocialLeadCounts()}catch(e){}setTimeout(()=>{try{renderLiveSummary()}catch(e){}},0)}
function renderLiveSummary(){
 const crm=loadCRMLeads();
 const source=crm.length?crm.map(l=>l.origem||'Outro'):leads.map(l=>l[7]||'Outro');
 const total=source.length, counts={};source.forEach(o=>{const k=o||'Outro';counts[k]=(counts[k]||0)+1});
 const legend=document.querySelector('#originLegend');if(legend){legend.innerHTML=total?Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<p>${esc(k)} <b>${Math.round(v/total*100)}%</b></p>`).join(''):'<p>Sem leads cadastrados.</p>'}
 const plist=(typeof proposals!=='undefined'?proposals:[]);const pipe=document.querySelector('#financePipeline');if(pipe){const sum=plist.reduce((a,p)=>a+(Number(p.value)||0),0);pipe.textContent=brl(sum)||'R$ 0,00'}const fpc=document.querySelector('#financeProposalCount');if(fpc)fpc.textContent=plist.length;const fac=document.querySelector('#financeApprovedCount');if(fac)fac.textContent=plist.filter(p=>p.status==='Aprovada').length
}

render();

let maqonViewHistory=['dashboard'];
function go(id,track=true){const target=document.querySelector('#'+id);if(!target)return;const current=document.querySelector('.view.active')?.id;if(track&&current&&current!==id)maqonViewHistory.push(current);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));target.classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id))}
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>{if(n.dataset.href){location.href=n.dataset.href;return}go(n.dataset.view)});document.querySelectorAll('[data-go]').forEach(n=>n.onclick=()=>go(n.dataset.go));
const platformBack=document.querySelector('#platformBack');if(platformBack)platformBack.onclick=()=>{const prev=maqonViewHistory.pop();if(prev)go(prev,false);else go('dashboard',false)};const platformHome=document.querySelector('#platformHome');if(platformHome)platformHome.onclick=()=>go('dashboard');document.querySelectorAll('[data-report-view]').forEach(b=>b.onclick=()=>go(b.dataset.reportView));
const d=document.querySelector('#leadDialog'),form=document.querySelector('#leadForm');
function openLead(index=null){editingIndex=index;document.querySelector('#leadDialogTitle').textContent=index===null?'Novo Lead':'Editar Lead';if(index===null){form.reset();document.querySelector('#leadStatus').value='Novo Lead';document.querySelector('#leadPhase').value='Qualificação';document.querySelector('#leadOrigin').value='Manual';document.querySelector('#leadOwner').value='Renan';document.querySelector('#leadMode').value='Compra'}else{const x=leads[index];document.querySelector('#name').value=x[1]||'';document.querySelector('#company').value=x[2]||'';document.querySelector('#phone').value=x[3]||'';document.querySelector('#interest').value=x[4]||'Escavadeira';document.querySelector('#leadStatus').value=x[5]||'Novo Lead';document.querySelector('#leadPhase').value=x[6]||'Qualificação';document.querySelector('#leadOrigin').value=x[7]||'Manual';document.querySelector('#leadEmail').value=x[8]||'';document.querySelector('#leadCity').value=x[9]||'';document.querySelector('#leadUF').value=x[10]||'';document.querySelector('#leadBrandModel').value=x[11]||'';document.querySelector('#leadMode').value=x[12]||'Compra';document.querySelector('#leadBudget').value=x[13]||'';document.querySelector('#leadOwner').value=x[14]||'Renan';document.querySelector('#leadNeed').value=x[15]||'';document.querySelector('#leadNotes').value=x[16]||''}d.showModal()}
document.querySelector('#newLead').onclick=()=>openLead();document.querySelector('#quickLead').onclick=()=>openLead();document.querySelector('#cancelLead').onclick=()=>d.close();
form.addEventListener('submit',e=>{e.preventDefault();const n=document.querySelector('#name').value.trim();if(!n)return;const status=document.querySelector('#leadStatus').value;const phase=document.querySelector('#leadPhase').value;const origin=document.querySelector('#leadOrigin').value;const row=[new Date().toLocaleDateString('pt-BR'),n,document.querySelector('#company').value.trim(),document.querySelector('#phone').value.trim(),document.querySelector('#interest').value,status,phase,origin,document.querySelector('#leadEmail').value.trim(),document.querySelector('#leadCity').value.trim(),document.querySelector('#leadUF').value.trim().toUpperCase(),document.querySelector('#leadBrandModel').value.trim(),document.querySelector('#leadMode').value,document.querySelector('#leadBudget').value,document.querySelector('#leadOwner').value,document.querySelector('#leadNeed').value.trim(),document.querySelector('#leadNotes').value.trim()];if(editingIndex===null)leads.unshift(row);else leads[editingIndex]=[leads[editingIndex][0],...row.slice(1)];persist();render();d.close();form.reset()});
function sendLeadToTechnicalAnalysis(index){
 const x=leads[index]; if(!x)return;
 const K='maqon_automation_v1';
 let db; try{db=JSON.parse(localStorage.getItem(K))||{}}catch(e){db={}};
 db.leads=Array.isArray(db.leads)?db.leads:[]; db.events=Array.isArray(db.events)?db.events:[];
 const phone=String(x[3]||'').replace(/\D/g,''); const email=String(x[8]||'').trim().toLowerCase();
 let l=db.leads.find(y=>(phone&&String(y.whatsapp||'').replace(/\D/g,'')===phone)||(email&&String(y.email||'').trim().toLowerCase()===email));
 const now=new Date().toISOString();
 const data={nome:x[1]||'',empresa:x[2]||'',whatsapp:x[3]||'',email:x[8]||'',cidade:x[9]||'',estado:x[10]||'',tipoEquipamento:x[4]||'',marcaModelo:x[11]||'',compraLocacao:x[12]||'',orcamento:x[13]||'',objetivo:x[15]||'',observacoes:x[16]||'',responsavel:x[14]||'',origem:x[7]||'CRM MAQON',status:'Análise Técnica',atualizadoEm:now};
 if(l){Object.assign(l,data)}else{l={id:'LEAD-'+Date.now().toString(36).toUpperCase(),criadoEm:now,score:0,...data};db.leads.unshift(l)}
 db.events.unshift({tipo:'crm_para_analise',leadId:l.id,status:'Análise Técnica',quando:now});
 localStorage.setItem(K,JSON.stringify(db));
 x[5]='Em Atendimento'; x[6]='Análise Técnica'; persist();
 location.href='maqon-analise.html?lead='+encodeURIComponent(l.id);
}
document.addEventListener('click',e=>{const analysis=e.target.closest('[data-analysis]'),edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(analysis){sendLeadToTechnicalAnalysis(Number(analysis.dataset.analysis));return}if(edit)openLead(Number(edit.dataset.edit));if(del){const i=Number(del.dataset.delete);if(confirm(`Excluir o lead ${leads[i][1]}?`)){leads.splice(i,1);persist();render()}}});
document.querySelector('#search').oninput=e=>{const q=e.target.value.toLowerCase();renderAll(leads.filter(x=>x.join(' ').toLowerCase().includes(q)))};

const EQUIPMENT_KEY='maqon_equipamentos_v1';
const seedEquipment=[['Escavadeira','Caterpillar','320','2024','1250','850000','18.5','42','94','Ativo'],['Pá Carregadeira','Volvo','L90H','2023','2100','780000','15.8','38','92','Ativo'],['Guindaste','SANY','STC250T5','2024','980','1250000','22','55','96','Disponível']];
let equipments=loadEquipment(),editingEquipment=null;
function removeLegacyDemoData(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(Array.isArray(x)&&x.length===5&&['Marcos Oliveira','Ana Paula Santos','Carlos Mendes','João Ribeiro','Fernanda Costa'].every((n,i)=>x[i]&&x[i][1]===n)){localStorage.removeItem(STORAGE_KEY);leads=[]}}catch(e){}
 try{const x=JSON.parse(localStorage.getItem(EQUIPMENT_KEY));if(Array.isArray(x)&&x.length===3&&['320','L90H','STC250T5'].every((n,i)=>x[i]&&x[i][2]===n)){localStorage.removeItem(EQUIPMENT_KEY);equipments=[]}}catch(e){}
}

function loadEquipment(){try{const x=JSON.parse(localStorage.getItem(EQUIPMENT_KEY));return Array.isArray(x)?x:[]}catch(e){return []}}
function persistEquipment(){localStorage.setItem(EQUIPMENT_KEY,JSON.stringify(equipments))}
function brl(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):''}
function renderEquipment(a=equipments){const body=document.querySelector('#equipmentRows');if(!body)return;body.innerHTML=a.map(x=>{const i=equipments.indexOf(x);return `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td><td>${esc(x[4])} h</td><td>${brl(x[5])}</td><td>${esc(x[6])} L/h</td><td>${brl(x[7])}/h</td><td>${esc(x[8])}%</td><td>${esc(x[9])}</td><td class="actions"><button type="button" data-eq-edit="${i}" title="Editar">✎</button> <button type="button" data-eq-delete="${i}" title="Excluir">▣</button></td></tr>`}).join('')}
const eqd=document.querySelector('#equipmentDialog'),eqf=document.querySelector('#equipmentForm');
function openEquipment(i=null){editingEquipment=i;document.querySelector('#equipmentDialogTitle').textContent=i===null?'Novo Equipamento':'Editar Equipamento';if(i===null)eqf.reset();else{const x=equipments[i];['eqCategory','eqMaker','eqModel','eqYear','eqHours','eqValue','eqConsumption','eqMaintenance','eqAvailability','eqStatus'].forEach((id,n)=>document.querySelector('#'+id).value=x[n])}eqd.showModal()}
document.querySelector('#newEquipment').onclick=()=>openEquipment();
document.querySelector('#cancelEquipment').onclick=()=>eqd.close();
eqf.addEventListener('submit',e=>{e.preventDefault();const ids=['eqCategory','eqMaker','eqModel','eqYear','eqHours','eqValue','eqConsumption','eqMaintenance','eqAvailability','eqStatus'];const row=ids.map(id=>document.querySelector('#'+id).value.trim());if(!row[1]||!row[2])return;if(editingEquipment===null)equipments.unshift(row);else equipments[editingEquipment]=row;persistEquipment();removeLegacyDemoData();render();renderEquipment();populateComparators();analysisOptions();eqd.close();eqf.reset()});
document.addEventListener('click',e=>{const ed=e.target.closest('[data-eq-edit]'),del=e.target.closest('[data-eq-delete]');if(ed)openEquipment(Number(ed.dataset.eqEdit));if(del){const i=Number(del.dataset.eqDelete);if(confirm(`Excluir o equipamento ${equipments[i][1]} ${equipments[i][2]}?`)){equipments.splice(i,1);persistEquipment();renderEquipment();populateComparators();analysisOptions()}}});
document.querySelector('#equipmentSearch').oninput=e=>{const q=e.target.value.toLowerCase();renderEquipment(equipments.filter(x=>x.join(' ').toLowerCase().includes(q)))};
renderEquipment();

function equipmentName(x){return x?`${x[1]} ${x[2]} — ${x[0]}`:''}
function eqNum(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0}
function populateComparators(){
 const sels=[1,2,3].map(i=>document.querySelector('#compare'+i)); if(sels.some(s=>!s))return;
 const opts='<option value="">Selecione um equipamento</option>'+equipments.map((x,i)=>`<option value="${i}">${esc(equipmentName(x))}</option>`).join('');
 sels.forEach((s,i)=>{const v=s.value;s.innerHTML=opts;if(v!==''&&equipments[Number(v)])s.value=v;else if(equipments[i])s.value=String(i)});
 renderComparison();
}
function renderComparison(){
 const sels=[1,2,3].map(i=>document.querySelector('#compare'+i)),body=document.querySelector('#compareRows');if(!body||sels.some(s=>!s))return;
 const c=sels.map(s=>s.value===''?null:equipments[Number(s.value)]||null);
 c.forEach((x,i)=>document.querySelector('#compareHead'+(i+1)).textContent=x?equipmentName(x):`Máquina ${i+1}`);
 const rows=[['Categoria',0,v=>v],['Fabricante',1,v=>v],['Modelo',2,v=>v],['Ano',3,v=>v],['Horímetro',4,v=>v+' h'],['Valor de compra',5,v=>brl(v)],['Consumo',6,v=>v+' L/h'],['Manutenção / hora',7,v=>brl(v)+'/h'],['Disponibilidade',8,v=>v+'%'],['Situação',9,v=>v]];
 body.innerHTML=rows.map(([l,k,f])=>`<tr><th>${l}</th>${c.map(x=>`<td>${x?f(esc(x[k])):'—'}</td>`).join('')}</tr>`).join('');
 const v=c.filter(Boolean),s=document.querySelector('#compareSummary');
 if(v.length<2){s.innerHTML='<b>Selecione pelo menos 2 máquinas para gerar o resumo comparativo.</b>';return}
 const min=(k)=>v.reduce((a,b)=>eqNum(a[k])<=eqNum(b[k])?a:b),max=(k)=>v.reduce((a,b)=>eqNum(a[k])>=eqNum(b[k])?a:b);
 const a=min(5),b=min(6),m=min(7),d=max(8);
 s.innerHTML=`<b>Resumo automático:</b> menor valor: <strong>${esc(equipmentName(a))}</strong> (${brl(a[5])}); menor consumo: <strong>${esc(equipmentName(b))}</strong> (${esc(b[6])} L/h); menor manutenção: <strong>${esc(equipmentName(m))}</strong> (${brl(m[7])}/h); maior disponibilidade: <strong>${esc(equipmentName(d))}</strong> (${esc(d[8])}%).`;
}
[1,2,3].forEach(i=>{const s=document.querySelector('#compare'+i);if(s)s.addEventListener('change',renderComparison)});
populateComparators();

// MAQON Engine — Análises Técnicas
function analysisOptions(){
 const s=document.querySelector('#analysisEquipment'); if(!s)return;
 const current=s.value;
 s.innerHTML='<option value="">Selecione um equipamento</option>'+equipments.map((x,i)=>`<option value="${i}">${esc(equipmentName(x))}</option>`).join('');
 if(current!==''&&equipments[Number(current)])s.value=current; else if(equipments.length)s.value='0';
 renderAnalysis();
}
function analysisScore(x){
 const availability=Math.max(0,Math.min(100,eqNum(x[8])));
 const consumption=eqNum(x[6]),maintenance=eqNum(x[7]),hours=eqNum(x[4]),year=eqNum(x[3]);
 const currentYear=new Date().getFullYear();
 const age=Math.max(0,currentYear-year);
 const availabilityScore=availability;
 const consumptionScore=Math.max(0,100-consumption*2.2);
 const maintenanceScore=Math.max(0,100-maintenance*1.15);
 const hoursScore=Math.max(0,100-hours/60);
 const ageScore=Math.max(0,100-age*7);
 return Math.round(availabilityScore*.35+consumptionScore*.20+maintenanceScore*.20+hoursScore*.10+ageScore*.15);
}
function renderAnalysis(){
 const sel=document.querySelector('#analysisEquipment'),rows=document.querySelector('#analysisRows'); if(!sel||!rows)return;
 const x=sel.value===''?null:equipments[Number(sel.value)]||null;
 const cost=document.querySelector('#analysisCost'),avail=document.querySelector('#analysisAvailability'),scoreEl=document.querySelector('#analysisScore'),summary=document.querySelector('#analysisSummary');
 if(!x){cost.textContent=avail.textContent=scoreEl.textContent='—';rows.innerHTML='';summary.textContent='Selecione um equipamento para gerar a análise técnica.';return}
 const fuel=eqNum(x[6]),maint=eqNum(x[7]);
 // custo operacional parcial com os dados hoje cadastrados: consumo físico + manutenção/hora.
 // combustível não é monetizado porque o cadastro atual não possui preço do litro.
 const score=analysisScore(x);
 cost.textContent=brl(maint)+'/h + combustível'; avail.textContent=eqNum(x[8]).toLocaleString('pt-BR')+'%'; scoreEl.textContent=score+'/100';
 const indicators=[['Equipamento',equipmentName(x)],['Ano',x[3]],['Horímetro',x[4]+' h'],['Valor de compra',brl(x[5])],['Consumo',x[6]+' L/h'],['Manutenção por hora',brl(x[7])+'/h'],['Disponibilidade',x[8]+'%'],['Situação',x[9]],['Score MAQON',score+'/100']];
 rows.innerHTML=indicators.map(([a,b])=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');
 let level=score>=85?'desempenho técnico elevado':score>=70?'desempenho técnico consistente':score>=55?'desempenho técnico intermediário':'indicadores que exigem atenção';
 summary.innerHTML=`<b>Resumo técnico automático:</b> ${esc(equipmentName(x))} apresenta <strong>${level}</strong>, com disponibilidade de <strong>${esc(x[8])}%</strong>, consumo informado de <strong>${esc(x[6])} L/h</strong> e manutenção informada de <strong>${brl(x[7])}/h</strong>. O Score MAQON atual é <strong>${score}/100</strong>. <small>O custo/hora total ainda não inclui combustível, depreciação, operador, pneus/rodante, seguros e outros custos porque esses dados ainda não fazem parte do cadastro.</small>`;
}
const analysisSel=document.querySelector('#analysisEquipment'); if(analysisSel)analysisSel.addEventListener('change',renderAnalysis);
const runAnalysis=document.querySelector('#runAnalysis'); if(runAnalysis)runAnalysis.onclick=renderAnalysis;
analysisOptions();



// MAQON - Propostas Comerciais
const PROPOSAL_KEY='maqon_propostas_v1';
let proposals=loadProposals(),editingProposal=null;setTimeout(()=>{try{renderLiveSummary()}catch(e){}},0);
function loadProposals(){try{const x=JSON.parse(localStorage.getItem(PROPOSAL_KEY));return Array.isArray(x)?x:[]}catch(e){return []}}
function persistProposals(){localStorage.setItem(PROPOSAL_KEY,JSON.stringify(proposals))}
function proposalNumber(i){return 'PROP-'+String(i+1).padStart(4,'0')}
function renderProposals(a=proposals){const body=document.querySelector('#proposalRows');if(!body)return;body.innerHTML=a.map(p=>{const i=proposals.indexOf(p);return `<tr><td>${proposalNumber(i)}</td><td>${esc(p.client)}</td><td>${esc(p.company)}</td><td>${esc(p.equipment)}</td><td>${esc(p.mode)}</td><td>${brl(p.value)}</td><td>${esc(p.validity||'—')}</td><td>${badge(p.status)}</td><td class="actions"><button data-pr-view="${i}" title="Visualizar">▤</button> <button data-pr-edit="${i}" title="Editar">✎</button> <button data-pr-delete="${i}" title="Excluir">▣</button></td></tr>`}).join('');document.querySelector('#proposalCount').textContent=proposals.length;document.querySelector('#proposalSentCount').textContent=proposals.filter(p=>['Enviada','Em negociação','Aprovada'].includes(p.status)).length}
function proposalOptions(){const c=document.querySelector('#proposalClient'),e=document.querySelector('#proposalEquipment');if(!c||!e)return;c.innerHTML='<option value="">Selecione o cliente / lead</option>'+leads.map((x,i)=>`<option value="${i}">${esc(x[1])}${x[2]?' — '+esc(x[2]):''}</option>`).join('');e.innerHTML='<option value="">Selecione o equipamento</option>'+equipments.map((x,i)=>`<option value="${i}">${esc(equipmentName(x))}</option>`).join('')}
const pd=document.querySelector('#proposalDialog'),pf=document.querySelector('#proposalForm');
function openProposal(i=null){editingProposal=i;proposalOptions();document.querySelector('#proposalDialogTitle').textContent=i===null?'Nova Proposta':'Editar Proposta';if(i===null){pf.reset();const d=new Date();d.setDate(d.getDate()+15);document.querySelector('#proposalValidity').value=d.toISOString().slice(0,10);document.querySelector('#proposalStatus').value='Rascunho'}else{const p=proposals[i],li=leads.findIndex(x=>x[1]===p.client&&x[2]===p.company),ei=equipments.findIndex(x=>equipmentName(x)===p.equipment);document.querySelector('#proposalClient').value=li>=0?li:'';document.querySelector('#proposalEquipment').value=ei>=0?ei:'';document.querySelector('#proposalMode').value=p.mode;document.querySelector('#proposalScope').value=p.scope||'';document.querySelector('#proposalValue').value=p.value;document.querySelector('#proposalValidity').value=p.validity||'';document.querySelector('#proposalTerms').value=p.terms||'';document.querySelector('#proposalStatus').value=p.status}pd.showModal()}
function viewProposal(i){
 const p=proposals[i]; if(!p)return;
 const num=proposalNumber(i);
 const eq=equipments.find(x=>equipmentName(x)===p.equipment)||null;
 const category=(eq?.[0]||'Equipamento').trim(), maker=(eq?.[1]||'—').trim(), model=(eq?.[2]||'—').trim();
 const year=eq?.[3]||'—', hours=eq?.[4]||'—', availability=eq?.[8]||'—';
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const key=norm(category);
 const profiles={
  retro:{desc:'Equipamento versátil para escavação, carregamento, abertura de valas e apoio geral em obras.',chars:['Versatilidade para escavação e carregamento','Boa mobilidade entre frentes de serviço','Operação prática e manutenção acessível','Aplicação em obras urbanas e terraplenagem'],apps:['Escavação e abertura de valas','Carregamento de materiais','Obras urbanas','Terraplenagem e infraestrutura']},
  guindaste:{desc:'Equipamento destinado ao içamento, movimentação e posicionamento controlado de cargas.',chars:['Capacidade para operações de içamento','Controle e precisão na movimentação de cargas','Aplicação em montagens e operações industriais','Mobilidade para diferentes frentes de trabalho'],apps:['Içamento de cargas','Montagem industrial','Construção civil','Movimentação de equipamentos']},
  escavadeira:{desc:'Equipamento de alta produtividade para escavação, terraplenagem e movimentação de materiais.',chars:['Alta capacidade de escavação','Sistema hidráulico de alto desempenho','Boa estabilidade operacional','Aplicação em serviços pesados'],apps:['Escavação','Terraplenagem','Mineração e pedreiras','Infraestrutura']},
  carregadeira:{desc:'Equipamento robusto e produtivo para carregamento e movimentação de materiais em diferentes operações.',chars:['Alta produtividade no carregamento','Boa capacidade de movimentação de materiais','Operação estável e segura','Aplicação em obras, mineração e pátios'],apps:['Carregamento de caminhões','Movimentação de materiais','Obras de terraplenagem','Mineração e pátios']},
  basculante:{desc:'Veículo destinado ao transporte e descarga de materiais a granel em obras e operações de terraplenagem.',chars:['Transporte eficiente de materiais','Descarga rápida por basculamento','Aplicação em operações de obra e mineração','Boa produtividade logística'],apps:['Transporte de solo','Transporte de brita e agregados','Terraplenagem','Mineração e construção']},
  pipa:{desc:'Veículo de apoio para transporte e distribuição de água em obras, vias e operações industriais.',chars:['Distribuição controlada de água','Apoio à umectação de vias','Versatilidade operacional','Aplicação em obras e áreas industriais'],apps:['Umectação de vias','Abastecimento de água','Controle de poeira','Apoio a obras']},
  padrao:{desc:'Equipamento cadastrado na plataforma MAQON para análise técnica e comercial.',chars:['Aplicação conforme configuração cadastrada','Análise técnica baseada nos dados disponíveis','Avaliação de produtividade e disponibilidade','Suporte à decisão de compra ou locação'],apps:['Construção civil','Terraplenagem','Infraestrutura','Operações industriais']}
 };
 const prof=key.includes('retro')?profiles.retro:key.includes('guindaste')||key.includes('munck')?profiles.guindaste:key.includes('escavadeira')?profiles.escavadeira:key.includes('carregadeira')?profiles.carregadeira:key.includes('basculante')?profiles.basculante:key.includes('pipa')?profiles.pipa:profiles.padrao;
 const valid=p.validity?new Date(p.validity+'T12:00:00').toLocaleDateString('pt-BR'):'—';
 const issue=new Date().toLocaleDateString('pt-BR');
 const bullets=a=>a.map(v=>`<li>${esc(v)}</li>`).join('');
 const scopeItems=(p.scope||'').split(/\n|;/).map(s=>s.trim()).filter(Boolean);
 const scope=scopeItems.length?scopeItems:['Suporte na análise técnica e comparativa com outras opções de mercado.','Orientação sobre manutenção preventiva e custo operacional.','Acompanhamento no processo de aquisição e entrega do equipamento.','Treinamento operacional básico (conforme fabricante).'];
 const w=window.open('','_blank'); if(!w)return alert('Autorize pop-ups para visualizar a proposta.');
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(num)} - MAQON</title><style>
 *{box-sizing:border-box}html,body{margin:0;background:#dfe3e5;font-family:Arial,Helvetica,sans-serif;color:#111}.toolbar{height:56px;background:#10171b;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 22px;position:sticky;top:0;z-index:5}.toolbar button{border:0;border-radius:5px;padding:9px 14px;font-weight:800;cursor:pointer}.toolbar .print{background:#f5ad00}.stage{padding:18px;display:flex;justify-content:center}.sheet{position:relative;width:1024px;height:1536px;background:#fff;box-shadow:0 10px 35px #0004;overflow:hidden;transform-origin:top center}.header{height:176px;display:grid;grid-template-columns:430px 386px 208px}.brandBox{background:#050505;padding:20px 36px;display:flex;align-items:center}.brandBox img{width:355px;max-height:135px;object-fit:contain}.promise{padding:38px 18px 0 24px}.promise .line1{font-size:16px;color:#333;border-bottom:3px solid #efa900;padding-bottom:11px}.promise .line2{font-size:17px;color:#555;margin-top:16px}.promise .line3{font-size:26px;font-weight:900;color:#ed9800}.proposalBox{border-left:1px solid #d7d7d7;border-bottom:1px solid #d7d7d7;padding:25px 20px}.proposalBox b{display:block;font-size:29px;line-height:1}.proposalBox b span{color:#ee9a00}.proposalBox small{display:block;font-size:15px;font-weight:800;margin-top:20px;line-height:1.55}.body{padding:8px 36px 0}.section{margin-top:9px}.st{display:flex;align-items:center;gap:12px;font-size:25px;font-weight:900;margin-bottom:8px}.ico{width:48px;height:48px;border-radius:50%;background:#050505;color:#f5ad00;display:flex;align-items:center;justify-content:center;font-size:23px}.st:after{content:'';height:3px;background:#f5ad00;flex:1}.clientGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.clientGrid.three{grid-template-columns:1.1fr .9fr .95fr;margin-top:10px}.field{border:1.5px solid #657079;border-radius:4px;padding:10px 14px;height:67px}.field label{display:block;color:#66717a;font-size:13px;margin-bottom:5px}.field strong{font-size:17px}.equipmentGrid{display:grid;grid-template-columns:1.55fr .95fr;gap:12px}.panel{border:1.5px solid #657079;border-radius:4px;padding:13px 18px;min-height:365px}.eqTitle{font-size:31px;font-weight:900;color:#ed9800;margin:0 0 8px}.sub{font-size:20px;font-weight:900;margin:0 0 4px}.desc{font-size:17px;line-height:1.35;margin:0 0 13px}.rule{border-top:1px solid #657079;margin:10px 0}.checks{list-style:none;padding:0;margin:7px 0}.checks li{font-size:16px;margin:7px 0;padding-left:32px;position:relative}.checks li:before{content:'✓';position:absolute;left:0;top:-1px;width:22px;height:22px;border-radius:50%;background:#f5ad00;font-weight:900;text-align:center;line-height:22px}.specTitle{font-size:20px;font-weight:900;color:#ed9800;margin-bottom:6px}.spec{width:100%;border-collapse:collapse;font-size:16px}.spec td{border-bottom:1px solid #c7ccd0;padding:7px 4px}.spec td:first-child{font-weight:800}.investment{display:grid;grid-template-columns:1.12fr 1fr;gap:12px}.valueBox{height:190px;background:linear-gradient(110deg,#181300,#101719 70%);border-left:14px solid #ffc000;border-radius:5px;color:#fff;padding:20px 28px}.valueBox label{font-size:18px;font-weight:800}.valueBox strong{display:block;color:#ffc000;font-size:47px;margin:9px 0}.valueBox small{font-size:15px;font-weight:700}.terms{display:grid;gap:8px}.term{height:58px;border:1.5px solid #657079;border-radius:4px;padding:7px 14px}.term label{display:block;color:#66717a;font-size:12px}.term b{font-size:16px}.scopeBox{border:1.5px solid #657079;border-radius:4px;padding:9px 18px 9px 22px;position:relative;min-height:150px;overflow:hidden}.scopeBox:after{content:'M';position:absolute;right:25px;top:-16px;font-size:180px;font-weight:900;color:#f5ad0014}.scopeBox .checks{position:relative;z-index:1}.obs{display:grid;grid-template-columns:1.8fr 1fr;gap:20px;align-items:start}.obsText{font-size:15px;line-height:1.4;padding:2px 12px 0 64px}.quote{font-size:27px;color:#ed9800;font-weight:900;text-align:center;padding-top:3px}.footer{position:absolute;left:36px;right:0;bottom:0;height:130px;border-top:3px solid #f5ad00;display:grid;grid-template-columns:1.1fr 1fr}.contacts{display:flex;align-items:center;gap:17px;font-size:15px;font-weight:700}.footerBrand{background:#050505;clip-path:polygon(22% 0,100% 0,100% 100%,0 100%);display:flex;align-items:center;justify-content:flex-end;padding-right:30px}.footerBrand img{width:260px;max-height:95px;object-fit:contain}@media(max-width:1060px){.sheet{transform:scale(calc((100vw - 36px)/1024));margin-bottom:calc(-1536px * (1 - ((100vw - 36px)/1024)))}}@media print{.toolbar{display:none}.stage{padding:0}.sheet{box-shadow:none;transform:none!important;margin:0!important;width:1024px;height:1536px}html,body{background:#fff}@page{size:1024px 1536px;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
 </style></head><body><div class="toolbar"><b>Proposta Comercial — ${esc(num)}</b><div><button onclick="window.close()">Fechar</button> <button class="print" onclick="window.print()">Imprimir / Salvar PDF</button></div></div><main class="stage"><article class="sheet"><header class="header"><div class="brandBox"><img src="maqon-logo-original-aprovada.png" alt="MAQON"></div><div class="promise"><div class="line1">PLANEJAMENTO • DADOS • ESTRATÉGIA • RESULTADOS</div><div class="line2">EQUIPAMENTOS QUE</div><div class="line3">CONSTROEM O SEU FUTURO</div></div><div class="proposalBox"><b>PROPOSTA<br><span>COMERCIAL</span></b><small>Nº: ${esc(num)}<br>DATA: ${esc(issue)}</small></div></header><div class="body">
 <section class="section"><div class="st"><span class="ico">●</span>CLIENTE E PROPOSTA</div><div class="clientGrid"><div class="field"><label>CLIENTE</label><strong>${esc(p.client)}</strong></div><div class="field"><label>EMPRESA</label><strong>${esc(p.company||'—')}</strong></div></div><div class="clientGrid three"><div class="field"><label>MODALIDADE</label><strong>${esc(p.mode)}</strong></div><div class="field"><label>VALIDADE DA PROPOSTA</label><strong>${esc(valid)}</strong></div><div class="field"><label>DATA DE EMISSÃO</label><strong>${esc(issue)}</strong></div></div></section>
 <section class="section"><div class="st"><span class="ico">⚙</span>EQUIPAMENTO</div><div class="equipmentGrid"><div class="panel"><h2 class="eqTitle">${esc(maker)} ${esc(model)} — ${esc(category)}</h2><div class="sub">Descrição do equipamento</div><p class="desc">${esc(prof.desc)}</p><div class="rule"></div><div class="sub">Principais características</div><ul class="checks">${bullets(prof.chars)}</ul></div><div class="panel"><div class="specTitle">Especificações técnicas</div><table class="spec"><tr><td>Marca</td><td><b>${esc(maker)}</b></td></tr><tr><td>Modelo</td><td><b>${esc(model)}</b></td></tr><tr><td>Ano</td><td><b>${esc(year)}</b></td></tr><tr><td>Horímetro</td><td><b>${esc(hours)} h</b></td></tr><tr><td>Disponibilidade</td><td><b>${esc(availability)}%</b></td></tr></table><div class="sub" style="margin-top:12px">Aplicações principais</div><ul class="checks">${bullets(prof.apps)}</ul></div></div></section>
 <section class="section"><div class="st"><span class="ico">$</span>INVESTIMENTO</div><div class="investment"><div class="valueBox"><label>VALOR TOTAL</label><strong>${brl(p.value)}</strong><small>Investimento conforme proposta comercial<br>(valores sujeitos à alteração).</small></div><div class="terms"><div class="term"><label>CONDIÇÕES DE PAGAMENTO</label><b>${esc(p.terms||'A combinar / Financiamento bancário')}</b></div><div class="term"><label>PRAZO DE ENTREGA</label><b>A combinar</b></div><div class="term"><label>GARANTIA</label><b>Conforme fabricante / negociação</b></div></div></div></section>
 <section class="section"><div class="st"><span class="ico">☷</span>ESCOPO DA PROPOSTA</div><div class="scopeBox"><ul class="checks">${bullets(scope)}</ul></div></section>
 <section class="section"><div class="st"><span class="ico">▤</span>OBSERVAÇÕES</div><div class="obs"><div class="obsText">Esta proposta é válida pelo período informado e pode ser ajustada conforme negociação. Valores e condições sujeitos à alteração sem aviso prévio.</div><div class="quote">“Máquinas certas,<br>resultados maiores.”</div></div></section></div>
 <footer class="footer"><div class="contacts">☎ (98) 98421-8479 &nbsp; ✉ maqonapp@gmail.com &nbsp; in /maqon</div><div class="footerBrand"><img src="maqon-logo-original-aprovada.png" alt="MAQON"></div></footer></article></main></body></html>`;
 w.document.open(); w.document.write(html); w.document.close();
}
document.querySelector('#newProposal').onclick=()=>openProposal();document.querySelector('#cancelProposal').onclick=()=>pd.close();
pf.addEventListener('submit',e=>{e.preventDefault();const li=Number(document.querySelector('#proposalClient').value),ei=Number(document.querySelector('#proposalEquipment').value);if(!leads[li]||!equipments[ei])return;const l=leads[li],row={client:l[1],company:l[2],equipment:equipmentName(equipments[ei]),mode:document.querySelector('#proposalMode').value,scope:document.querySelector('#proposalScope').value.trim(),value:document.querySelector('#proposalValue').value,validity:document.querySelector('#proposalValidity').value,terms:document.querySelector('#proposalTerms').value.trim(),status:document.querySelector('#proposalStatus').value};if(editingProposal===null)proposals.unshift(row);else proposals[editingProposal]=row;persistProposals();renderProposals();pd.close()});
document.addEventListener('click',e=>{const ed=e.target.closest('[data-pr-edit]'),del=e.target.closest('[data-pr-delete]'),v=e.target.closest('[data-pr-view]');if(ed)openProposal(Number(ed.dataset.prEdit));if(v)viewProposal(Number(v.dataset.prView));if(del){const i=Number(del.dataset.prDelete);if(confirm(`Excluir a proposta ${proposalNumber(i)} de ${proposals[i].client}?`)){proposals.splice(i,1);persistProposals();renderProposals()}}});
document.querySelector('#proposalSearch').oninput=e=>{const q=e.target.value.toLowerCase();renderProposals(proposals.filter(p=>Object.values(p).join(' ').toLowerCase().includes(q)))};
const qp=[...document.querySelectorAll('.quick button')].find(b=>b.textContent.includes('Gerar Proposta'));if(qp)qp.onclick=()=>{go('propostas');openProposal()};
proposalOptions();renderProposals();


/* MAQON V1.3 — Integrações Sociais + camada segura Meta API */
const SOCIAL_KEY='maqon_social_integrations_v1';
const SOCIAL_DEFAULTS={
 whatsapp:'5598984218479',
 instagram:'',
 facebook:'',
 linkedin:'',
 hubspot:'',
 metaApiBase:'',
 metaApiKey:'',
 whatsappMessage:'Olá! Vim pela MAQON e gostaria de atendimento.'
};
function loadSocialSettings(){
 try{return {...SOCIAL_DEFAULTS,...(JSON.parse(localStorage.getItem(SOCIAL_KEY))||{})}}catch(e){return {...SOCIAL_DEFAULTS}}
}
function saveSocialSettings(data){localStorage.setItem(SOCIAL_KEY,JSON.stringify(data))}
function onlyDigits(v=''){return String(v).replace(/\D/g,'')}
function safeUrl(v=''){
 const x=String(v).trim(); if(!x)return '';
 try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)?u.href.replace(/\/$/,''):''}catch(e){return ''}
}
function setSocialLink(id,url,labelId,emptyText,statusId){
 const a=document.querySelector('#'+id),label=document.querySelector('#'+labelId),status=statusId?document.querySelector('#'+statusId):null;
 const clean=safeUrl(url);
 if(a){if(clean){a.href=clean;a.classList.remove('disabled-link')}else{a.removeAttribute('href');a.classList.add('disabled-link')}}
 if(label)label.textContent=clean?clean.replace(/^https?:\/\//,'').replace(/\/$/,''):emptyText;
 if(status){status.textContent=clean?'● Perfil configurado':'Configurar perfil';status.classList.toggle('connected',!!clean)}
}
function metaBase(){return safeUrl(loadSocialSettings().metaApiBase)}
function setMetaMessage(message,type=''){
 const el=document.querySelector('#metaApiMessage');if(!el)return;el.textContent=message;el.className='meta-api-message'+(type?' '+type:'');
}
function setMetaStatus(message,connected=false){
 const el=document.querySelector('#metaApiStatus');if(!el)return;el.textContent=message;el.classList.toggle('connected',connected);
}
async function metaFetch(path,options={}){
 const base=metaBase();if(!base)throw new Error('Configure a URL do backend seguro MAQON.');
 const key=loadSocialSettings().metaApiKey||'';
 const headers={'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(key?{'Authorization':'Bearer '+key}:{}),...(options.headers||{})};
 const r=await fetch(base+path,{...options,headers,credentials:'omit'});
 let data={};try{data=await r.json()}catch(e){}
 if(!r.ok)throw new Error(data.error||data.message||`Falha HTTP ${r.status}`);
 return data;
}
function renderMetaPages(pages=[],selectedPageId=''){
 const sel=document.querySelector('#metaPageSelect');if(!sel)return;
 if(!pages.length){sel.innerHTML='<option value="">Nenhuma Página disponível</option>';return}
 sel.innerHTML=pages.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(selectedPageId)?'selected':''}>${esc(p.name||p.id)}${p.instagram?.username?' — @'+esc(p.instagram.username):''}</option>`).join('');
}
async function refreshMetaStatus(showErrors=false){
 const base=metaBase();
 if(!base){setMetaStatus('Backend não configurado',false);renderMetaPages([]);return}
 try{
  setMetaStatus('Verificando...',false);
  const s=await metaFetch('/api/meta/status');
  const connected=!!s.connected;
  setMetaStatus(connected?'● Meta conectada':'Backend online • autorização pendente',connected);
  renderMetaPages(s.pages||[],s.selected_page?.id||'');
  if(connected){
   const fb=document.querySelector('#fbStatus'),ig=document.querySelector('#igStatus');
   if(fb){fb.textContent=`● API: ${s.selected_page?.name||'Meta conectada'}`;fb.classList.add('connected')}
   if(ig&&s.selected_page?.instagram?.username){ig.textContent=`● API: @${s.selected_page.instagram.username}`;ig.classList.add('connected')}
   setMetaMessage(s.webhook_subscribed===false?'Conta conectada. A inscrição de webhook ainda precisa ser concluída.':'OAuth ativo e backend seguro respondendo.','ok');
  }else setMetaMessage('Backend encontrado. Clique em “Conectar Meta” para autorizar Facebook/Instagram.');
  return s;
 }catch(err){setMetaStatus('● Backend indisponível',false);if(showErrors)setMetaMessage(err.message,'error');}
}
function renderSocialIntegrations(){
 const cfg=loadSocialSettings();
 const wa=onlyDigits(cfg.whatsapp)||SOCIAL_DEFAULTS.whatsapp;
 const waText=encodeURIComponent(cfg.whatsappMessage||SOCIAL_DEFAULTS.whatsappMessage);
 const waOpen=document.querySelector('#waOpen');if(waOpen)waOpen.href=`https://wa.me/${wa}?text=${waText}`;
 const waLabel=document.querySelector('#waLabel');if(waLabel)waLabel.textContent=wa===SOCIAL_DEFAULTS.whatsapp?'(98) 98421-8479':`+${wa}`;
 const fields={socialWhatsapp:cfg.whatsapp,socialInstagram:cfg.instagram,socialFacebook:cfg.facebook,socialLinkedin:cfg.linkedin,socialHubspot:cfg.hubspot,socialMetaApiBase:cfg.metaApiBase,socialMetaApiKey:cfg.metaApiKey,socialWhatsappMessage:cfg.whatsappMessage};
 Object.entries(fields).forEach(([id,v])=>{const el=document.querySelector('#'+id);if(el)el.value=v||''});
 setSocialLink('igOpen',cfg.instagram,'igLabel','Perfil ainda não configurado','igStatus');
 setSocialLink('fbOpen',cfg.facebook,'fbLabel','Página ainda não configurada','fbStatus');
 setSocialLink('liOpen',cfg.linkedin,'liLabel','Página/perfil ainda não configurado','liStatus');
 setSocialLink('hsOpen',cfg.hubspot,'hsLabel','Portal ainda não configurado','hsStatus');
 updateSocialLeadCounts();refreshMetaStatus(false);
}
function updateSocialLeadCounts(){
 const crm=loadCRMLeads();
 const origins=crm.length?crm.map(l=>String(l.origem||'')):leads.map(l=>String(l[7]||''));
 const aliases={Whatsapp:'WhatsApp',Instagram:'Instagram',Facebook:'Facebook',Linkedin:'LinkedIn','E-mail':'E-mail',Hubspot:'HubSpot'};
 Object.entries(aliases).forEach(([id,name])=>{const el=document.querySelector('#socialCount'+id);if(el)el.textContent=origins.filter(x=>x.toLowerCase()===name.toLowerCase()).length});
}
const saveSocialBtn=document.querySelector('#saveSocialSettings');
if(saveSocialBtn)saveSocialBtn.addEventListener('click',()=>{
 const data={
  whatsapp:onlyDigits(document.querySelector('#socialWhatsapp')?.value)||SOCIAL_DEFAULTS.whatsapp,
  instagram:safeUrl(document.querySelector('#socialInstagram')?.value),
  facebook:safeUrl(document.querySelector('#socialFacebook')?.value),
  linkedin:safeUrl(document.querySelector('#socialLinkedin')?.value),
  hubspot:safeUrl(document.querySelector('#socialHubspot')?.value),
  metaApiBase:safeUrl(document.querySelector('#socialMetaApiBase')?.value),
  metaApiKey:(document.querySelector('#socialMetaApiKey')?.value||'').trim(),
  whatsappMessage:(document.querySelector('#socialWhatsappMessage')?.value||SOCIAL_DEFAULTS.whatsappMessage).trim()
 };
 saveSocialSettings(data);renderSocialIntegrations();
 const original=saveSocialBtn.textContent;saveSocialBtn.textContent='✓ Integrações salvas';setTimeout(()=>saveSocialBtn.textContent=original,1800);
});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-social-lead]');if(b){
  const origin=b.dataset.socialLead||'Manual';openLead();
  const originEl=document.querySelector('#leadOrigin');if(originEl&&[...originEl.options].some(o=>o.value===origin))originEl.value=origin;
  const notes=document.querySelector('#leadNotes');if(notes)notes.value=`Lead originado pelo canal ${origin}.`;
  return;
 }
 if(e.target.closest('[data-meta-connect]'))startMetaConnect();
});
async function startMetaConnect(){
 const base=metaBase();if(!base){go('integracoes');document.querySelector('#socialMetaApiBase')?.focus();setMetaMessage('Informe a URL pública HTTPS do backend MAQON e clique em “Salvar integrações”.','error');return}
 try{const return_to=location.href.split('?')[0].split('#')[0]+'?meta=connected';setMetaMessage('Preparando autorização segura da Meta...');const r=await metaFetch('/api/meta/connect-url',{method:'POST',body:JSON.stringify({return_to})});if(!r.url)throw new Error('O backend não retornou a URL de autorização.');location.href=r.url}catch(err){setMetaMessage(err.message,'error')}
}
function fieldMap(item){
 const out={};(item.field_data||[]).forEach(f=>{const key=String(f.name||'').toLowerCase();const val=Array.isArray(f.values)?f.values.join(', '):String(f.values||'');out[key]=val});return out;
}
function pickField(m,names){for(const n of names){if(m[n])return m[n]}return ''}
function importMetaLeads(items=[]){
 let db;try{db=JSON.parse(localStorage.getItem('maqon_automation_v1'))||{}}catch(e){db={}};
 db.leads=Array.isArray(db.leads)?db.leads:[];db.events=Array.isArray(db.events)?db.events:[];
 const existing=new Set(db.leads.map(x=>String(x.metaLeadId||'')));let added=0;
 items.forEach(item=>{
  if(!item.id||existing.has(String(item.id)))return;
  const m=fieldMap(item),full=pickField(m,['full_name','nome_completo','name']),first=pickField(m,['first_name','primeiro_nome']),last=pickField(m,['last_name','sobrenome']);
  const nome=full||[first,last].filter(Boolean).join(' ')||'Lead Meta';
  const extras=Object.entries(m).filter(([k])=>!['full_name','nome_completo','name','first_name','primeiro_nome','last_name','sobrenome','email','phone_number','phone','telefone','company_name','company','empresa','city','cidade','state','estado'].includes(k)).map(([k,v])=>`${k}: ${v}`).join(' | ');
  const now=new Date().toISOString();
  db.leads.unshift({id:'META-'+String(item.id),metaLeadId:String(item.id),nome,empresa:pickField(m,['company_name','company','empresa']),whatsapp:pickField(m,['phone_number','phone','telefone']),email:pickField(m,['email']),cidade:pickField(m,['city','cidade']),estado:pickField(m,['state','estado']),tipoEquipamento:'',marcaModelo:'',compraLocacao:'Consultoria',orcamento:'',objetivo:'Lead recebido automaticamente por formulário Meta Lead Ads.',observacoes:[`Formulário Meta: ${item.form_name||item.form_id||'—'}`,extras].filter(Boolean).join(' | '),responsavel:'Equipe Comercial',origem:'Meta Lead Ads',status:'Novo Lead',atualizadoEm:item.created_time||now});
  db.events.unshift({tipo:'lead_meta_importado',leadId:'META-'+String(item.id),origem:'Meta Lead Ads',quando:now});existing.add(String(item.id));added++;
 });
 localStorage.setItem('maqon_automation_v1',JSON.stringify(db));return added;
}
const metaConnectBtn=document.querySelector('#metaConnectBtn');if(metaConnectBtn)metaConnectBtn.onclick=startMetaConnect;
const metaTestBtn=document.querySelector('#metaTestBtn');if(metaTestBtn)metaTestBtn.onclick=()=>refreshMetaStatus(true);
const metaSavePageBtn=document.querySelector('#metaSavePageBtn');if(metaSavePageBtn)metaSavePageBtn.onclick=async()=>{
 try{const page_id=document.querySelector('#metaPageSelect')?.value;if(!page_id)throw new Error('Selecione uma Página Meta.');setMetaMessage('Configurando Página e webhook...');const r=await metaFetch('/api/meta/select-page',{method:'POST',body:JSON.stringify({page_id})});setMetaMessage(r.webhook_subscribed?'Página selecionada e webhook leadgen ativado.':'Página selecionada. Verifique as permissões do webhook.','ok');await refreshMetaStatus(true)}catch(err){setMetaMessage(err.message,'error')}
};
const metaSyncBtn=document.querySelector('#metaSyncBtn');if(metaSyncBtn)metaSyncBtn.onclick=async()=>{
 try{setMetaMessage('Buscando Leads Ads na Meta...');await metaFetch('/api/meta/sync',{method:'POST',body:'{}'});const r=await metaFetch('/api/meta/leads');const added=importMetaLeads(r.leads||[]);render();setMetaMessage(`Sincronização concluída: ${added} novo(s) lead(s) importado(s) para o CRM MAQON.`, 'ok')}catch(err){setMetaMessage(err.message,'error')}
};
if(new URLSearchParams(location.search).get('meta')==='connected'){
 setTimeout(()=>{go('integracoes');history.replaceState({},'',location.pathname+location.hash);refreshMetaStatus(true)},50);
}
renderSocialIntegrations();


/* MAQON V1.4 — WhatsApp Business + IA OpenAI */
function setWaAiMessage(message,type=''){
 const el=document.querySelector('#waAiMessage');if(!el)return;el.textContent=message;el.className='meta-api-message'+(type?' '+type:'');
}
function setWaState(id,text,ok=false){const el=document.querySelector('#'+id);if(!el)return;el.textContent=text;el.classList.toggle('ok',!!ok)}
function renderWaConversations(items=[]){
 const el=document.querySelector('#waConversationList');if(!el)return;
 if(!items.length){el.innerHTML='<p class="muted">Nenhuma conversa sincronizada ainda.</p>';return}
 el.innerHTML=items.map(c=>`<div class="wa-conversation-item"><div><b>${esc(c.name||'Contato WhatsApp')}</b><small>${esc(c.wa_id||'')}</small></div><div><span>${c.handoff?'Aguardando humano':'IA/Atendimento'}</span><small>${esc(c.last_message?.text||'')}</small></div></div>`).join('');
}
async function refreshWhatsAppAiStatus(showErrors=false){
 if(!document.querySelector('#waAiStatus'))return;
 const base=metaBase();if(!base){document.querySelector('#waAiStatus').textContent='Backend não configurado';return}
 try{
  const s=await metaFetch('/api/whatsapp/status');
  setWaState('waCloudState',s.cloud_configured?'CONFIGURADA':'PENDENTE',s.cloud_configured);
  setWaState('waOpenAiState',s.openai_configured?'CONFIGURADA':'PENDENTE',s.openai_configured);
  setWaState('waAutomationState',s.ai_enabled?'ATIVA':'DESLIGADA',s.ai_enabled);
  const ids={waLeadCount:s.leads||0,waConversationCount:s.conversations||0,waHandoffCount:s.handoffs||0};Object.entries(ids).forEach(([id,v])=>{const e=document.querySelector('#'+id);if(e)e.textContent=v});
  const st=document.querySelector('#waAiStatus');if(st){st.textContent=s.ai_enabled?'● IA ativa':'● IA pronta para configuração';st.classList.toggle('connected',!!s.ai_enabled)}
  const toggle=document.querySelector('#waAiToggleBtn');if(toggle){toggle.textContent=s.ai_enabled?'Desativar IA':'Ativar IA';toggle.dataset.enabled=s.ai_enabled?'1':'0'}
  try{const c=await metaFetch('/api/whatsapp/conversations?limit=6');renderWaConversations(c.conversations||[])}catch(e){}
  if(showErrors)setWaAiMessage(`Backend respondeu. Cloud API: ${s.cloud_configured?'ok':'pendente'} • OpenAI: ${s.openai_configured?'ok':'pendente'} • Modelo: ${s.model||'—'}`,'ok');
  return s;
 }catch(err){const st=document.querySelector('#waAiStatus');if(st)st.textContent='● Backend indisponível';if(showErrors)setWaAiMessage(err.message,'error')}
}
function importWhatsAppLeads(items=[]){
 let db;try{db=JSON.parse(localStorage.getItem('maqon_automation_v1'))||{}}catch(e){db={}};
 db.leads=Array.isArray(db.leads)?db.leads:[];db.events=Array.isArray(db.events)?db.events:[];
 const existing=new Map(db.leads.map(x=>[String(x.whatsappLeadId||''),x]));let added=0,updated=0;
 items.forEach(item=>{
  if(!item.id)return;const key=String(item.id),now=new Date().toISOString();const data={whatsappLeadId:key,nome:item.nome||'Contato WhatsApp',empresa:item.empresa||'',whatsapp:item.whatsapp||'',email:item.email||'',cidade:item.cidade||'',estado:item.estado||'',tipoEquipamento:item.tipoEquipamento||'',marcaModelo:item.marcaModelo||'',compraLocacao:item.compraLocacao||'Consultoria',orcamento:item.orcamento||'',objetivo:item.objetivo||'Atendimento recebido pelo WhatsApp Business.',observacoes:[item.observacoes,item.ultimaMensagem?('Última mensagem: '+item.ultimaMensagem):''].filter(Boolean).join(' | '),responsavel:item.responsavel||'Equipe Comercial',origem:'WhatsApp',status:item.status||'Novo Lead',atualizadoEm:item.atualizadoEm||now,handoff:!!item.handoff};
  if(existing.has(key)){Object.assign(existing.get(key),data);updated++}else{db.leads.unshift({id:key,criadoEm:item.criadoEm||now,...data});added++}
  db.events.unshift({tipo:'lead_whatsapp_sincronizado',leadId:key,origem:'WhatsApp',quando:now});
 });
 localStorage.setItem('maqon_automation_v1',JSON.stringify(db));return {added,updated};
}
const waAiRefreshBtn=document.querySelector('#waAiRefreshBtn');if(waAiRefreshBtn)waAiRefreshBtn.onclick=()=>refreshWhatsAppAiStatus(true);
const waAiToggleBtn=document.querySelector('#waAiToggleBtn');if(waAiToggleBtn)waAiToggleBtn.onclick=async()=>{
 try{const current=waAiToggleBtn.dataset.enabled==='1';const r=await metaFetch('/api/whatsapp/automation',{method:'POST',body:JSON.stringify({enabled:!current})});setWaAiMessage(r.ai_enabled?'IA de atendimento ativada. Novas mensagens poderão ser respondidas automaticamente.':'IA de atendimento desativada.','ok');await refreshWhatsAppAiStatus(false)}catch(err){setWaAiMessage(err.message,'error')}
};
const waAiPreviewBtn=document.querySelector('#waAiPreviewBtn');if(waAiPreviewBtn)waAiPreviewBtn.onclick=async()=>{
 try{const message=document.querySelector('#waAiPreviewInput')?.value.trim();if(!message)throw new Error('Digite uma mensagem de teste.');setWaAiMessage('Gerando resposta de teste...');const r=await metaFetch('/api/ai/preview',{method:'POST',body:JSON.stringify({message})});setWaAiMessage('Resposta IA: '+r.reply,'ok')}catch(err){setWaAiMessage(err.message,'error')}
};
const waSyncCrmBtn=document.querySelector('#waSyncCrmBtn');if(waSyncCrmBtn)waSyncCrmBtn.onclick=async()=>{
 try{setWaAiMessage('Sincronizando leads do WhatsApp...');const r=await metaFetch('/api/whatsapp/leads');const out=importWhatsAppLeads(r.leads||[]);render();updateSocialLeadCounts();setWaAiMessage(`WhatsApp → CRM concluído: ${out.added} novo(s), ${out.updated} atualizado(s).`,'ok');await refreshWhatsAppAiStatus(false)}catch(err){setWaAiMessage(err.message,'error')}
};
setTimeout(()=>refreshWhatsAppAiStatus(false),100);
