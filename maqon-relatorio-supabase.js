/* MAQON V1.6.11.1 — Relatório técnico Premium de homologação. Dados autorizados pela sessão. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const notice=t=>{if($('report-notice'))$('report-notice').textContent=t;};
 const config=window.MAQON_SUPABASE_CONFIG||{};
 if(!window.supabase?.createClient||!config.url||!config.publishableKey)return;
 const db=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 let items=[],companyId=null,userId=null,seq=0;
 let previewPdf=null,previewUrl=null,previewName=null,previewCompany=null,previewUser=null;
 const editableIds=['report-number','report-brand','report-title','report-subtitle','report-author','report-reviewer','report-approver','report-images'];
 function clearPreview(){previewPdf=null;previewName=null;previewCompany=null;previewUser=null;const b=$('report-download');if(b)b.disabled=true;const box=$('report-preview-box');if(box)box.style.display='none';const frame=$('report-preview-frame');if(frame)frame.removeAttribute('src');if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
 const draftKey=(uid,cid)=>`maqon:relatorio:rascunho:${uid}:${cid}`;
 function restoreSettings(uid,cid){try{const raw=localStorage.getItem(draftKey(uid,cid));if(!raw)return;const v=JSON.parse(raw);for(const id of editableIds){if(typeof v[id]==='string'&&$(id))$(id).value=v[id];}}catch(_){notice('Não foi possível recuperar as configurações locais.');}}
 async function saveSettings(){try{const c=await fetchContext();const v={};for(const id of editableIds)v[id]=$(id)?.value||'';localStorage.setItem(draftKey(c.user,c.company),JSON.stringify(v));notice('Configurações textuais salvas neste navegador para esta conta. Logo e PDF não foram enviados à nuvem.');}catch(e){notice('Falha ao salvar configurações: '+e.message);}}
 async function restoreDefault(){
  try{
   const c=await fetchContext();
   localStorage.removeItem(draftKey(c.user,c.company));
   const defaults={'report-number':'','report-brand':'MAQON','report-title':'RELATÓRIO TÉCNICO DE MANUTENÇÃO','report-subtitle':'Consultoria em Equipamentos Pesados','report-author':'','report-reviewer':'','report-approver':'','report-images':'sim'};
   for(const [id,value] of Object.entries(defaults))if($(id))$(id).value=value;
   if($('report-logo'))$('report-logo').value='';
   clearPreview();
   notice('Padrão MAQON restaurado nesta conta. Faça uma nova pré-visualização antes de salvar o PDF.');
  }catch(e){notice('Não foi possível restaurar o padrão: '+e.message);}
 }
 async function standardLogo(){
  const res=await fetch('maqon-logo-original-aprovada.png',{cache:'no-cache'});
  if(!res.ok)throw Error('A logo padrão MAQON não foi encontrada no repositório.');
  const blob=await res.blob();const url=URL.createObjectURL(blob);
  try{
   const im=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('A logo padrão MAQON não abriu.'));i.src=url;});
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
   const ratio=Math.min(320/im.width,320/im.height);canvas.getContext('2d').drawImage(im,(320-im.width*ratio)/2,(320-im.height*ratio)/2,im.width*ratio,im.height*ratio);
   return canvas.toDataURL('image/png');
  }finally{URL.revokeObjectURL(url);}
 }
 async function downloadPreview(){if(!previewPdf||!previewName){notice('Primeiro clique em Pré-visualizar relatório.');return;}try{const c=await fetchContext();if(c.user!==previewUser||c.company!==previewCompany)throw Error('Conta ou empresa alterada. Gere nova prévia.');previewPdf.save(previewName);notice('PDF salvo no seu dispositivo. Nenhuma cópia foi enviada ao Supabase.');}catch(e){clearPreview();notice('Não foi possível salvar: '+e.message);}}

 const fmt=v=>String(v??'—').replace(/[\x00-\x1f]/g,' ').slice(0,2000);
 const readableDate=d=>/^\d{4}-\d\d-\d\d$/.test(String(d||''))?`${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`:fmt(d);
 const titleCase=v=>{let a=fmt(v);return a==='—'?a:a.charAt(0).toUpperCase()+a.slice(1);};
 async function fetchContext(){
  const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error('Faça login para gerar o relatório.');
  const r=await db.from('maqon_usuarios').select('empresa_id,perfil,maqon_empresas(nome)').eq('usuario_id',user.id);
  if(r.error||r.data?.length!==1)throw Error('Vínculo único de empresa não confirmado.');
  return {user:user.id,company:r.data[0].empresa_id,name:r.data[0].maqon_empresas?.nome||'Empresa de teste'};
 }
 async function refresh(){clearPreview();const serial=++seq;try{
  const c=await fetchContext();
  const r=await db.from('maqon_manutencoes').select('id,empresa_id,equipamento_id,tipo,status,data_registro,responsavel,atividade_ocorrencia,diagnostico,acao_recomendada,prioridade,data_proxima,custo_previsto,observacoes').eq('empresa_id',c.company).order('data_registro',{ascending:false}).limit(100);
  if(r.error)throw r.error;if(r.data?.some(x=>x.empresa_id!==c.company))throw Error('Inconsistência de acesso aos registros.');
  if(serial!==seq)return;const changed=companyId!==c.company||userId!==c.user;companyId=c.company;userId=c.user;items=r.data||[];if(changed)restoreSettings(c.user,c.company);
  const select=$('report-maintenance');select.replaceChildren(new Option('Selecione uma manutenção',''));
  for(const m of items)select.add(new Option(`${readableDate(m.data_registro)} • ${fmt(m.tipo)} • ${fmt(m.atividade_ocorrencia).slice(0,55)}`,m.id));
  notice(`Manutenções autorizadas disponíveis: ${items.length}.`);
 }catch(e){if(serial===seq){items=[];companyId=null;userId=null;$('report-maintenance').replaceChildren(new Option('Selecione uma manutenção',''));notice('Acesso indisponível: '+e.message);}}}
 const ink=[15,39,49], gold=[244,181,0], muted=[95,111,122];
 const color=(pdf,v)=>pdf.setTextColor(...v);
 let activeHeader={};
 function header(pdf,section){
  const h=activeHeader;
  pdf.setFillColor(...ink);pdf.rect(0,0,210,29,'F');
  pdf.setFillColor(...gold);pdf.rect(0,29,210,1.5,'F');
  let left=16;
  if(h.logo){try{pdf.addImage(h.logo,'PNG',16,4,21,21);left=40;}catch(e){left=16;}}
  pdf.setFont('helvetica','bold');pdf.setFontSize(14);color(pdf,gold);
  pdf.text(fmt(h.brand||'MAQON').slice(0,64),left,10,{maxWidth:148-left+16});
  pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(242,244,244);
  pdf.text(fmt(h.title||'RELATÓRIO TÉCNICO DE MANUTENÇÃO').slice(0,95),left,17,{maxWidth:194-left});
  pdf.setFontSize(7.5);color(pdf,[202,217,223]);pdf.text(fmt(h.subtitle||'Relatório técnico • MAQON').slice(0,100),left,23,{maxWidth:194-left});
  pdf.setFontSize(7);color(pdf,[234,221,172]);pdf.text(section||'HOMOLOGAÇÃO',194,8,{align:'right'});
 }
 function page(pdf,s,section){if(s.page){pdf.addPage();}s.page=true;s.y=35;header(pdf,section);}
 function room(pdf,s,need,section){if(s.y+need>273)page(pdf,s,section||'CONTINUAÇÃO');}
 function heading(pdf,s,title){room(pdf,s,17);pdf.setFillColor(242,246,247);pdf.roundedRect(16,s.y-5,178,11,1.5,1.5,'F');pdf.setFillColor(...gold);pdf.rect(16,s.y-5,2,11,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(11);color(pdf,ink);pdf.text(title,22,s.y+2);s.y+=15;}
 function field(pdf,s,label,value){
  const text=fmt(value),lines=pdf.splitTextToSize(text,170),h=Math.max(9,lines.length*4.8+5);
  room(pdf,s,h+2);
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);color(pdf,muted);pdf.text(fmt(label).toUpperCase(),18,s.y);
  pdf.setFont('helvetica','normal');pdf.setFontSize(10);color(pdf,ink);pdf.text(lines,18,s.y+5);s.y+=h+3;
 }
 function evidenceCard(pdf,s,d,index,count){
  heading(pdf,s,`EVIDÊNCIA ${index} DE ${count}`);
  field(pdf,s,'Título',d.titulo);
  field(pdf,s,'Sistema / conjunto',d.sistema_conjunto);
  field(pdf,s,'Componente / item',d.componente_item);
  field(pdf,s,'Condição identificada',d.condicao_identificada);
  field(pdf,s,'Prioridade',titleCase(d.prioridade));
  field(pdf,s,'Observações',d.observacoes);
 }
 async function addPrivateImage(pdf,s,d){
  const resp=await db.storage.from('maqon-documentos-privados-v1').download(d.storage_path);
  if(resp.error||!resp.data)throw Error(`Não foi possível obter evidência autorizada: ${fmt(d.titulo)} (${resp.error?.message||'download'})`);
  if(!String(resp.data.type||d.mime_type||'').startsWith('image/'))return;
  const url=URL.createObjectURL(resp.data);
  try{
   const im=await new Promise((ok,fail)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=()=>fail(Error('Imagem privada inválida'));image.src=url;});
   const canvas=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(im.width,im.height));
   canvas.width=Math.max(1,Math.round(im.width*scale));canvas.height=Math.max(1,Math.round(im.height*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height);
   const img=canvas.toDataURL('image/jpeg',.86),width=Math.min(160,150*canvas.width/canvas.height),height=Math.min(105,160*canvas.height/canvas.width);
   let w=width,h=height;if(w/h>160/105){w=160;h=w*canvas.height/canvas.width;}else{h=Math.min(h,105);w=h*canvas.width/canvas.height;}
   room(pdf,s,h+16,'EVIDÊNCIAS');
   const x=18+(174-w)/2;
   pdf.setDrawColor(201,209,212);pdf.setLineWidth(.45);pdf.rect(x-2,s.y-2,w+4,h+4);
   pdf.addImage(img,'JPEG',x,s.y,w,h);s.y+=h+9;
  }finally{URL.revokeObjectURL(url);}
 }
 async function loadLogo(){
  const file=$('report-logo')?.files?.[0];if(!file)return null;
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024)throw Error('Logo: use JPG ou PNG de até 2 MB.');
  const url=URL.createObjectURL(file);
  try{
   const im=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Logo inválido'));i.src=url;});
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,320,320);
   const ratio=Math.min(320/im.width,320/im.height);ctx.drawImage(im,(320-im.width*ratio)/2,(320-im.height*ratio)/2,im.width*ratio,im.height*ratio);
   return canvas.toDataURL('image/png');
  }finally{URL.revokeObjectURL(url);}
 }
 async function generate(){clearPreview();const button=$('report-generate');button.disabled=true;const ticket=++seq;
  try{
   const id=$('report-maintenance').value,found=items.find(x=>x.id===id);if(!found)throw Error('Selecione uma manutenção da sua empresa.');
   const ctx=await fetchContext();if(ctx.company!==companyId||ctx.user!==userId||found.empresa_id!==ctx.company)throw Error('Sessão ou empresa alterada.');
   if(!window.jspdf?.jsPDF)throw Error('Biblioteca PDF indisponível.');
   notice('Montando relatório Premium de homologação...');
   const eq=await db.from('maqon_equipamentos').select('id,empresa_id,categoria,fabricante,modelo,prefixo,ano').eq('id',found.equipamento_id).eq('empresa_id',ctx.company).single();
   if(eq.error||eq.data?.empresa_id!==ctx.company)throw Error('Equipamento vinculado não autorizado.');
   const dr=await db.from('maqon_documentos').select('id,empresa_id,manutencao_id,titulo,nome_arquivo,mime_type,storage_path,sistema_conjunto,componente_item,condicao_identificada,prioridade,observacoes').eq('empresa_id',ctx.company).eq('manutencao_id',found.id).order('criado_em',{ascending:true}).limit(30);
   if(dr.error)throw dr.error;if(dr.data?.some(x=>x.empresa_id!==ctx.company||x.manutencao_id!==found.id))throw Error('Vínculo de documentos inválido.');
   const check=await fetchContext();if(check.company!==ctx.company||check.user!==ctx.user||ticket!==seq)throw Error('Sessão alterada durante a geração.');
   const autoNumber=`MAN-${String(found.data_registro||'').slice(0,4)||'TESTE'}-${String(found.id).replace(/-/g,'').slice(0,10).toUpperCase()}`;
   const reportNumber=($('report-number')?.value||'').trim()||autoNumber;
   activeHeader={brand:($('report-brand')?.value||'').trim()||'MAQON',title:($('report-title')?.value||'').trim()||'RELATÓRIO TÉCNICO DE MANUTENÇÃO',subtitle:($('report-subtitle')?.value||'').trim()||'Relatório técnico • MAQON',logo:(await loadLogo())||(await standardLogo()),number:reportNumber};
   const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),s={y:39,page:false};header(pdf,'HOMOLOGAÇÃO');s.page=true;
   heading(pdf,s,'DADOS DE CONTROLE');field(pdf,s,'Número do relatório',reportNumber);field(pdf,s,'Data de emissão',new Date().toLocaleDateString('pt-BR'));
   heading(pdf,s,'01  IDENTIFICAÇÃO DO CLIENTE');field(pdf,s,'Empresa',ctx.name);
   heading(pdf,s,'02  IDENTIFICAÇÃO DO EQUIPAMENTO');
   field(pdf,s,'Equipamento',`${eq.data.fabricante} ${eq.data.modelo}`);field(pdf,s,'Categoria',eq.data.categoria);field(pdf,s,'Prefixo',eq.data.prefixo);field(pdf,s,'Ano',eq.data.ano);
   heading(pdf,s,'03  REGISTRO DE MANUTENÇÃO');
   field(pdf,s,'Modalidade',titleCase(found.tipo));field(pdf,s,'Data',readableDate(found.data_registro));field(pdf,s,'Status',titleCase(found.status));
   field(pdf,s,'Responsável',found.responsavel);field(pdf,s,'Prioridade',titleCase(found.prioridade));
   heading(pdf,s,'04  ANÁLISE TÉCNICA');field(pdf,s,'Atividade / ocorrência',found.atividade_ocorrencia);
   field(pdf,s,'Diagnóstico',found.diagnostico);field(pdf,s,'Ação recomendada',found.acao_recomendada);
   field(pdf,s,'Observações',found.observacoes);
   heading(pdf,s,'05  RESPONSÁVEIS E CONFERÊNCIA');
   field(pdf,s,'Elaborado por',($('report-author')?.value||'').trim()||found.responsavel||'Não informado');
   field(pdf,s,'Revisado por',($('report-reviewer')?.value||'').trim()||'Não informado');
   field(pdf,s,'Aprovado por',($('report-approver')?.value||'').trim()||'Não informado');
   const docs=dr.data||[];heading(pdf,s,`06  EVIDÊNCIAS TÉCNICAS (${docs.length})`);
   if(!docs.length)field(pdf,s,'Evidências','Nenhum documento vinculado à manutenção.');
   else if($('report-images').value==='nao')field(pdf,s,'Evidências','Fotos omitidas por opção do usuário; metadados permanecem no registro.');
   else{
    let i=0;for(const d of docs.slice(0,8)){
     if(ticket!==seq)throw Error('Sessão alterada.');i++;
     notice(`Processando evidência privada ${i} de ${Math.min(8,docs.length)}...`);
     if(String(d.mime_type||'').startsWith('image/'))await addPrivateImage(pdf,s,d);
     evidenceCard(pdf,s,d,i,Math.min(8,docs.length));
    }
   }
   const final=await fetchContext();if(final.company!==ctx.company||final.user!==ctx.user||ticket!==seq)throw Error('Sessão alterada; PDF não será salvo.');
   const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){
    pdf.setPage(n);pdf.setDrawColor(210,217,221);pdf.line(16,281,194,281);
    pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);color(pdf,muted);pdf.text(`MAQON • HOMOLOGAÇÃO • ${fmt(activeHeader.number).slice(0,44)}`,16,287);
    pdf.text(`Página ${n} de ${pages}`,194,287,{align:'right'});
   }
   previewPdf=pdf;previewName=`MAQON_Relatorio_${activeHeader.number.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55)}.pdf`;previewCompany=ctx.company;previewUser=ctx.user;
   previewUrl=URL.createObjectURL(pdf.output('blob'));$('report-preview-frame').src=previewUrl;$('report-preview-box').style.display='block';$('report-download').disabled=false;
   notice('Prévia gerada. Confira as páginas e clique em Salvar PDF definitivo quando estiver aprovado.');
  }catch(e){notice('Falha ao gerar PDF: '+(e.message||'erro desconhecido'));}finally{button.disabled=false;}
 }
 $('report-generate')?.addEventListener('click',generate);
 $('report-download')?.addEventListener('click',downloadPreview);
 $('report-save-settings')?.addEventListener('click',saveSettings);
 $('report-reset-default')?.addEventListener('click',restoreDefault);
 for(const id of [...editableIds,'report-maintenance','report-logo'])$(id)?.addEventListener(id==='report-logo'?'change':'input',clearPreview);

 $('report-refresh')?.addEventListener('click',refresh);
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearPreview();++seq;companyId=null;userId=null;items=[];$('report-maintenance').replaceChildren(new Option('Selecione uma manutenção',''));notice('');}else if(event==='SIGNED_IN'||event==='INITIAL_SESSION')setTimeout(refresh,100);});
 setTimeout(refresh,300);
})();
