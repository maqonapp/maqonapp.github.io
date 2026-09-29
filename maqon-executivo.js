(()=>{'use strict';
const DATA='maqon_automation_v1',TASKS='maqon_tasks_v1';
const read=(k,fallback)=>{try{const x=JSON.parse(localStorage.getItem(k));return x===null?fallback:x}catch{return fallback}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const fmt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('pt-BR')};
const stage=l=>String(l.status||l.etapa||l.fase||'').toLocaleLowerCase('pt-BR').trim();
const isClosed=l=>stage(l)==='fechado'||stage(l)==='ganho';
const isProposal=l=>stage(l)==='proposta'||stage(l)==='em proposta';
const isQualified=l=>['qualificado','análise técnica','analise tecnica','proposta','negociação','negociacao','fechado','ganho'].includes(stage(l))||Number(l.score)>=70;
const eventName=t=>({lead_criado:'Lead criado',lead_criado_manual:'Lead criado',analise_salva:'Análise salva',analise_concluida:'Análise concluída',acompanhamento_salvo:'Acompanhamento salvo',enviado_negociacao:'Enviado para negociação',negocio_ganho:'Negócio fechado',contato_comercial:'Contato comercial',contato_atualizado:'Contato atualizado',projeto_salvo:'Projeto salvo',projeto_concluido:'Projeto concluído',tarefa_concluida:'Tarefa concluída'}[t]||String(t||'Evento').replaceAll('_',' '));
const cell=(name,n)=>`<div class="card stat"><small>${name}</small><strong>${n}</strong></div>`;
const table=(head,rows,empty)=>rows.length?`<div class="tablewrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<div class="empty">${empty}</div>`;
function render(){
 const db=read(DATA,{leads:[],events:[]}),leads=arr(db?.leads),events=arr(db?.events),tasks=arr(read(TASKS,[]));
 const pending=tasks.filter(t=>t.status!=='Concluída'),done=tasks.filter(t=>t.status==='Concluída');
 const today=new Date();today.setHours(0,0,0,0);
 const overdue=pending.filter(t=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(t.data||''))return false;const d=new Date(t.data+'T12:00:00');return d<today});
 const projects=leads.filter(l=>l.projeto&&typeof l.projeto==='object').length;
 const contacts=events.filter(e=>e.tipo==='contato_comercial').length;
 const byId=new Map(leads.map(l=>[String(l.id),l]));
 const recent=events.slice().sort((a,b)=>String(b.quando||'').localeCompare(String(a.quando||''))).slice(0,8);
 const upcoming=pending.slice().sort((a,b)=>String(a.data||'9999').localeCompare(String(b.data||'9999'))).slice(0,8);
 const links=[['CRM / Funil','maqon-crm.html'],['Análise Técnica','maqon-analise.html'],['Negociação','maqon-negociacao.html'],['Pós-venda','maqon-pos-venda.html'],['Comunicação','maqon-comunicacao.html'],['Histórico','maqon-historico.html'],['Alertas / Tarefas','maqon-alertas.html']];
 document.getElementById('app').innerHTML=`<div class="toolbar"><div><h1>MAQON — Painel Executivo / Command Center</h1><p>V9 · Indicadores consolidados dos módulos da plataforma</p></div><button id="refresh" type="button">ATUALIZAR PAINEL</button></div>
 <div class="grid">${cell('Total de leads',leads.length)}${cell('Qualificados+',leads.filter(isQualified).length)}${cell('Em proposta',leads.filter(isProposal).length)}${cell('Negócios fechados',leads.filter(isClosed).length)}${cell('Projetos criados',projects)}${cell('Tarefas pendentes',pending.length)}${cell('Tarefas atrasadas',overdue.length)}${cell('Tarefas concluídas',done.length)}</div>
 <div class="sections"><section class="card"><h2>Funil comercial</h2>${table(['Etapa','Leads'],['Novo Lead','Diagnóstico','Qualificado','Análise Técnica','Proposta','Negociação','Fechado'].map(s=>`<tr><td>${s}</td><td><strong>${leads.filter(l=>stage(l)===s.toLocaleLowerCase('pt-BR')).length}</strong></td></tr>`),'Nenhum lead cadastrado.')}</section>
 <section class="card"><h2>Próximas tarefas</h2>${table(['Data','Cliente','Tarefa','Prioridade'],upcoming.map(t=>{const l=byId.get(String(t.leadId))||{};return `<tr><td>${esc(t.data||'Sem data')}</td><td>${esc(l.nome||'Geral')}</td><td>${esc(t.titulo||'—')}</td><td><span class="badge">${esc(t.prioridade||'Normal')}</span></td></tr>`}),'Nenhuma tarefa pendente.')}</section>
 <section class="card"><h2>Atividades recentes</h2>${table(['Data / hora','Cliente','Evento'],recent.map(e=>{const l=byId.get(String(e.leadId))||{};return `<tr><td>${esc(fmt(e.quando))}</td><td>${esc(l.nome||'—')}</td><td>${esc(eventName(e.tipo))}</td></tr>`}),'Nenhuma atividade registrada.')}</section>
 <section class="card"><h2>Acesso aos módulos</h2><div class="links">${links.map(([label,url])=>`<a class="link secondary" href="${url}">${label}</a>`).join('')}</div><p class="notice">Contatos comerciais registrados: <strong>${contacts}</strong>. Os atalhos dependem dos arquivos de cada módulo estarem publicados na mesma pasta.</p><p class="notice">Os indicadores usam os registros salvos neste navegador. Para visualizar os mesmos dados, abra o painel no mesmo navegador e endereço GitHub Pages dos outros módulos.</p></section></div>`;
 document.getElementById('refresh').addEventListener('click',render);
}
window.addEventListener('DOMContentLoaded',render);
})();
