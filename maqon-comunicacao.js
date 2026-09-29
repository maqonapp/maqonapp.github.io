(function(){
const K='maqon_automation_v1';
const load=()=>{try{return JSON.parse(localStorage.getItem(K))||{leads:[],events:[]}}catch(e){return{leads:[],events:[]}}};
const save=d=>localStorage.setItem(K,JSON.stringify(d));
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function lead(){let d=load(),id=new URLSearchParams(location.search).get('lead');return d.leads.find(x=>x.id===id)||d.leads.find(x=>x.status==='Fechado')||d.leads[0]}
function phone(v){return String(v||'').replace(/\D/g,'').replace(/^0+/,'')}
function msg(l){return `Olá, ${l.nome||''}! Aqui é da MAQON Consultoria em Equipamentos Pesados.\n\nReferente ao seu atendimento para ${l.tipoEquipamento||'equipamento'} ${l.marcaModelo?('— '+l.marcaModelo):''}, estamos dando continuidade ao processo comercial.\n\nPodemos seguir com os próximos alinhamentos?`}
function render(){let l=lead(),a=document.getElementById('app');if(!l){a.innerHTML='<h2>Nenhum lead encontrado.</h2>';return}
let m=msg(l);a.innerHTML=`<h1>MAQON — Central de Comunicação</h1><p>Contato comercial a partir dos dados já registrados no CRM.</p>
<section><b>${esc(l.nome)}</b><span>${esc(l.empresa||'—')}</span><span>${esc(l.tipoEquipamento||'—')} | ${esc(l.marcaModelo||'—')}</span><span>${esc(l.whatsapp||'WhatsApp não informado')} | ${esc(l.email||'E-mail não informado')}</span></section>
<form id=f><label>Mensagem<textarea name=mensagem rows=8>${esc(m)}</textarea></label><div class=actions><button type=button id=wa>ABRIR WHATSAPP</button><button type=button id=mail>PREPARAR E-MAIL</button><button type=button id=log>REGISTRAR CONTATO</button></div></form><div id=ok></div>`;
wa.onclick=()=>{let p=phone(l.whatsapp);if(!p)return alert('Este lead não possui WhatsApp cadastrado.');if(p.length<=11)p='55'+p;record(l,'whatsapp');window.open('https://wa.me/'+p+'?text='+encodeURIComponent(f.mensagem.value),'_blank')};
mail.onclick=()=>{if(!l.email)return alert('Este lead não possui e-mail cadastrado.');record(l,'email');location.href='mailto:'+encodeURIComponent(l.email)+'?subject='+encodeURIComponent('MAQON — Atendimento Comercial')+'&body='+encodeURIComponent(f.mensagem.value)};
log.onclick=()=>{record(l,'manual');ok.innerHTML='<b>Contato registrado no histórico do lead.</b>'}
}
function record(l,canal){let d=load(),x=d.leads.find(a=>a.id===l.id),t=new Date().toISOString();x.ultimoContato={canal,quando:t};d.events.unshift({tipo:'contato_comercial',leadId:l.id,canal,quando:t});save(d)}
addEventListener('DOMContentLoaded',render)
})();