/* MAQON V1.6.9 - Cadastro de equipamentos de homologação com RLS Supabase */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg=window.MAQON_SUPABASE_CONFIG || {};
  const showError=m=>{$('error').textContent=m||''};
  const notice=m=>{$('notice').textContent=m||''};
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||'') || !String(cfg.publishableKey||'').startsWith('sb_publishable_') || !window.supabase?.createClient){showError('Configuração Supabase indisponível. Confira URL, publishable key e conexão de rede.');return;}
  const db=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let companyId=null, userId=null, equipment=[], proposals=[], leads=[], maintenances=[], editingMaintenance=null, editing=null, editingProposal=null, editingLead=null, serial=0;
  function lock(){++serial;companyId=null;userId=null;equipment=[];proposals=[];leads=[];maintenances=[];editingMaintenance=null;editing=null;editingProposal=null;editingLead=null;$('workspace').style.display='none';$('login').style.display='block';$('login-password').value='';}
  function safeYear(){const v=$('year').value.trim();if(!v)return null;const n=Number(v);if(!Number.isInteger(n)||n<1900||n>2200)throw Error('Informe um ano válido (1900 a 2200).');return n;}
  function payload(){const categoria=$('category').value.trim(),fabricante=$('manufacturer').value.trim(),modelo=$('model').value.trim();if(!categoria||!fabricante||!modelo)throw Error('Preencha categoria, fabricante e modelo.');return {categoria,fabricante,modelo,ano:safeYear(),prefixo:$('prefix').value.trim()||null,situacao:$('status').value};}
  function clearEditor(){editing=null;$('equipment-form').reset();$('form-title').textContent='Cadastrar equipamento de teste';$('save').textContent='Salvar equipamento';$('cancel').hidden=true;}
  function draw(){
    $('count').textContent=String(equipment.length);$('status-text').textContent='Registros obtidos pela API Supabase para a empresa autenticada.';
    const tbody=$('equipment-rows');tbody.replaceChildren();
    for(const rec of equipment){const tr=document.createElement('tr');for(const prop of ['categoria','fabricante','modelo','ano','prefixo','situacao']){const td=document.createElement('td');td.textContent=rec[prop]??'—';tr.append(td)}
      const cell=document.createElement('td');const edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.addEventListener('click',()=>editRecord(rec.id));cell.append(edit);tr.append(cell);tbody.append(tr);}
    if(!equipment.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='Nenhum equipamento de teste nesta empresa.';tr.append(td);tbody.append(tr);}
  }
  async function refresh(){if(!companyId)throw Error('Empresa não identificada.');const company=companyId;const result=await db.from('maqon_equipamentos').select('id,empresa_id,categoria,fabricante,modelo,ano,prefixo,situacao').eq('empresa_id',company).order('modelo');if(result.error)throw Error('Erro ao carregar equipamentos: '+result.error.message);if(company!==companyId)return;if(result.data?.some(x=>x.empresa_id!==company))throw Error('Inconsistência de isolamento detectada.');equipment=result.data||[];draw();renderMaintenanceEquipment();}
  function proposalNotice(m){$('proposal-notice').textContent=m||'';}
  function proposalPayload(){
    const cliente_nome=$('proposal-client').value.trim(), titulo=$('proposal-title').value.trim();
    if(!cliente_nome||!titulo)throw Error('Informe cliente e título da proposta.');
    const numero=$('proposal-number').value.trim(),modalidade=$('proposal-type').value.trim();
    if(!numero||!modalidade)throw Error('Preencha número e modalidade da proposta. O texto cinza é apenas um exemplo.');
    const raw=$('proposal-value').value.trim();
    const value=raw===''?null:Number(raw);
    if(value!==null&&(!Number.isFinite(value)||value<0||value>999999999999))throw Error('Valor total inválido.');
    return {cliente_nome,titulo,numero,modalidade,valor_total:value,validade_ate:$('proposal-expiry').value||null,status:$('proposal-status').value};
  }
  function clearProposal(){editingProposal=null;$('proposal-form').reset();$('proposal-form-title').textContent='Cadastrar proposta comercial de teste';$('proposal-save').textContent='Salvar proposta';$('proposal-cancel').hidden=true;}
  function drawProposals(){
    $('proposal-count').textContent=String(proposals.length);
    $('proposal-status-text').textContent='Registros retornados pela API para a empresa autenticada.';
    const tbody=$('proposal-rows');tbody.replaceChildren();
    for(const rec of proposals){const tr=document.createElement('tr');
      const vals=[rec.numero,rec.cliente_nome,rec.titulo,rec.modalidade,rec.valor_total==null?'—':Number(rec.valor_total).toLocaleString('pt-BR',{minimumFractionDigits:2}),rec.validade_ate,rec.status];
      for(const val of vals){const td=document.createElement('td');td.textContent=val??'—';tr.append(td);}
      const cell=document.createElement('td'),edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.addEventListener('click',()=>editProposal(rec.id));cell.append(edit);tr.append(cell);tbody.append(tr);
    }
    if(!proposals.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Nenhuma proposta de teste nesta empresa.';tr.append(td);tbody.append(tr);}
  }
  async function refreshProposals(){
    if(!companyId)throw Error('Empresa não identificada.');
    const company=companyId;
    const r=await db.from('maqon_propostas').select('id,empresa_id,numero,cliente_nome,titulo,modalidade,valor_total,validade_ate,status').eq('empresa_id',company).order('criado_em',{ascending:false});
    if(r.error)throw Error('Erro ao carregar propostas: '+r.error.message);
    if(company!==companyId)return;
    if(r.data?.some(x=>x.empresa_id!==company))throw Error('Inconsistência de isolamento de propostas detectada.');
    proposals=r.data||[];drawProposals();
  }
  function editProposal(id){const rec=proposals.find(x=>x.id===id);if(!rec)return;editingProposal=rec.id;
    $('proposal-client').value=rec.cliente_nome||'';$('proposal-title').value=rec.titulo||'';$('proposal-number').value=rec.numero||'';$('proposal-type').value=rec.modalidade||'';
    $('proposal-value').value=rec.valor_total??'';$('proposal-expiry').value=rec.validade_ate||'';$('proposal-status').value=rec.status||'rascunho';
    $('proposal-form-title').textContent='Editar proposta de teste';$('proposal-save').textContent='Salvar edição';$('proposal-cancel').hidden=false;proposalNotice('Editando proposta desta empresa.');$('proposal-form').scrollIntoView({behavior:'smooth'});
  }

  function leadNotice(m){$('lead-notice').textContent=m||'';}
  function leadPayload(){
    const nome=$('lead-name').value.trim();if(nome.length<2)throw Error('Informe o nome do contato fictício.');
    return {nome,empresa_cliente:$('lead-company').value.trim()||null,email:$('lead-email').value.trim()||null,telefone:$('lead-phone').value.trim()||null,equipamento_interesse:$('lead-equipment').value.trim()||null,origem:$('lead-origin').value.trim()||null,etapa:$('lead-stage').value,observacoes:$('lead-notes').value.trim()||null};
  }
  function clearLead(){editingLead=null;$('lead-form').reset();$('lead-form-title').textContent='Cadastrar lead de teste';$('lead-save').textContent='Salvar lead';$('lead-cancel').hidden=true;}
  function drawLeads(){
    $('lead-count').textContent=String(leads.length);$('lead-status-text').textContent='Registros recebidos do Supabase para a empresa autenticada.';
    const tbody=$('lead-rows');tbody.replaceChildren();
    for(const rec of leads){const tr=document.createElement('tr');
      for(const key of ['nome','empresa_cliente','email','telefone','equipamento_interesse','origem','etapa']){const td=document.createElement('td');td.textContent=rec[key]??'—';tr.append(td)}
      const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Editar';button.addEventListener('click',()=>editLead(rec.id));td.append(button);tr.append(td);tbody.append(tr);
    }
    if(!leads.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Nenhum lead de teste nesta empresa.';tr.append(td);tbody.append(tr);}
  }
  async function refreshLeads(){
    if(!companyId)throw Error('Empresa não identificada.');const company=companyId;
    const r=await db.from('maqon_leads').select('id,empresa_id,nome,empresa_cliente,email,telefone,equipamento_interesse,origem,etapa,observacoes').eq('empresa_id',company).order('criado_em',{ascending:false});
    if(r.error)throw Error('Erro ao consultar leads: '+r.error.message+'. Confira se a tabela está exposta na Data API com RLS ativo.');
    if(company!==companyId)return;if(r.data?.some(x=>x.empresa_id!==company))throw Error('Isolamento de leads inconsistente.');
    leads=r.data||[];drawLeads();
  }
  function editLead(id){const rec=leads.find(x=>x.id===id);if(!rec)return;editingLead=rec.id;
    for(const [input,key] of [['lead-name','nome'],['lead-company','empresa_cliente'],['lead-email','email'],['lead-phone','telefone'],['lead-equipment','equipamento_interesse'],['lead-origin','origem'],['lead-stage','etapa'],['lead-notes','observacoes']])$(input).value=rec[key]??'';
    $('lead-form-title').textContent='Editar lead de teste';$('lead-save').textContent='Salvar edição';$('lead-cancel').hidden=false;leadNotice('Editando registro desta empresa.');$('lead-form').scrollIntoView({behavior:'smooth'});
  }

  function maintenanceNotice(m){$('maintenance-notice').textContent=m||'';}
  function renderMaintenanceEquipment(){
    const select=$('maintenance-equipment');const prior=select.value;select.replaceChildren();
    const first=document.createElement('option');first.value='';first.textContent='Selecione um equipamento';select.append(first);
    for(const item of equipment){const option=document.createElement('option');option.value=item.id;option.textContent=[item.categoria,item.fabricante,item.modelo,item.prefixo].filter(Boolean).join(' • ');select.append(option);}
    if(equipment.some(x=>x.id===prior))select.value=prior;
  }
  function maintenancePayload(){
    const equipamento_id=$('maintenance-equipment').value;
    if(!equipment.some(x=>x.id===equipamento_id))throw Error('Selecione equipamento autorizado desta empresa.');
    const atividade_ocorrencia=$('maintenance-activity').value.trim();if(!atividade_ocorrencia)throw Error('Informe a atividade/ocorrência.');
    const data_registro=$('maintenance-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(data_registro))throw Error('Informe a data de registro.');
    const raw=$('maintenance-cost').value.trim();const custo_previsto=raw?Number(raw):null;
    if(custo_previsto!==null&&(!Number.isFinite(custo_previsto)||custo_previsto<0||custo_previsto>999999999999))throw Error('Custo previsto inválido.');
    return {equipamento_id,tipo:$('maintenance-type').value,status:$('maintenance-status').value,data_registro,atividade_ocorrencia,
      responsavel:$('maintenance-owner').value.trim()||null,prioridade:$('maintenance-priority').value||null,
      data_proxima:$('maintenance-next').value||null,custo_previsto,
      diagnostico:$('maintenance-diagnosis').value.trim()||null,acao_recomendada:$('maintenance-action').value.trim()||null,
      observacoes:$('maintenance-notes').value.trim()||null};
  }
  function clearMaintenance(){editingMaintenance=null;$('maintenance-form').reset();$('maintenance-form-title').textContent='Cadastrar manutenção de teste';$('maintenance-save').textContent='Salvar manutenção';$('maintenance-cancel').hidden=true;renderMaintenanceEquipment();$('maintenance-date').value=new Date().toLocaleDateString('en-CA');}
  function drawMaintenances(){
    $('maintenance-count').textContent=String(maintenances.length);$('maintenance-status-text').textContent='Registros retornados pelo Supabase para a empresa autenticada.';
    const tbody=$('maintenance-rows');tbody.replaceChildren();
    for(const rec of maintenances){const tr=document.createElement('tr');const machine=equipment.find(x=>x.id===rec.equipamento_id);
      const vals=[machine?[machine.fabricante,machine.modelo,machine.prefixo].filter(Boolean).join(' • '):'Equipamento',rec.tipo,rec.data_registro,rec.status,rec.atividade_ocorrencia,rec.responsavel,rec.prioridade];
      for(const val of vals){const cell=document.createElement('td');cell.textContent=val??'—';tr.append(cell);}
      const action=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Editar';button.addEventListener('click',()=>editMaintenance(rec.id));action.append(button);tr.append(action);tbody.append(tr);
    }
    if(!maintenances.length){const tr=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=8;cell.textContent='Nenhuma manutenção fictícia nesta empresa.';tr.append(cell);tbody.append(tr);}
  }
  async function refreshMaintenances(){
    if(!companyId)throw Error('Empresa não identificada.');const company=companyId;
    const r=await db.from('maqon_manutencoes').select('id,empresa_id,equipamento_id,tipo,status,data_registro,responsavel,atividade_ocorrencia,diagnostico,acao_recomendada,prioridade,data_proxima,custo_previsto,observacoes').eq('empresa_id',company).order('criado_em',{ascending:false});
    if(r.error)throw Error('Falha ao consultar manutenções: '+r.error.message);
    if(company!==companyId)return;
    if(r.data?.some(x=>x.empresa_id!==company||!equipment.some(eq=>eq.id===x.equipamento_id)))throw Error('Isolamento ou relacionamento inválido nas manutenções.');
    maintenances=r.data||[];drawMaintenances();
  }
  function editMaintenance(id){const rec=maintenances.find(x=>x.id===id);if(!rec)return;editingMaintenance=rec.id;
    const fields=[['maintenance-equipment','equipamento_id'],['maintenance-type','tipo'],['maintenance-status','status'],['maintenance-date','data_registro'],['maintenance-owner','responsavel'],['maintenance-priority','prioridade'],['maintenance-next','data_proxima'],['maintenance-cost','custo_previsto'],['maintenance-activity','atividade_ocorrencia'],['maintenance-diagnosis','diagnostico'],['maintenance-action','acao_recomendada'],['maintenance-notes','observacoes']];
    for(const [field,key] of fields)$(field).value=rec[key]??'';
    $('maintenance-form-title').textContent='Editar manutenção de teste';$('maintenance-save').textContent='Salvar edição';$('maintenance-cancel').hidden=false;maintenanceNotice('Editando manutenção da empresa autenticada.');$('maintenance-form').scrollIntoView({behavior:'smooth'});
  }

  function editRecord(id){const rec=equipment.find(x=>x.id===id);if(!rec)return;editing=rec.id;$('category').value=rec.categoria||'';$('manufacturer').value=rec.fabricante||'';$('model').value=rec.modelo||'';$('year').value=rec.ano??'';$('prefix').value=rec.prefixo||'';$('status').value=rec.situacao||'ativo';$('form-title').textContent='Editar equipamento de teste';$('save').textContent='Salvar edição';$('cancel').hidden=false;notice('Editando equipamento da empresa autenticada.');$('equipment-form').scrollIntoView({behavior:'smooth'});}
  async function loadSession(session){const seq=++serial;if(!session?.user){lock();return;}const user=session.user;const membership=await db.from('maqon_usuarios').select('empresa_id,perfil').eq('usuario_id',user.id);if(seq!==serial)return;if(membership.error)throw Error('Falha ao verificar vínculo: '+membership.error.message);if(membership.data?.length!==1)throw Error('Usuário sem empresa única autorizada.');const member=membership.data[0];const company=await db.from('maqon_empresas').select('nome').eq('id',member.empresa_id).single();if(seq!==serial)return;if(company.error||!company.data)throw Error('Empresa não autorizada ou indisponível.');companyId=member.empresa_id;userId=user.id;await refresh();await Promise.all([refreshProposals(),refreshLeads(),refreshMaintenances()]);if(seq!==serial)return;$('company-name').textContent=company.data.nome;$('who').textContent=(member.perfil==='administrador'?'Administrador':'Cliente')+' • '+(user.email||'Conta autenticada');$('login').style.display='none';$('workspace').style.display='block';showError('');notice('');}
  async function validateSession(session){try{await loadSession(session)}catch(e){lock();showError(e.message||'Falha de autorização.');await db.auth.signOut();}}
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();showError('Validando acesso...');$('login-button').disabled=true;try{const response=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(response.error)throw response.error;$('login-password').value='';await validateSession(response.data.session)}catch(err){showError(err.message||'Falha no login.')}finally{$('login-button').disabled=false;}});
  $('equipment-form').addEventListener('submit',async e=>{e.preventDefault();if(!companyId||!userId){notice('Sessão inválida. Entre novamente.');return;}const savedCompany=companyId, savedUser=userId;const button=$('save');button.disabled=true;try{const values=payload();notice('Gravando no Supabase...');let response;if(editing){response=await db.from('maqon_equipamentos').update(values).eq('id',editing).eq('empresa_id',savedCompany).select('id');}else{response=await db.from('maqon_equipamentos').insert({...values,empresa_id:savedCompany}).select('id');}
    if(response.error)throw response.error;if(!response.data||response.data.length!==1)throw Error('Operação não confirmada ou sem permissão.');if(companyId!==savedCompany||userId!==savedUser)return;clearEditor();await refresh();notice('Equipamento de teste salvo com sucesso no Supabase.');
  }catch(err){notice('Não foi possível salvar: '+(err.message||'erro desconhecido'))}finally{button.disabled=false;}});
  $('proposal-form').addEventListener('submit',async e=>{e.preventDefault();if(!companyId||!userId){proposalNotice('Sessão inválida. Entre novamente.');return;}
    const savedCompany=companyId,savedUser=userId,button=$('proposal-save');button.disabled=true;
    try{const values=proposalPayload();proposalNotice('Gravando proposta no Supabase...');
      const response=editingProposal
        ? await db.from('maqon_propostas').update(values).eq('id',editingProposal).eq('empresa_id',savedCompany).select('id,numero,modalidade')
        : await db.from('maqon_propostas').insert({...values,empresa_id:savedCompany}).select('id,numero,modalidade');
      if(response.error)throw response.error;
      if(response.data?.length!==1)throw Error('Operação não confirmada ou sem permissão.');
      if(response.data[0].numero!==values.numero||response.data[0].modalidade!==values.modalidade)throw Error('A gravação não retornou número e modalidade como informado. Confira regras do banco.');
      if(companyId!==savedCompany||userId!==savedUser)return;
      clearProposal();await refreshProposals();proposalNotice('Proposta de teste salva com sucesso no Supabase.');
    }catch(err){proposalNotice('Não foi possível salvar a proposta: '+(err.message||'erro desconhecido'));}finally{button.disabled=false;}
  });

  $('lead-form').addEventListener('submit',async e=>{e.preventDefault();if(!companyId||!userId){leadNotice('Sessão inválida. Entre novamente.');return;}
    const savedCompany=companyId,savedUser=userId,button=$('lead-save');button.disabled=true;
    try{const values=leadPayload();leadNotice('Gravando lead no Supabase...');
      const result=editingLead
       ? await db.from('maqon_leads').update(values).eq('id',editingLead).eq('empresa_id',savedCompany).select('id,empresa_id')
       : await db.from('maqon_leads').insert({...values,empresa_id:savedCompany}).select('id,empresa_id');
      if(result.error)throw result.error;
      if(result.data?.length!==1||result.data[0].empresa_id!==savedCompany)throw Error('Gravação não confirmada ou sem autorização.');
      if(companyId!==savedCompany||userId!==savedUser)return;
      clearLead();await refreshLeads();leadNotice('Lead fictício salvo com sucesso no Supabase.');
    }catch(err){leadNotice('Falha ao salvar lead: '+(err.message||'erro desconhecido'));}finally{button.disabled=false;}
  });
  $('maintenance-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!companyId||!userId){maintenanceNotice('Sessão inválida. Entre novamente.');return;}
    const company=companyId,user=userId,button=$('maintenance-save');button.disabled=true;
    try{const values=maintenancePayload();maintenanceNotice('Gravando manutenção no Supabase...');
      const r=editingMaintenance
        ? await db.from('maqon_manutencoes').update(values).eq('id',editingMaintenance).eq('empresa_id',company).select('id,empresa_id,equipamento_id')
        : await db.from('maqon_manutencoes').insert({...values,empresa_id:company}).select('id,empresa_id,equipamento_id');
      if(r.error)throw r.error;
      if(r.data?.length!==1||r.data[0].empresa_id!==company||r.data[0].equipamento_id!==values.equipamento_id)throw Error('Gravação não confirmada ou acesso negado.');
      if(company!==companyId||user!==userId)return;
      clearMaintenance();await refreshMaintenances();maintenanceNotice('Manutenção fictícia salva com sucesso no Supabase.');
    }catch(err){maintenanceNotice('Falha ao salvar manutenção: '+(err.message||'erro desconhecido'));}finally{button.disabled=false;}
  });
  $('maintenance-cancel').addEventListener('click',()=>{clearMaintenance();maintenanceNotice('Edição cancelada.');});
  $('lead-cancel').addEventListener('click',()=>{clearLead();leadNotice('Edição cancelada.');});
  $('proposal-cancel').addEventListener('click',()=>{clearProposal();proposalNotice('Edição cancelada.');});
  $('cancel').addEventListener('click',()=>{clearEditor();notice('Edição cancelada.');});
  $('signout').addEventListener('click',async()=>{lock();await db.auth.signOut();showError('');});
  $('maintenance-date').value=new Date().toLocaleDateString('en-CA');
  db.auth.getSession().then(r=>{if(r.error)throw r.error;return validateSession(r.data.session);}).catch(e=>{lock();showError(e.message||'Erro ao recuperar sessão.');});
})();