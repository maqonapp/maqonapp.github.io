/* MAQON V1.5.13 - Manutencao preventiva, corretiva e preditiva.
   Modulo independente: nao altera CRM, Propostas, Equipamentos ou os dados existentes.
   Registros armazenados localmente neste navegador (nao ha sincronizacao entre dispositivos).
*/
(() => {
  'use strict';
  const STORAGE_KEY = 'maqon_manutencao_v1';
  const EQUIPMENT_KEY = 'maqon_equipamentos_v1';
  const TYPES = { preventiva: 'Preventiva', corretiva: 'Corretiva', preditiva: 'Preditiva' };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const today = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  const dateBR = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '—';
  const money = value => value === '' || value == null ? '—' : Number(value).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const load = (key, fallback=[]) => { try { const result=JSON.parse(localStorage.getItem(key)); return Array.isArray(result)?result:fallback; } catch (_) { return fallback; } };
  const save = rows => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(rows)); return true; } catch (_) { alert('Não foi possível salvar no navegador. Verifique o armazenamento local.'); return false; } };
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mq-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const config = {
    preventiva: [
      ['atividade','Atividade / revisão programada','text',true,'Ex.: troca de filtros e óleo'],
      ['ultimaData','Data da última manutenção','date'],
      ['proximaData','Próxima manutenção prevista','date'],
      ['proximoHorimetro','Horímetro previsto (h)','number',false,'Ex.: 5000'],
      ['periodicidade','Periodicidade informada','text',false,'Ex.: a cada 250 horas (conforme plano do fabricante)'],
      ['custoPrevisto','Custo previsto (R$)','number'],
      ['custoReal','Custo realizado (R$)','number']
    ],
    corretiva: [
      ['falha','Falha / ocorrência','textarea',true,'Descreva a falha encontrada'],
      ['prioridade','Prioridade','select',true,['Baixa','Média','Alta','Crítica']],
      ['servico','Serviço executado / diagnóstico','textarea',false,'Descreva a intervenção ou o diagnóstico'],
      ['paradaHoras','Tempo de máquina parada (h)','number'],
      ['custoReal','Custo da intervenção (R$)','number'],
      ['conclusao','Data de conclusão','date']
    ],
    preditiva: [
      ['parametro','Parâmetro monitorado','text',true,'Ex.: vibração, temperatura, pressão, análise de óleo'],
      ['medicao','Valor medido','text',true,'Ex.: 75 °C ou 4,2 mm/s'],
      ['limite','Referência / limite técnico informado','text',false,'Informe apenas se houver dado confiável'],
      ['tendencia','Tendência observada','select',true,['Estável','Crescente','Decrescente','A avaliar']],
      ['risco','Nível de atenção','select',true,['Normal','Atenção','Alto','Crítico']],
      ['acao','Ação recomendada','textarea',false,'Descreva a recomendação técnica']
    ]
  };
  const field = ([name,label,kind,required=false,placeholder='']) => {
    const attr = `name="${name}" id="mqm-${name}" ${required?'required':''}`;
    const ph = typeof placeholder === 'string' && placeholder ? ` placeholder="${esc(placeholder)}"` : '';
    const control = kind==='textarea' ? `<textarea ${attr}${ph} rows="3"></textarea>`
      : kind==='select' ? `<select ${attr}>${placeholder.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`
      : `<input ${attr} type="${kind}"${ph}${kind==='number'?' min="0" step="any"':''}>`;
    return `<label class="mqm-field"><span>${esc(label)}${required?' *':''}</span>${control}</label>`;
  };
  let currentType='preventiva';
  let editingId=null;
  let currentFilter='todas';
  let records=load(STORAGE_KEY);
  let modal,form,list;
  function equipmentList(){
    return load(EQUIPMENT_KEY).filter(Array.isArray).map((eq,index)=>({key:`${index}|${eq[0]||''}|${eq[1]||''}|${eq[2]||''}`,name:`${eq[1]||'Fabricante'} ${eq[2]||'Modelo'} — ${eq[0]||'Equipamento'}`}));
  }
  function statusOptions(type){return type==='corretiva'?['Aberta','Em execução','Aguardando peça','Concluída','Cancelada']
    : type==='preventiva'?['Planejada','Programada','Em execução','Concluída','Cancelada']
    : ['Em acompanhamento','Atenção','Ação recomendada','Concluída','Cancelada'];}
  function makeStyles(){
    const s=document.createElement('style');s.id='maqon-manutencao-css';s.textContent=`
      #manutencao .mqm-action {margin-top:12px;display:block;width:100%;border:1px solid #b78908;background:linear-gradient(130deg,#ffe169,#edb600);color:#171500;padding:11px;border-radius:7px;font-weight:800;cursor:pointer;min-height:43px}
      #manutencao .mqm-action:hover {filter:brightness(1.07)}
      #manutencao .mqm-history {margin-top:18px;background:#0b1820;border:1px solid #33464c;border-radius:10px;padding:16px;color:#f5f7f8}
      #manutencao .mqm-top {display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap}
      #manutencao .mqm-stats {font-size:13px;color:#ffd23d;margin:8px 0 12px}
      #manutencao .mqm-filter {padding:9px;background:#07141b;color:white;border:1px solid #647680;border-radius:6px}
      #manutencao .mqm-scroll {overflow:auto;max-width:100%}
      #manutencao .mqm-table {width:100%;border-collapse:collapse;min-width:720px;font-size:13px}
      #manutencao .mqm-table th,#manutencao .mqm-table td {padding:10px 8px;border-bottom:1px solid #2d414b;text-align:left;vertical-align:top}
      #manutencao .mqm-table th {color:#f5cc38}
      #manutencao .mqm-row-action {border:1px solid #66777b;border-radius:5px;padding:7px 9px;margin:2px;background:#132b34;color:#fff;cursor:pointer}
      #manutencao .mqm-empty {color:#c2cbd1;padding:18px 2px}
      #mqm-dialog {border:1px solid #d4a52c;background:#f5f6f7;color:#18232a;padding:0;border-radius:12px;width:min(860px,calc(100vw - 20px));max-height:92vh;box-shadow:0 20px 90px #000b;overflow:hidden}
      #mqm-dialog::backdrop {background:#000b}
      #mqm-dialog * {box-sizing:border-box}
      #mqm-dialog .mqm-header {background:#10222c;color:white;padding:22px 25px 18px;border-bottom:4px solid #f5be20;display:flex;align-items:center;justify-content:space-between;gap:12px}
      #mqm-dialog .mqm-header small {display:block;color:#ffcd35;letter-spacing:1.3px;font-weight:900}
      #mqm-dialog .mqm-header h2 {font-size:24px;color:#fff;margin:4px 0}
      #mqm-dialog .mqm-close {background:#172f3b;color:#fff;border:1px solid #65777b;border-radius:8px;font-size:22px;min-width:42px;min-height:42px;cursor:pointer}
      #mqm-dialog form {margin:0;display:flex;flex-direction:column;max-height:calc(92vh - 112px)}
      #mqm-dialog .mqm-body {overflow:auto;padding:20px 25px;flex:1}
      #mqm-dialog .mqm-tabs {display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px}
      #mqm-dialog .mqm-tab {background:#e7ebed;color:#10212a;border:1px solid #b9c6ca;border-radius:6px;padding:10px 13px;font-weight:800;cursor:pointer}
      #mqm-dialog .mqm-tab[aria-pressed="true"] {background:#f3c128;border-color:#dca709}
      #mqm-dialog .mqm-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #mqm-dialog .mqm-field {display:flex;flex-direction:column;gap:6px;min-width:0;font-size:13px;font-weight:700;color:#273841}
      #mqm-dialog .mqm-field input,#mqm-dialog .mqm-field select,#mqm-dialog .mqm-field textarea {background:white;color:#14232c;border:1px solid #b6c5cc;border-radius:7px;width:100%;min-height:43px;padding:10px;font:inherit;font-weight:400}
      #mqm-dialog .mqm-field textarea {min-height:75px;resize:vertical}
      #mqm-dialog .mqm-field.mqm-full {grid-column:1/-1}
      #mqm-dialog .mqm-section {margin:20px 0 12px;background:linear-gradient(90deg,#ffe17a,#edb40a);border-radius:6px;padding:10px 12px;font-weight:900}
      #mqm-dialog .mqm-footer {display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:14px 25px;border-top:1px solid #c9d2d6;background:#f2f4f5}
      #mqm-dialog .mqm-footer button {border-radius:7px;padding:12px 17px;font-weight:800;cursor:pointer;border:1px solid #abb9c1;background:#e6eaed;color:#10232d}
      #mqm-dialog .mqm-footer button[type=submit] {background:#f5bd20;border-color:#d2a110;color:#121212}
      #mqm-dialog .mqm-note {font-size:12px;color:#52636c;margin-top:12px}
      @media(max-width:620px) {#mqm-dialog .mqm-grid {grid-template-columns:1fr}#mqm-dialog .mqm-header {padding:15px}#mqm-dialog .mqm-body {padding:15px}#mqm-dialog .mqm-footer {padding:12px}#mqm-dialog .mqm-header h2 {font-size:20px}}
    `;document.head.appendChild(s);
  }
  function makeModal(){
    modal=document.createElement('dialog');modal.id='mqm-dialog';modal.setAttribute('aria-label','Registro de manutenção MAQON');
    modal.innerHTML=`<div class="mqm-header"><div><small>MAQON | GESTÃO DE MANUTENÇÃO</small><h2 id="mqm-title">Nova manutenção</h2><div>Registros vinculados aos equipamentos cadastrados</div></div><button type="button" class="mqm-close" aria-label="Fechar">×</button></div>
      <form id="mqm-form"><div class="mqm-body"><div class="mqm-tabs" role="group" aria-label="Tipo de manutenção">
      ${Object.entries(TYPES).map(([k,v])=>`<button type="button" class="mqm-tab" data-mqm-tab="${k}" aria-pressed="false">${v}</button>`).join('')}</div>
      <div class="mqm-section">01 | Identificação do equipamento</div>
      <div class="mqm-grid"><label class="mqm-field mqm-full"><span>Equipamento cadastrado *</span><select name="equipamento" id="mqm-equipment" required></select></label>
      <label class="mqm-field"><span>Data do registro *</span><input name="data" type="date" required></label>
      <label class="mqm-field"><span>Responsável</span><input name="responsavel" type="text" placeholder="Nome do responsável"></label>
      <label class="mqm-field mqm-full"><span>Status *</span><select name="status" id="mqm-status" required></select></label></div>
      <div class="mqm-section" id="mqm-type-section">02 | Dados da manutenção</div><div class="mqm-grid" id="mqm-fields"></div>
      <div class="mqm-section">03 | Observações</div><div class="mqm-grid"><label class="mqm-field mqm-full"><span>Observações técnicas / histórico</span><textarea name="observacoes" rows="3" placeholder="Informações verificadas na operação"></textarea></label></div>
      <p class="mqm-note">* Campos obrigatórios. Datas, limites e periodicidades devem ser informados com base no plano de manutenção e em dados reais. Armazenamento local neste navegador.</p></div>
      <div class="mqm-footer"><button type="button" id="mqm-cancel">Cancelar</button><button type="submit">Salvar registro</button></div></form>`;
    document.body.appendChild(modal);
    form=modal.querySelector('#mqm-form');
    modal.querySelector('.mqm-close').addEventListener('click',()=>modal.close());
    modal.querySelector('#mqm-cancel').addEventListener('click',()=>modal.close());
    modal.querySelectorAll('[data-mqm-tab]').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.mqmTab)));
    form.addEventListener('submit',onSubmit);
  }
  function setType(type){
    if(!TYPES[type])return;
    currentType=type;
    modal.querySelector('#mqm-title').textContent=(editingId?'Editar':'Nova')+' manutenção '+TYPES[type].toLowerCase();
    modal.querySelectorAll('[data-mqm-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mqmTab===type)));
    modal.querySelector('#mqm-type-section').textContent=`02 | Manutenção ${TYPES[type]}`;
    modal.querySelector('#mqm-fields').innerHTML=config[type].map(field).join('');
    const status=modal.querySelector('#mqm-status');
    status.innerHTML=statusOptions(type).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  function fillEquipment(selected){
    const options=equipmentList();
    const sel=modal.querySelector('#mqm-equipment');
    sel.innerHTML='<option value="">Selecione o equipamento</option>'+options.map(e=>`<option value="${esc(e.key)}">${esc(e.name)}</option>`).join('');
    if(selected && !options.some(e=>e.key===selected.key))sel.insertAdjacentHTML('beforeend',`<option value="${esc(selected.key)}">${esc(selected.name)} (cadastro original não localizado)</option>`);
    if(selected)sel.value=selected.key;
  }
  function open(type,record=null){
    editingId=record?.id||null;
    form.reset();
    setType(type);
    fillEquipment(record?.equipment||null);
    form.elements.data.value=record?.data||today();
    if(record){
      for(const [key,value] of Object.entries(record.fields||{})) if(form.elements[key])form.elements[key].value=value==null?'':String(value);
      form.elements.responsavel.value=record.responsavel||'';
      form.elements.status.value=record.status||statusOptions(type)[0];
      form.elements.observacoes.value=record.observacoes||'';
    }
    window.MAQONMaintenanceDocuments?.open(editingId);
    if(!modal.open)modal.showModal();
  }
  async function onSubmit(event){
    event.preventDefault();
    if(!form.reportValidity())return;
    const eqKey=form.elements.equipamento.value;
    const options=equipmentList();
    const previous=records.find(r=>r.id===editingId);
    const eq=options.find(e=>e.key===eqKey)||previous?.equipment;
    if(!eq){alert('Selecione um equipamento cadastrado.');return;}
    const fields={};for(const [name] of config[currentType])fields[name]=String(form.elements[name]?.value||'').trim();
    const row={id:editingId||id(),type:currentType,equipment:{key:eq.key,name:eq.name},data:form.elements.data.value,responsavel:form.elements.responsavel.value.trim(),status:form.elements.status.value,observacoes:form.elements.observacoes.value.trim(),fields,updatedAt:new Date().toISOString()};
    const updated=editingId?records.map(r=>r.id===editingId?row:r):[row,...records];
    if(!save(updated))return;
    records=updated;modal.close();renderHistory();
    try { await window.MAQONMaintenanceDocuments?.commit(row.id); } catch(err) { alert("Registro salvo, mas houve falha ao salvar os anexos. Verifique o espaço disponível e tente novamente."); }
  }
  function description(r){const f=r.fields||{};return r.type==='preventiva'?f.atividade||'—':r.type==='corretiva'?f.falha||'—':`${f.parametro||'—'}: ${f.medicao||'—'}`;}
  function dueStatus(r){
    if(r.type!=='preventiva'||!r.fields?.proximaData||['Concluída','Cancelada'].includes(r.status))return r.status||'—';
    return r.fields.proximaData<today()?`Vencida · ${r.status}`:r.status;
  }
  function renderHistory(){
    records=load(STORAGE_KEY);
    const counts=Object.keys(TYPES).map(t=>`${TYPES[t]}: ${records.filter(r=>r.type===t).length}`).join(' · ');
    list.querySelector('.mqm-stats').textContent=`${records.length} registro(s) · ${counts}`;
    const filtered=records.filter(r=>currentFilter==='todas'||r.type===currentFilter).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    const tbody=list.querySelector('tbody');
    tbody.innerHTML=filtered.map(r=>`<tr><td>${esc(dateBR(r.data))}</td><td>${esc(TYPES[r.type]||r.type)}</td><td>${esc(r.equipment?.name||'—')}</td><td>${esc(description(r))}</td><td>${esc(dueStatus(r))}</td><td>${esc(r.responsavel||'—')}</td><td><button type="button" class="mqm-row-action" data-mqm-edit="${esc(r.id)}">Editar</button><button type="button" class="mqm-row-action" data-mqm-delete="${esc(r.id)}">Excluir</button></td></tr>`).join('');
    list.querySelector('.mqm-empty').hidden=filtered.length>0;
  }
  function makeHistory(section){
    list=document.createElement('div');list.className='mqm-history';list.innerHTML=`<div class="mqm-top"><h2 style="margin:0;color:#fff">Histórico de manutenções</h2><select class="mqm-filter" aria-label="Filtrar manutenções"><option value="todas">Todos os tipos</option>${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="mqm-stats"></div><div class="mqm-scroll"><table class="mqm-table"><thead><tr><th>Data</th><th>Tipo</th><th>Equipamento</th><th>Atividade / ocorrência</th><th>Status</th><th>Responsável</th><th>Ações</th></tr></thead><tbody></tbody></table></div><p class="mqm-empty">Nenhum registro encontrado. Clique em um dos botões acima para começar.</p>`;
    section.appendChild(list);
    list.querySelector('select').addEventListener('change',e=>{currentFilter=e.target.value;renderHistory()});
    list.addEventListener('click',e=>{
      const edit=e.target.closest('[data-mqm-edit]'),del=e.target.closest('[data-mqm-delete]');
      if(edit){const r=records.find(x=>x.id===edit.dataset.mqmEdit);if(r)open(r.type,r);}
      if(del){const r=records.find(x=>x.id===del.dataset.mqmDelete);if(r&&confirm(`Excluir registro de manutenção ${TYPES[r.type]} do equipamento ${r.equipment?.name||''}?`)){
        const updated=records.filter(x=>x.id!==r.id);if(save(updated)){records=updated;renderHistory();window.MAQONMaintenanceDocuments?.delete(r.id).catch(console.error);}
      }}
    });
  }
  function init(){
    const section=document.getElementById('manutencao');if(!section||document.getElementById('mqm-dialog'))return;
    makeStyles();makeModal();
    const cards=[...section.querySelectorAll('.modulecards > article')];
    Object.entries(TYPES).forEach(([type,label])=>{
      const card=cards.find(c=>c.querySelector('b')?.textContent.trim().toLowerCase()===label.toLowerCase());
      if(!card)return;
      const btn=document.createElement('button');btn.type='button';btn.className='mqm-action';btn.textContent=`+ Registrar manutenção ${label.toLowerCase()}`;
      btn.addEventListener('click',()=>open(type));card.appendChild(btn);
    });
    makeHistory(section);renderHistory();
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)renderHistory()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
