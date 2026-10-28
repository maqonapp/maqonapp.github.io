/* MAQON V1.7 — ponte de sessão SUPABASE para o dashboard de homologação.
   NÃO constitui controle de acesso pago nem proteção de dados localStorage.
   GitHub Pages serve arquivos públicos. Não liberar clientes reais neste estado. */
(()=>{'use strict';
 const overlay=document.getElementById('maqon-login-gate');
 const msg=document.getElementById('maqon-login-status');
 const form=document.getElementById('maqon-login-form');
 const signout=document.getElementById('maqon-logout');
 const companyEl=document.getElementById('maqon-empresa-sessao');
 const cfg=window.MAQON_SUPABASE_CONFIG||{};
 const fail=(s)=>{if(msg)msg.textContent=s;};
 document.documentElement.classList.add('maqon-auth-locked');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||'') || !String(cfg.publishableKey||'').startsWith('sb_publishable_') || !window.supabase?.createClient){fail('Configuração Supabase indisponível.');return;}
 const db=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 let ticket=0,verifiedUser=null;
 const lock=()=>{ticket++;verifiedUser=null;document.documentElement.classList.add('maqon-auth-locked');overlay.hidden=false;if(companyEl)companyEl.textContent='';if(signout)signout.hidden=true;};
 const check=async()=>{const now=++ticket;document.documentElement.classList.add('maqon-auth-locked');overlay.hidden=false;fail('Validando sua conta de homologação...');
  try{
   const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error('Entre com uma conta autorizada.');
   const r=await db.from('maqon_usuarios').select('empresa_id,perfil,maqon_empresas(nome)').eq('usuario_id',user.id);
   if(r.error||r.data?.length!==1||!r.data[0]?.empresa_id)throw Error('Vínculo único de empresa indisponível.');
   if(now!==ticket)return;
   verifiedUser=user.id;
   const company=r.data[0].maqon_empresas?.nome||'Empresa vinculada';
   if(companyEl)companyEl.textContent=company+' · Homologação';
   const name=document.querySelector('.side-title b');if(name)name.textContent=company;
   const role=document.querySelector('.side-title small');if(role)role.textContent='Conta de homologação';
   overlay.hidden=true;document.documentElement.classList.remove('maqon-auth-locked');if(signout)signout.hidden=false;
  }catch(e){if(now!==ticket)return;lock();fail(e.message||'Falha de autenticação.');}
 };
 form.addEventListener('submit',async(e)=>{e.preventDefault();const email=document.getElementById('maqon-login-email').value.trim();const password=document.getElementById('maqon-login-password').value;fail('Entrando...');
  const {error}=await db.auth.signInWithPassword({email,password});document.getElementById('maqon-login-password').value='';if(error){fail('Não foi possível entrar. Verifique suas credenciais.');return;}await check();
 });
 signout.addEventListener('click',async()=>{lock();await db.auth.signOut();fail('Sessão encerrada.');});
 db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){lock();fail('Entre com uma conta autorizada.');}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&verifiedUser)check();});
 check();
})();
