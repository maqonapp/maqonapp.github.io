/* MAQON V1.6.3 - autenticacao e piloto de equipamentos.
   NAO e uma versao de producao comercial: outros modulos permanecem locais. */
(() => {
  'use strict';
  const cfg = window.MAQON_SUPABASE_CONFIG || {};
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || '') && !!cfg.publishableKey;
  const css = document.createElement('style');
  css.textContent = `
    #maqon-auth-cover{position:fixed;inset:0;z-index:2147483646;background:#07141c;color:#fff;display:grid;place-items:center;font-family:Arial,sans-serif;padding:16px}
    #maqon-auth-cover .mq-box{max-width:460px;width:100%;border:1px solid #d7a900;border-radius:16px;background:#102732;padding:28px;box-shadow:0 20px 75px #0009}
    #maqon-auth-cover h1{color:#ffc900;margin:0 0 12px;font-size:26px}
    #maqon-auth-cover p{line-height:1.5;color:#e0e8ed}
    #maqon-auth-cover label{display:block;margin:12px 0 6px;font-weight:bold}
    #maqon-auth-cover input{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #9eb1bd;padding:12px;font-size:16px}
    #maqon-auth-cover button{border:0;border-radius:8px;padding:12px 18px;background:#ffc900;font-weight:800;cursor:pointer;margin-top:15px}
    #maqon-auth-cover .msg{color:#ffb9b9;min-height:1.5em;font-size:14px}
    #maqon-pilot-banner{position:fixed;right:12px;bottom:12px;z-index:99999;background:#192c36;color:#fff;border:1px solid #ffc900;padding:9px 14px;border-radius:8px;font:12px Arial;max-width:380px}
    #maqon-pilot-banner button{margin-left:10px;padding:4px 7px;cursor:pointer}
  `;
  document.head.append(css);
  const cover = document.createElement('section');
  cover.id = 'maqon-auth-cover';
  cover.innerHTML = `<div class="mq-box"><h1>MAQON • Acesso de homologação</h1><p>Ambiente de teste. Os módulos de propostas, manutenção, documentos e CRM ainda não estão sincronizados e não devem receber dados reais de clientes.</p>
  <form id="maqon-auth-form"><label for="maqon-auth-email">E-mail</label><input id="maqon-auth-email" type="email" autocomplete="username" required>
  <label for="maqon-auth-pass">Senha</label><input id="maqon-auth-pass" type="password" autocomplete="current-password" required>
  <button type="submit">Entrar</button><p class="msg" role="alert" id="maqon-auth-msg"></p></form></div>`;
  document.body.append(cover);
  if (!ready) {
    cover.querySelector('form').remove();
    const p=document.createElement('p');
    p.textContent='Configure a URL e a chave publishable do Supabase no arquivo maqon-supabase-config.js antes de abrir esta versão. Nenhum dado foi enviado.';
    cover.querySelector('.mq-box').append(p);
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    cover.querySelector('#maqon-auth-msg').textContent='Biblioteca Supabase não carregada. Verifique a conexão.';
    return;
  }
  const client = window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  let activeCompany = null;
  let syncing = false;
  const msg = s => { cover.querySelector('#maqon-auth-msg').textContent = s || ''; };
  const banner=document.createElement('div');
  banner.id='maqon-pilot-banner';
  banner.innerHTML='HOMOLOGAÇÃO V1.6.3 — login ativo; outros módulos ainda locais. <button id="maqon-signout">Sair</button>';
  banner.style.display='none';
  document.body.append(banner);
  banner.querySelector('button').addEventListener('click',async()=>{
    banner.style.display='none';cover.style.display='grid';activeCompany=null;
    await client.auth.signOut(); location.reload();
  });
  const numberOrNull=v=>v === '' || v == null || !Number.isFinite(Number(v))?null:Number(v);
  const mapToRow=(x)=>({
    categoria:x[0]||'', fabricante:x[1]||'',modelo:x[2]||'',
    ano:numberOrNull(x[3]),horimetro_h:numberOrNull(x[4]),valor_aquisicao:numberOrNull(x[5]),
    consumo_l_h:numberOrNull(x[6]),custo_manutencao_h:numberOrNull(x[7]),
    disponibilidade_pct:numberOrNull(x[8]),
    situacao:({'ativo':'ativo','inativo':'inativo','manutenção':'manutencao','vendido':'vendido'})[String(x[9]||'ativo').toLowerCase()]||'ativo',
    prefixo:x[10]||null,numero_serie:x[11]||null,
    observacoes:[x[12]?'Local: '+x[12]:'',x[13]||''].filter(Boolean).join('\n')||null
  });
  const mapToLegacy=r=>[r.categoria,r.fabricante,r.modelo,String(r.ano??''),String(r.horimetro_h??''),String(r.valor_aquisicao??''),String(r.consumo_l_h??''),String(r.custo_manutencao_h??''),String(r.disponibilidade_pct??''),({manutencao:'Manutenção',vendido:'Vendido',inativo:'Inativo'})[r.situacao]||'Ativo',r.prefixo||'',r.numero_serie||'', '',r.observacoes||''];
  const loadCloud=async()=>{
    if(!activeCompany)throw Error('Empresa não identificada');
    const {data,error}=await client.from('maqon_equipamentos').select('*').eq('empresa_id',activeCompany).order('criado_em',{ascending:false});
    if(error)throw error;
    // API explicita evita misturar os dados locais de outras contas.
    window.dispatchEvent(new CustomEvent('maqon:cloud-equipment',{detail:(data||[]).map(mapToLegacy)}));
  };
  const login=async(session)=>{
    if(!session?.user) return;
    const {data,error}=await client.from('maqon_usuarios').select('empresa_id').eq('usuario_id',session.user.id);
    if(error)throw Error('Não foi possível consultar o vínculo da empresa: '+error.message);
    if(!data || data.length!==1)throw Error('Esta versão requer exatamente uma empresa vinculada ao usuário.');
    activeCompany=data[0].empresa_id;
    await loadCloud();
    cover.style.display='none';banner.style.display='block';
  };
  cover.querySelector('#maqon-auth-form').addEventListener('submit',async e=>{
    e.preventDefault(); msg('Autenticando...');
    const email=cover.querySelector('#maqon-auth-email').value.trim();
    const password=cover.querySelector('#maqon-auth-pass').value;
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      await login(data.session);
      cover.querySelector('#maqon-auth-pass').value='';msg('');
    }catch(err){msg(err.message||'Falha no acesso');await client.auth.signOut();}
  });
  client.auth.getSession().then(async({data,error})=>{
    if(error)throw error;
    if(data?.session)await login(data.session);
  }).catch(err=>{msg(err.message||'Sessão indisponível');});
  // API de salvamento opcional para o modulo de equipamentos. Não migra o armazenamento local.
  window.MAQONCloudPilot={
    async list(){return loadCloud();},
    async replaceEquipment(rows){
      if(syncing)throw Error('Salvamento em andamento');
      if(!activeCompany)throw Error('Entre com uma conta para salvar');
      syncing=true;
      try {
        // Usar IDs do banco para atualizar/excluir será parte da próxima etapa;
        // não sobrescrevemos a coleção com uma exclusão/reinserção arriscada.
        throw Error('Gravação de equipamentos ainda desativada na homologação. Nenhum registro foi modificado.');
      } finally {syncing=false;}
    }
  };
})();
