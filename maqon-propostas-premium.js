/* MAQON V1.5.12 — extensão isolada do formulário de propostas.
   Mantém app.js e suas chaves de armazenamento; não transmite dados a servidores. */
(function () {
  'use strict';
  const dialog = document.getElementById('proposalDialog');
  const form = document.getElementById('proposalForm');
  if (!dialog || !form) return;
  const $ = id => document.getElementById(id);
  const fields = ['Company','Contact','Email','Phone','City','Quantity','Location','Delivery','Warranty','Freight','Responsible','Notes','Demo'];
  const str = v => String(v == null ? '' : v);
  const esc = v => str(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => (Number(v) || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBR = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4) : str(v||'Não informado');
  const leadsList = () => typeof leads !== 'undefined' && Array.isArray(leads) ? leads : JSON.parse(localStorage.getItem('maqon_leads_v1') || '[]');
  const equipmentsList = () => typeof equipments !== 'undefined' && Array.isArray(equipments) ? equipments : JSON.parse(localStorage.getItem('maqon_equipamentos_v1') || '[]');
  const proposalsList = () => typeof proposals !== 'undefined' && Array.isArray(proposals) ? proposals : JSON.parse(localStorage.getItem('maqon_propostas_v1') || '[]');
  let editing = null;
  let lastPreview = null;

  function selectedLead() {
    const val = $('proposalClient').value;
    if (val === '') return null;
    return leadsList()[Number(val)] || null;
  }
  function selectedEquipment() {
    const val = $('proposalEquipment').value;
    if (val === '') return null;
    return equipmentsList()[Number(val)] || null;
  }
  function fillLead() {
    const l = selectedLead();
    if (!l) return;
    $('proposalCompany').value = l[2] || '';
    $('proposalContact').value = l[1] || '';
    $('proposalEmail').value = l[8] || '';
    $('proposalPhone').value = l[3] || '';
    $('proposalCity').value = [l[9],l[10]].filter(Boolean).join(' / ');
    $('proposalResponsible').value = l[14] || '';
  }
  function updateEquipment() {
    const box = $('proposalEquipmentInfo');
    const x = selectedEquipment();
    if (!x) { box.textContent = 'Selecione um equipamento para visualizar as características cadastradas.'; return; }
    const title = document.createElement('strong');
    title.textContent = [x[1],x[2]].filter(Boolean).join(' ') + ' — ' + (x[0] || 'Categoria não informada');
    const values = [
      ['Ano',x[3]],['Horímetro',x[4] ? x[4]+' h' : ''],
      ['Valor cadastrado',x[5] ? money(x[5]) : ''],
      ['Disponibilidade',x[8] ? x[8]+'%' : '']
    ];
    box.replaceChildren(title);
    values.forEach(([name,value]) => { if (!value) return; const span=document.createElement('span'); span.textContent=name+': '+value; box.append(span); });
  }
  function setDetails(d) {
    fields.forEach(name => {
      const el = $('proposal'+name); if (!el) return;
      if (name === 'Demo') el.checked = d.demo !== false;
      else if (name === 'Quantity') el.value = d.quantity || 1;
      else el.value = d[name.toLowerCase()] || '';
    });
  }
  function readDetails() {
    const d = {};
    fields.forEach(name => {
      const el = $('proposal'+name); if (!el) return;
      d[name.toLowerCase()] = name === 'Demo' ? el.checked : str(el.value).trim();
    });
    return d;
  }
  function defaultDetails() {
    fields.forEach(name => { const el=$('proposal'+name); if (el) { if (name==='Demo') el.checked=true; else el.value=name==='Quantity'?'1':''; } });
    fillLead(); updateEquipment();
  }
  function afterDialogOpened() {
    if (!dialog.open) return;
    if (editing !== null && proposalsList()[editing]) {
      const p = proposalsList()[editing];
      defaultDetails();
      setDetails(p.details || {});
      if (!p.details) fillLead();
    } else defaultDetails();
    updateEquipment();
  }
  const observer = new MutationObserver(() => { if (dialog.open) afterDialogOpened(); });
  observer.observe(dialog, {attributes:true, attributeFilter:['open']});
  $('proposalClient').addEventListener('change', fillLead);
  $('proposalEquipment').addEventListener('change', updateEquipment);
  $('proposalCloseX').addEventListener('click', () => dialog.close());

  // Rastreia a operação sem substituir os manipuladores originais de app.js.
  document.addEventListener('click', e => {
    const edit = e.target.closest('[data-pr-edit]');
    if (edit) { editing = Number(edit.dataset.prEdit); return; }
    if (e.target.closest('#newProposal') || (e.target.closest('.quick button') && e.target.textContent.includes('Gerar Proposta'))) editing = null;
  }, true);

  // O evento de captura lê os campos; app.js salva a proposta no evento normal.
  // A microtarefa acrescenta os detalhes ao MESMO registro em memória e no localStorage.
  form.addEventListener('submit', () => {
    const details = readDetails();
    const index = editing;
    queueMicrotask(() => {
      const list = proposalsList();
      const pos = index === null ? 0 : index;
      if (!list[pos]) return;
      const previous = list[pos].details || {};
      list[pos].details = { ...details, reference: previous.reference || createReference(), updatedAt: new Date().toISOString() };
      if (typeof persistProposals === 'function') persistProposals();
      else localStorage.setItem('maqon_propostas_v1', JSON.stringify(list));
      editing = null;
    });
  }, true);

  function createReference() {
    const d=new Date(), stamp=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    return 'MAQ-PR-'+stamp+'-'+Date.now().toString(36).slice(-5).toUpperCase();
  }
  function fromForm() {
    const lead=selectedLead(),eq=selectedEquipment();
    return {
      client: lead?.[1] || '', company: lead?.[2] || '',
      equipment: eq ? [eq[1],eq[2],'—',eq[0]].filter(Boolean).join(' ') : '',
      equipmentData: eq,
      mode: $('proposalMode').value, scope: $('proposalScope').value.trim(),
      value: $('proposalValue').value, validity: $('proposalValidity').value,
      terms: $('proposalTerms').value.trim(), status: $('proposalStatus').value,
      details: readDetails()
    };
  }
  function equipmentFor(p) {
    if (p.equipmentData) return p.equipmentData;
    return equipmentsList().find(x => str(p.equipment).includes(str(x[1])+' '+str(x[2]))) || null;
  }

  function previewHTML(p) {
    const d = p.details || {};
    const eq = equipmentFor(p);
    const ref = d.reference || 'PRÉVIA — SEM NÚMERO';
    const logo = new URL('maqon-logo-original-aprovada.png', location.href).href;
    const field = (label,value) => `<div class="cell"><small>${esc(label)}</small><strong>${esc(value || 'Não informado')}</strong></div>`;
    const section = (title,content) => `<section class="section"><h2>${esc(title)}</h2>${content}</section>`;
    const info = (label,value) => `<tr><th>${esc(label)}</th><td>${esc(value || 'Não informado')}</td></tr>`;
    const status = p.status || 'Rascunho';
    const disclaimer = d.demo !== false ? '<div class="demo">DADOS FICTÍCIOS — DOCUMENTO DE DEMONSTRAÇÃO</div>' : '';
    const isDraft = status === 'Rascunho' ? '<div class="draft">RASCUNHO — NÃO ENVIADO AO CLIENTE</div>' : '';
    const scope = p.scope || 'Escopo não informado. Preencha a descrição antes de enviar ao cliente.';
    const terms = p.terms || 'Condições de pagamento não informadas.';
    const contactName = d.contact || p.client;
    const equipmentLabel = eq ? [eq[1],eq[2]].filter(Boolean).join(' ') : p.equipment;
    const eqTable = eq ? [
      info('Categoria',eq[0]), info('Fabricante',eq[1]), info('Modelo',eq[2]),
      info('Ano',eq[3]), info('Horímetro',eq[4] ? eq[4]+' h' : ''),
      info('Situação cadastrada',eq[9])
    ].join('') : info('Equipamento',p.equipment);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ref)} | Proposta MAQON</title><style>
@page{size:A4;margin:15mm 14mm}*{box-sizing:border-box}body{margin:0;background:#e7ebee;color:#17242c;font:13px/1.48 Arial,Helvetica,sans-serif}
.toolbar{position:sticky;top:0;z-index:2;background:#0d181f;color:white;display:flex;justify-content:space-between;align-items:center;gap:15px;padding:13px 24px}.toolbar button{border:0;background:#f6c12b;color:#141414;border-radius:6px;font-weight:900;padding:11px 16px;cursor:pointer}
.paper{width:210mm;min-height:297mm;margin:22px auto;background:#fff;padding:0 16mm 15mm;box-shadow:0 12px 35px #0002;overflow-wrap:anywhere}
.top{margin:0 -16mm 19px;padding:19px 16mm;background:#101b21;color:white;border-bottom:5px solid #e8b318;display:flex;justify-content:space-between;gap:20px;align-items:center}
.brand img{display:block;width:165px;max-height:67px;object-fit:contain}.top h1{font-size:20px;line-height:1.1;margin:0 0 6px}.top p{margin:0;color:#e2c66a;font-size:11px}.meta{text-align:right;min-width:180px;font-size:11px}.meta b{display:block;font-size:12px}
.demo,.draft{padding:9px 13px;margin:0 0 12px;background:#fff4cf;border-left:4px solid #b58400;color:#5d4200;font-weight:900;font-size:11px;letter-spacing:.5px}
.draft{background:#e8eff3;border-color:#4b6774;color:#304653}
.intro{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin:10px 0 18px}.intro h2{margin:0;font-size:24px}.intro p{margin:3px 0 0;color:#68767e}
.section{margin:16px 0 0;break-inside:avoid-page}.section h2{font-size:13px;letter-spacing:.4px;background:#f1bd23;color:#17242c;margin:0 0 9px;padding:8px 10px}
.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}.cell{padding:8px 10px;background:#f0f3f5;min-width:0}.cell small{display:block;color:#64737c;font-size:10px;font-weight:800;text-transform:uppercase}.cell strong{display:block;margin-top:3px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 9px;border-bottom:1px solid #e1e7e9;text-align:left;vertical-align:top}th{width:38%;color:#50616b;background:#f5f7f8}
.price{background:#101e26;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;gap:12px;align-items:center}.price span{font-size:11px;color:#e4d092;font-weight:800}.price strong{font-size:24px;color:#ffd34e}
.copy{margin:0;padding:11px 12px;background:#f3f6f7;border-left:3px solid #e0ae1b;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}
.note{margin-top:20px;padding-top:10px;border-top:1px solid #d7dfe2;color:#64737b;font-size:10px}.footer{margin-top:20px;padding:10px 0;border-top:2px solid #dfb01e;display:flex;justify-content:space-between;gap:10px;font-size:10px;color:#485b65}
@media print{html,body{background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.top{margin:0 0 17px;padding:14px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.section h2,.price,.cell,.copy,.demo,.draft{print-color-adjust:exact;-webkit-print-color-adjust:exact}.section{break-inside:avoid-page}.footer{break-inside:avoid-page}}
@media screen and (max-width:800px){.paper{width:100%;margin:0;padding:0 16px 20px}.top{margin:0 -16px 15px;padding:15px}.brand img{width:100px}.meta{min-width:0}.info-grid{grid-template-columns:1fr}.toolbar{padding:10px}}
</style></head><body>
<div class="toolbar"><span>MAQON — Pré-visualização comercial</span><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>
<article class="paper"><header class="top"><div class="brand"><img src="${esc(logo)}" alt="MAQON"><p>CONSULTORIA EM EQUIPAMENTOS PESADOS</p></div><div class="meta"><h1>PROPOSTA<br>COMERCIAL</h1><b>${esc(ref)}</b>Emissão: ${esc(new Date().toLocaleDateString('pt-BR'))}</div></header>
${disclaimer}${isDraft}
<div class="intro"><div><h2>${esc(equipmentLabel)}</h2><p>${esc(p.mode)} | Quantidade: ${esc(d.quantity || '1')}</p></div></div>
${section('01 · IDENTIFICAÇÃO DO CLIENTE', `<div class="info-grid">${field('Cliente / Lead',p.client)}${field('Empresa / Razão social',d.company || p.company)}${field('Contato',contactName)}${field('E-mail',d.email)}${field('Telefone',d.phone)}${field('Cidade / UF',d.city)}</div>`)}
${section('02 · EQUIPAMENTO E FORNECIMENTO', `<table>${eqTable}${info('Quantidade',d.quantity || '1')}${info('Modalidade',p.mode)}${info('Local de entrega / operação',d.location)}${info('Prazo de entrega / mobilização',d.delivery)}</table>`)}
${section('03 · CONDIÇÕES COMERCIAIS', `<div class="price"><span>VALOR TOTAL DA PROPOSTA</span><strong>${esc(money(p.value))}</strong></div><table>${info('Validade',dateBR(p.validity))}${info('Pagamento / condições',terms)}${info('Garantia / suporte',d.warranty)}${info('Frete / mobilização',d.freight)}</table>`)}
${section('04 · ESCOPO / DESCRIÇÃO', `<p class="copy">${esc(scope)}</p>`)}
${section('05 · CONTROLE E CONSIDERAÇÕES', `<table>${info('Situação da proposta',status)}${info('Elaboração',d.responsible)}${info('Referência',ref)}</table>`)}
<p class="note">Documento preparado com informações cadastradas na MAQON. Valores, prazos e condições devem ser conferidos pelo responsável antes de envio ou assinatura. Observações internas não são incluídas neste documento.</p>
<div class="footer"><b>MAQON | Compare. Calcule. Decida.</b><span>maqonapp@gmail.com | (98) 98421-8479</span></div></article></body></html>`;
  }

  function openPreview(p) {
    const w = window.open('', '_blank');
    if (!w) { alert('Autorize pop-ups para visualizar a proposta.'); return; }
    w.document.open(); w.document.write(previewHTML(p)); w.document.close();
    lastPreview = w;
  }
  $('proposalPreviewPdf').addEventListener('click', () => {
    if (!form.reportValidity()) return;
    const p = fromForm();
    if (!p.client || !p.equipmentData) { alert('Selecione cliente e equipamento cadastrados.'); return; }
    if (editing !== null && proposalsList()[editing]) p.details.reference = proposalsList()[editing].details?.reference || '';
    openPreview(p);
  });

  // A visualização existente da tabela passa a utilizar o novo modelo de proposta,
  // incluindo os campos extras. A edição/exclusão continuam sob controle de app.js.
  document.addEventListener('click', e => {
    const view = e.target.closest('[data-pr-view]');
    if (!view) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const p = proposalsList()[Number(view.dataset.prView)];
    if (p) openPreview(p);
  }, true);

  window.MAQON_PROPOSTAS_PREMIUM_V1512 = { previewHTML, readDetails, version: '1.5.12' };
})();
