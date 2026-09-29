(()=>{
const DATA='maqon_automation_v1', TASKS='maqon_tasks_v1';
const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v||d}catch(e){return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const iso=()=>new Date().toISOString();
const day=v=>v?new Date(v+'T12:00:00'):null;
const today=()=>{let d=new Date();d.setHours(0,0,0,0);return d};
const uid=()=> 'T-'+Date.now()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();

function statusClass(t){
 if(t.status==='Concluída')return'concluida';
 const d=day(t.data),h=today(); if(!d)return'';
 if(d<h)return'atrasada'; if(+d===+h)return'hoje'; return'';
}
function autoTasks(db,tasks){
 const keys=new Set(tasks.map(t=>t.autoKey).filter(Boolean));
 (db.leads||[]).forEach(l=>{
   const n=l.negociacao||{}, p=l.projeto||{};
   const add=(key,titulo,data,prioridade,origem)=>{
     if(data && !keys.has(key)){tasks.push({id:uid(),leadId:l.id,titulo,data,prioridade,status:'Pendente',origem,criadoEm:iso(),autoKey:key});keys.add(key)}
   };
   add('contato:'+l.id+':'+(n.proximoContato||''),'Próximo contato comercial',n.proximoContato,'Alta','Negociação');
   add('prazo:'+l.id+':'+(p.prazo||''),'Prazo do projeto',p.prazo,p.prioridade||'Normal','Pós-venda');
   add('entrega:'+l.id+':'+(p.entrega||p.dataEntrega||''),'Entrega prevista',p.entrega||p.dataEntrega,'Alta','Pós-venda');
 });
 write(TASKS,tasks); return tasks;
}
function render(){
 const db=read(DATA,{leads:[],events:[]}), leads=Array.isArray(db.leads)?db.leads:[];
 let tasks=read(TASKS,[]); if(!Array.isArray(tasks))tasks=[]; tasks=autoTasks(db,tasks);
 const pend=tasks.filter(t=>t.status!=='Concluída'), atras=pend.filter(t=>statusClass(t)==='atrasada'),
 hoje=pend.filter(t=>statusClass(t)==='hoje'), done=tasks.filter(t=>t.status==='Concluída');
 const opts=leads.map((l,i)=>`<option value="${esc(l.id)}" ${i===0?'selected':''}>${esc(l.nome||'Cliente')} — ${esc(l.empresa||'')}</option>`).join('');
 const app=document.getElementById('app');
 app.innerHTML=`<h1>MAQON — Central de Alertas e Tarefas</h1>
 <p>Controle de próximos contatos, prazos, entregas e pendências comerciais/operacionais.</p>
 <div class=grid><div class="card stat"><small>Pendentes</small><strong>${pend.length}</strong></div>
 <div class="card stat"><small>Vencendo hoje</small><strong>${hoje.length}</strong></div>
 <div class="card stat"><small>Atrasadas</small><strong>${atras.length}</strong></div>
 <div class="card stat"><small>Concluídas</small><strong>${done.length}</strong></div></div>
 <div class=card><h2>Nova tarefa / alerta</h2><div class=form>
 <div><label>Cliente</label><select id=lead>${opts||'<option value="">Geral / sem cliente</option>'}</select></div>
 <div><label>Tarefa</label><input id=title placeholder="Ex.: Retornar contato"></div>
 <div><label>Data</label><input id=date type=date></div>
 <div><label>Prioridade</label><select id=priority><option>Normal</option><option>Alta</option><option>Urgente</option><option>Baixa</option></select></div>
 <div class=wide><label>Observações</label><textarea id=notes></textarea></div>
 <div class="wide actions"><button id=add>REGISTRAR TAREFA</button><button class=secondary id=refresh>ATUALIZAR ALERTAS</button></div></div></div>
 <div class=card><h2>Tarefas e alertas</h2><div class=tablewrap>${tasks.length?`<table><thead><tr><th>Data</th><th>Cliente</th><th>Tarefa</th><th>Origem</th><th>Prioridade</th><th>Status</th><th>Ação</th></tr></thead><tbody>${
 tasks.slice().sort((a,b)=>(a.status==='Concluída')-(b.status==='Concluída')||String(a.data||'9999').localeCompare(String(b.data||'9999'))).map(t=>{
 const l=leads.find(x=>String(x.id)===String(t.leadId))||{}, c=statusClass(t);
 return `<tr><td>${esc(t.data||'Sem data')}</td><td><b>${esc(l.nome||'Geral')}</b><br><small>${esc(l.empresa||'')}</small></td><td>${esc(t.titulo)}${t.observacoes?`<br><small>${esc(t.observacoes)}</small>`:''}</td><td>${esc(t.origem||'Manual')}</td><td>${esc(t.prioridade||'Normal')}</td><td><span class="badge ${c}">${t.status==='Concluída'?'Concluída':c==='atrasada'?'Atrasada':c==='hoje'?'Hoje':'Pendente'}</span></td><td>${t.status!=='Concluída'?`<button data-done="${esc(t.id)}">CONCLUIR</button>`:'—'}</td></tr>`}).join('')
 }</tbody></table>`:'<div class=empty>Nenhuma tarefa registrada.</div>'}</div></div>`;
 document.getElementById('refresh').onclick=render;
 document.getElementById('add').onclick=()=>{
   const title=document.getElementById('title').value.trim(); if(!title){alert('Informe a tarefa.');return}
   tasks.push({id:uid(),leadId:document.getElementById('lead').value,titulo:title,data:document.getElementById('date').value,prioridade:document.getElementById('priority').value,status:'Pendente',origem:'Manual',observacoes:document.getElementById('notes').value.trim(),criadoEm:iso()});
   write(TASKS,tasks); render();
 };
 document.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{
   const t=tasks.find(x=>x.id===b.dataset.done); if(!t)return;
   t.status='Concluída';t.concluidoEm=iso();write(TASKS,tasks);
   const d=read(DATA,{leads:[],events:[]});d.events=d.events||[];d.events.push({tipo:'tarefa_concluida',leadId:t.leadId,quando:iso(),status:t.titulo});write(DATA,d);render();
 });
}
addEventListener('DOMContentLoaded',render);
})();