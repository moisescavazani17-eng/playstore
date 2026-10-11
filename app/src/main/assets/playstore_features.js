(function(){
'use strict';

var PS={
  plan:{tier:'free',billingReady:false,source:'fallback'},
  catalog:{ready:false,products:[]},
  cloudConnected:false,
  syncing:false,
  applying:false,
  timer:null,
  pendingLogo:null,
  testBuild:false,
  testAccountConnected:false
};

var TRACK=[
  'cav_orcs','cav_cheques','cav_cheque_instituicoes','cav_cheques_proprios',
  'cav_prods','cav_cfg','cav_seq','cav_theme','cav_internal_users'
];

function rank(t){return t==='pro_cloud'?2:t==='professional'?1:0}
function brandPaid(){return rank(PS.plan.tier)>=1}
function cloudPaid(){return rank(PS.plan.tier)>=2}
function testBuild(){
  try{return !!(PS.testBuild||(window.AndroidApp&&AndroidApp.isTestBuild&&AndroidApp.isTestBuild()))}catch(_){return !!PS.testBuild}
}
function testTeamSimulation(){return testBuild()&&cloudPaid()&&PS.testAccountConnected}
function h(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function co(){try{return cfg()}catch(e){try{return JSON.parse(localStorage.getItem('cav_cfg')||'{}')}catch(_){return{}}}}
function company(c){c=c||co();return String(c.empresa||'Meu Negócio').trim()||'Meu Negócio'}
function shortName(c){var n=company(c);return n.length>28?n.slice(0,28):n}
function subtitle(c){c=c||co();return String(c.slogan||'ORÇAMENTOS E GESTÃO').trim()||'ORÇAMENTOS E GESTÃO'}
function footer(c){c=c||co();return company(c)+(c.slogan?' • '+c.slogan:'')}
window.nomeEmpresa=company;
window.nomeCurtoMarca=shortName;
window.subtituloMarca=subtitle;
window.rodapeMarca=footer;

function readPlan(){
  try{
    if(window.AndroidApp&&AndroidApp.getPlanStatus){
      var p=JSON.parse(AndroidApp.getPlanStatus());
      if(p&&p.tier)return p;
    }
  }catch(e){}
  return {tier:'free',billingReady:false,source:'fallback'};
}

function readCatalog(){
  try{
    if(window.AndroidApp&&AndroidApp.getProductCatalog){
      var c=JSON.parse(AndroidApp.getProductCatalog());
      if(c&&Array.isArray(c.products))return c;
    }
  }catch(e){}
  return {ready:false,products:[]};
}

function addStyles(){
  if(document.getElementById('psStyle'))return;
  var s=document.createElement('style');
  s.id='psStyle';
  s.textContent=
    '.ps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}'+
    '.ps-box{border:1px solid var(--line);border-radius:12px;padding:11px;background:var(--panel2)}'+
    '.ps-box.on{outline:2px solid var(--accent)}.ps-box h3{margin:0 0 5px;font-size:15px}'+
    '.ps-box p,.ps-note{font-size:11px;color:var(--muted);line-height:1.5}'+
    '.ps-price-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}'+
    '.ps-price{border:1px solid var(--line);border-radius:9px;padding:8px;background:var(--panel)}'+
    '.ps-price b{display:block;font-size:13px;margin-bottom:5px}.ps-price .btn{width:100%;padding:8px 7px;font-size:11px}'+
    '.ps-current{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-size:11px;font-weight:700;margin-bottom:9px}'+
    '.ps-brand{display:grid;grid-template-columns:110px 1fr;gap:12px}.ps-logo{width:92px;height:92px;border:1px solid var(--line);border-radius:14px;background:#fff;display:grid;place-items:center;overflow:hidden}'+
    '.ps-logo img{max-width:100%;max-height:100%;object-fit:contain}.ps-lock{border:1px dashed var(--line);border-radius:10px;padding:10px;color:var(--muted)}'+
    '.ps-warn{margin-top:10px;border:1px solid #7d5d32;border-radius:10px;padding:10px;color:#f0d49b;background:#2c271c;font-size:11px;line-height:1.5}'+
    '.ps-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ps-billing-state{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5}'+
    '.primary{color:var(--accent-text,#0b1f2b)!important}@media(max-width:620px){.ps-grid,.ps-brand{grid-template-columns:1fr}.ps-actions{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}

function productForTier(tier){
  return (PS.catalog.products||[]).find(function(p){return p.tier===tier})||null;
}
function offerFor(tier,basePlanId){
  var p=productForTier(tier);
  if(!p)return null;
  return (p.offers||[]).find(function(o){return o.basePlanId===basePlanId})||null;
}
function priceText(tier,basePlanId){
  var o=offerFor(tier,basePlanId);
  return o&&o.formattedPrice?o.formattedPrice:(basePlanId==='anual'?'Anual':'Mensal');
}
function planName(t){
  return t==='pro_cloud'?'Pro + Nuvem':t==='professional'?'Profissional':'Gratuito';
}
function formatDate(value){
  if(!value)return '';
  try{return new Date(value).toLocaleDateString('pt-BR')}catch(_){return ''}
}
function planDetail(){
  var p=PS.plan||{}, txt='Plano atual: '+planName(p.tier);
  if(p.basePlanId)txt+=' • '+(p.basePlanId==='anual'?'anual':'mensal');
  if(p.expiresAt)txt+=' • válido até '+formatDate(p.expiresAt);
  if(p.tier!=='free'&&p.autoRenew===false)txt+=' • renovação cancelada';
  return txt;
}
function actionButton(tier,base){
  if(rank(PS.plan.tier)>rank(tier)){
    return '<button class="btn" onclick="PlayStoreFeatures.manage()">Gerenciar</button>';
  }
  if(PS.plan.tier===tier&&PS.plan.basePlanId===base){
    return '<button class="btn" onclick="PlayStoreFeatures.manage()">Plano atual</button>';
  }
  var label=PS.plan.tier===tier?'Trocar para '+(base==='anual'?'anual':'mensal'):
    (rank(PS.plan.tier)>0?'Mudar plano':'Assinar');
  return '<button class="btn primary" onclick="PlayStoreFeatures.buy(\''+tier+'\',\''+base+'\')">'+label+'</button>';
}
function priceBox(tier,base){
  return '<div class="ps-price"><b>'+(base==='anual'?'Anual':'Mensal')+'</b><div class="muted" style="margin-bottom:7px">'+h(priceText(tier,base))+'</div>'+actionButton(tier,base)+'</div>';
}

function renderPlans(){
  var e=document.getElementById('psPlans');
  if(!e)return;
  var t=PS.plan.tier;
  var testPanel=testBuild()?(
    '<div class="ps-warn" style="margin-bottom:12px"><b>Modo de teste</b><br>Ative qualquer plano sem pagamento para validar os recursos. Isto existe somente no APK de teste.'+
    '<div class="actions" style="margin-top:10px">'+
      '<button class="btn '+(t==='free'?'primary':'')+'" onclick="PlayStoreFeatures.setTestPlan(\'free\')">Testar Gratuito</button>'+
      '<button class="btn '+(t==='professional'?'primary':'')+'" onclick="PlayStoreFeatures.setTestPlan(\'professional\')">Testar Profissional</button>'+
      '<button class="btn '+(t==='pro_cloud'?'primary':'')+'" onclick="PlayStoreFeatures.setTestPlan(\'pro_cloud\')">Testar Pro + Nuvem</button>'+
    '</div></div>'
  ):'';
  e.innerHTML=
    '<h2>Planos e assinatura</h2>'+
    '<div class="ps-current">'+h(planDetail())+'</div>'+
    testPanel+
    '<p class="muted">O aplicativo funciona sem conta e sem internet. Organize clientes, produtos, serviços, orçamentos e vendas em um só lugar. A Google Play processa a compra e os meios de pagamento disponíveis para sua conta. As assinaturas mensal e anual têm renovação automática até o cancelamento na Google Play.</p>'+
    '<div class="ps-grid">'+
      '<div class="ps-box '+(t==='free'?'on':'')+'"><h3>Gratuito</h3><p>Dados no aparelho<br>1 usuário local obrigatório<br>Acesso protegido por usuário e senha<br>Clientes, produtos e serviços<br>Orçamentos, vendas e documentos<br>Backup local</p></div>'+
      '<div class="ps-box '+(t==='professional'?'on':'')+'"><h3>Profissional</h3><p>Tudo do Gratuito<br>Logo própria no app<br>Identidade visual nos PDFs<br>Cores e slogan personalizados<br>Apresentação profissional</p><div class="ps-price-grid">'+priceBox('professional','mensal')+priceBox('professional','anual')+'</div></div>'+
      '<div class="ps-box '+(t==='pro_cloud'?'on':'')+'"><h3>Pro + Nuvem</h3><p>Tudo do Profissional<br>Conta principal por e-mail<br>Usuários adicionais com permissões<br>Histórico de ações dos usuários<br>Backup e sincronização na nuvem<br>Restauração em aparelho novo</p><div class="ps-price-grid">'+priceBox('pro_cloud','mensal')+priceBox('pro_cloud','anual')+'</div></div>'+
    '</div>'+
    '<div class="actions" style="margin-top:10px"><button class="btn" onclick="PlayStoreFeatures.restorePurchases()">Restaurar compras</button><button class="btn" onclick="PlayStoreFeatures.manage()">Gerenciar assinatura</button></div>'+
    '<div class="ps-billing-state">'+(PS.catalog.ready?'Preços carregados diretamente da Google Play.':'Os preços serão carregados quando a Google Play estiver disponível.')+'</div>';
}

function renderBrand(){
  var e=document.getElementById('psBrand');
  if(!e)return;
  var c=co(),ok=brandPaid(),logo=PS.pendingLogo||c.logoDataUrl||'logo-app.svg';
  var x='<h2>Marca e aparência '+(ok?'':'🔒')+'</h2><p class="muted">Use a identidade da sua empresa no aplicativo e nos PDFs.</p>';
  if(ok){
    x+='<div class="ps-brand"><div><div class="ps-logo"><img id="psLogoPreview" src="'+h(logo)+'"></div><label>Logo<input id="psLogoFile" type="file" accept="image/png,image/jpeg,image/webp"></label></div>'+
      '<div class="grid"><label>Slogan<input id="psSlogan" value="'+h(c.slogan||'')+'"></label><label>Cor principal<input id="psColor" type="color" value="'+h(c.corPrincipal||'#dce7ed')+'"></label><label>Cor do cabeçalho<input id="psHead" type="color" value="'+h(c.corCabecalho||'#061a27')+'"></label></div></div>'+
      '<label><input id="psInApp" type="checkbox" '+(c.marcaNoApp===false?'':'checked')+'> Aplicar identidade dentro do app</label>'+
      '<label><input id="psInPdf" type="checkbox" '+(c.mostrarLogoPdf===false?'':'checked')+'> Mostrar logo nos PDFs</label>'+
      '<div class="actions"><button class="btn primary" onclick="PlayStoreFeatures.saveBrand()">Salvar identidade</button><button class="btn" onclick="PlayStoreFeatures.removeLogo()">Remover logo</button></div>';
  }else{
    x+='<div class="ps-lock">Disponível nos planos Profissional e Pro + Nuvem.</div>';
  }
  x+='<div class="ps-warn"><b>Ícone do aplicativo:</b> nome e ícone totalmente próprios continuam reservados ao White Label, pois o ícone do pacote publicado não pode ser substituído livremente por uma imagem escolhida no aparelho.</div>';
  e.innerHTML=x;
  if(ok){
    var inp=document.getElementById('psLogoFile');
    if(inp)inp.onchange=chooseLogo;
  }
}

function renderCloud(){
  var e=document.getElementById('cloudAccountCard');
  if(!e)return;
  if(!cloudPaid()){
    e.innerHTML='<h2>Conta Pro, usuários e nuvem 🔒</h2><p class="muted">No Básico você usa um único usuário local protegido por senha. O Pro + Nuvem libera conta por e-mail, usuários adicionais, permissões, histórico de ações, backup online e sincronização.</p><button class="btn primary" onclick="PlayStoreFeatures.buy(\'pro_cloud\',\'mensal\')">Assinar Pro + Nuvem</button>';
    return;
  }
  if(testBuild()){
    var testEmail=localStorage.getItem('ps_test_account_email')||'';
    e.innerHTML=
      '<h2>Conta Pro de teste</h2>'+
      '<p class="muted">Simulação local exclusiva do APK de teste. Use um e-mail e senha de teste para liberar usuários adicionais e permissões sem cobrança. A nuvem real será validada depois pelo teste interno da Google Play.</p>'+
      '<div class="grid"><label>E-mail de teste<input id="psTestEmail" type="email" value="'+h(testEmail)+'" placeholder="teste@empresa.com"></label><label>Senha de teste<input id="psTestPass" type="password" placeholder="Mínimo de 6 caracteres"></label></div>'+
      '<div class="actions"><button class="btn primary" onclick="PlayStoreFeatures.connectTestAccount()">Conectar conta de teste</button><button class="btn" onclick="PlayStoreFeatures.disconnectTestAccount()">Desconectar</button></div>'+
      '<p class="muted">'+(PS.testAccountConnected?'Conta de teste conectada: '+h(testEmail)+' • usuários extras liberados.':'Conecte a conta de teste para liberar usuários adicionais.')+'</p>';
    return;
  }
  e.innerHTML=
    '<h2>Conta Pro, usuários e nuvem</h2>'+
    '<p class="muted">Adicione o e-mail da conta principal para liberar usuários adicionais, permissões e sincronização. O usuário principal local continua protegendo o acesso ao aplicativo.</p>'+
    '<div class="grid"><label>E-mail<input id="cloudEmail" type="email" value="'+h(localStorage.getItem('cav_cloud_email')||'')+'"></label><label>Senha<input id="cloudPass" type="password"></label></div>'+
    '<div class="actions"><button class="btn primary" onclick="entrar()">Entrar</button><button class="btn" onclick="criarConta()">Criar conta</button><button class="btn" onclick="sair()">Desconectar</button></div>'+
    '<div class="ps-actions"><button class="btn primary" onclick="PlayStoreFeatures.backup()">Enviar backup agora</button><button class="btn" onclick="PlayStoreFeatures.restoreCloud()">Restaurar da nuvem</button></div>'+
    '<p class="muted" id="cloudStatus"></p>';
  cloudStatus();
}

function renderLocalBackup(){
  var e=document.getElementById('psLocalBackup');
  if(!e)return;
  e.innerHTML='<h2>Backup local</h2>'+
    '<p class="muted">Exporte um arquivo com os dados deste aparelho e guarde onde preferir. Este recurso funciona sem conta e não envia o arquivo para nossa nuvem.</p>'+
    '<div class="actions"><button class="btn primary" onclick="PlayStoreFeatures.exportBackup()">Exportar backup</button><button class="btn" onclick="PlayStoreFeatures.importBackup()">Restaurar arquivo</button></div>';
}

function renderPrivacy(){
  var e=document.getElementById('psPrivacy');
  if(!e)return;
  e.innerHTML='<h2>Privacidade e conta</h2>'+
    '<p class="muted">Consulte como os dados são tratados e controle sua conta de nuvem.</p>'+
    '<div class="actions"><button class="btn" onclick="PlayStoreFeatures.openPrivacy()">Política de privacidade</button><button class="btn" onclick="PlayStoreFeatures.openDeletionPage()">Página de exclusão</button></div>'+
    (PS.cloudConnected?'<button class="btn danger" style="width:100%;margin-top:9px" onclick="PlayStoreFeatures.deleteAccount()">Excluir conta e dados da nuvem</button>':'');
}

function inject(){
  addStyles();
  var v=document.getElementById('view-config'),c=document.getElementById('empresaConfigCard');
  if(v&&c&&!document.getElementById('psPlans')){
    var p=document.createElement('div');p.className='card';p.id='psPlans';v.insertBefore(p,c);
    var b=document.createElement('div');b.className='card';b.id='psBrand';c.insertAdjacentElement('afterend',b);
    var lb=document.createElement('div');lb.className='card';lb.id='psLocalBackup';b.insertAdjacentElement('afterend',lb);
    var pr=document.createElement('div');pr.className='card';pr.id='psPrivacy';lb.insertAdjacentElement('afterend',pr);
  }
  renderPlans();renderBrand();renderLocalBackup();renderPrivacy();renderCloud();
}

function contrast(hex){
  var v=String(hex||'').replace('#','');
  if(!/^[0-9a-f]{6}$/i.test(v))return '#0b1f2b';
  var r=parseInt(v.slice(0,2),16),g=parseInt(v.slice(2,4),16),b=parseInt(v.slice(4),16);
  return (r*299+g*587+b*114)/1000>150?'#10202a':'#fff';
}

function applyBrand(){
  var c=co(),on=brandPaid()&&c.marcaNoApp!==false,br=document.querySelector('.brand');
  if(br){
    var im=br.querySelector('img'),bt=br.querySelector('b'),sm=br.querySelector('small');
    if(im)im.src=on&&c.logoDataUrl?c.logoDataUrl:'logo-app.webp';
    if(bt)bt.textContent=on?company(c):'VEZORA';
    if(sm)sm.textContent=on?subtitle(c):'Orçamentos e Gestão';
  }
  if(on){
    document.documentElement.style.setProperty('--accent',c.corPrincipal||'#dce7ed');
    document.documentElement.style.setProperty('--accent-text',contrast(c.corPrincipal||'#dce7ed'));
    var hd=document.querySelector('header');if(hd)hd.style.background=(c.corCabecalho||'#061a27')+'ef';
  }else{
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.setProperty('--accent-text','#0b1f2b');
    var header=document.querySelector('header');if(header)header.style.background='';
  }
}

function resize(file){
  return new Promise(function(res,rej){
    var rd=new FileReader();
    rd.onerror=function(){rej(new Error('Falha ao ler imagem'))};
    rd.onload=function(){
      var im=new Image();
      im.onerror=function(){rej(new Error('Imagem inválida'))};
      im.onload=function(){
        var sc=Math.min(1,640/Math.max(im.width,im.height)),cv=document.createElement('canvas');
        cv.width=Math.max(1,Math.round(im.width*sc));cv.height=Math.max(1,Math.round(im.height*sc));
        cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
        res(cv.toDataURL('image/png'));
      };
      im.src=rd.result;
    };
    rd.readAsDataURL(file);
  });
}

async function chooseLogo(ev){
  var f=ev.target.files&&ev.target.files[0];if(!f)return;
  if(f.size>8*1024*1024)return alert('A logo deve ter no máximo 8 MB.');
  try{PS.pendingLogo=await resize(f);document.getElementById('psLogoPreview').src=PS.pendingLogo}catch(e){alert(e.message)}
}

function saveBrand(){
  if(!brandPaid())return alert('A personalização está disponível a partir do plano Profissional.');
  var c=co();
  c.slogan=(document.getElementById('psSlogan').value||'').trim();
  c.corPrincipal=document.getElementById('psColor').value;
  c.corCabecalho=document.getElementById('psHead').value;
  c.marcaNoApp=document.getElementById('psInApp').checked;
  c.mostrarLogoPdf=document.getElementById('psInPdf').checked;
  if(PS.pendingLogo)c.logoDataUrl=PS.pendingLogo;
  localStorage.setItem('cav_cfg',JSON.stringify(c));
  PS.pendingLogo=null;
  applyBrand();renderBrand();
  if(typeof mostrarAviso==='function')mostrarAviso('Identidade salva.');
}

function removeLogo(){
  if(!brandPaid())return;
  var c=co();delete c.logoDataUrl;
  localStorage.setItem('cav_cfg',JSON.stringify(c));
  PS.pendingLogo=null;applyBrand();renderBrand();
}

var oldLogo=window.logoPng;
window.logoPng=async function(){
  var c=co();
  if(brandPaid()&&c.mostrarLogoPdf!==false&&c.logoDataUrl)return c.logoDataUrl;
  return oldLogo?oldLogo():null;
};

function localHasData(){
  try{
    var arrays=['cav_orcs','cav_prods','cav_cheques','cav_cheques_proprios','cav_cheque_instituicoes','cav_internal_users'];
    for(var i=0;i<arrays.length;i++){
      var raw=localStorage.getItem(arrays[i]);
      if(raw){
        var parsed=JSON.parse(raw);
        if(Array.isArray(parsed)&&parsed.length)return true;
      }
    }
    var c=JSON.parse(localStorage.getItem('cav_cfg')||'{}');
    return Object.keys(c).length>0;
  }catch(e){return false}
}

function snapshot(){
  var st={};
  TRACK.forEach(function(k){var v=localStorage.getItem(k);if(v!==null)st[k]=v});
  return {formato:'orcamentos-gestao-cloud-v1',versao:2,updated_at:localStorage.getItem('playstore_local_updated_at')||new Date().toISOString(),storage:st};
}

function applySnapshot(p){
  if(!p||p.formato!=='orcamentos-gestao-cloud-v1'||!p.storage)throw new Error('Backup inválido');
  PS.applying=true;
  try{
    TRACK.forEach(function(k){localStorage.removeItem(k)});
    Object.keys(p.storage).forEach(function(k){if(TRACK.indexOf(k)>=0)localStorage.setItem(k,p.storage[k])});
    localStorage.setItem('playstore_local_updated_at',p.updated_at||new Date().toISOString());
  }finally{PS.applying=false}
  persistAllNative();
  location.reload();
}

function nativeStoreAvailable(){
  return !!(window.AndroidApp&&AndroidApp.loadLocalState&&AndroidApp.saveLocalValue);
}

function persistNativeKey(k,v){
  try{if(nativeStoreAvailable())AndroidApp.saveLocalValue(String(k),String(v))}catch(e){console.warn('SQLite save:',e)}
}

function removeNativeKey(k){
  try{if(window.AndroidApp&&AndroidApp.removeLocalValue)AndroidApp.removeLocalValue(String(k))}catch(e){console.warn('SQLite remove:',e)}
}

function persistAllNative(){
  if(!nativeStoreAvailable())return;
  TRACK.forEach(function(k){
    var v=localStorage.getItem(k);
    if(v===null)removeNativeKey(k);else persistNativeKey(k,v);
  });
}

function hydrateNativeStorage(){
  if(!nativeStoreAvailable())return;
  try{
    var raw=AndroidApp.loadLocalState();
    var state=raw?JSON.parse(raw):{};
    var keys=Object.keys(state||{}).filter(function(k){return TRACK.indexOf(k)>=0});
    if(keys.length){
      PS.applying=true;
      try{
        keys.forEach(function(k){localStorage.setItem(k,String(state[k]))});
      }finally{PS.applying=false}
    }else{
      persistAllNative();
    }
  }catch(e){console.warn('SQLite load:',e)}
}

function watchStorage(){
  if(window.__psWatch)return;
  window.__psWatch=true;
  var originalSet=Storage.prototype.setItem;
  var originalRemove=Storage.prototype.removeItem;

  Storage.prototype.setItem=function(k,v){
    originalSet.apply(this,arguments);
    if(this===localStorage&&TRACK.indexOf(String(k))>=0&&!PS.applying){
      persistNativeKey(k,v);
      originalSet.call(localStorage,'playstore_local_updated_at',new Date().toISOString());
      schedule();
      if(k==='cav_cfg')setTimeout(applyBrand,0);
    }
  };

  Storage.prototype.removeItem=function(k){
    originalRemove.apply(this,arguments);
    if(this===localStorage&&TRACK.indexOf(String(k))>=0&&!PS.applying){
      removeNativeKey(k);
      originalSet.call(localStorage,'playstore_local_updated_at',new Date().toISOString());
      schedule();
    }
  };
}

async function ensureCloud(){
  if(!cloudPaid())throw new Error('Disponível no Pro + Nuvem.');
  if(!cloud)cloud=await criarCloudClient();
  return cloud;
}

function cloudStatus(msg){
  var top=document.getElementById('syncTop'),s=document.getElementById('cloudStatus');
  if(top){
    top.textContent=PS.cloudConnected?'Nuvem':'Local';
    top.classList.toggle('ok',PS.cloudConnected);
  }
  if(s)s.textContent=msg||(PS.cloudConnected?'Conta conectada: '+(cloudUser&&cloudUser.email||'')+' • armazenamento local preservado':'Faça login para ativar o backup.');
}

async function currentSession(){
  if(!cloud)return null;
  var r=await cloud.auth.getSession();
  if(r.error)throw r.error;
  return r.data&&r.data.session||null;
}

async function linkCloudEntitlement(sess){
  if(!cloudPaid())throw new Error('Seu plano não inclui nuvem.');
  var token='';
  try{token=window.AndroidApp&&AndroidApp.getPurchaseToken?AndroidApp.getPurchaseToken():''}catch(_){}
  if(!token)throw new Error('Não foi possível localizar a assinatura no aparelho. Use “Restaurar compras” e tente novamente.');
  if(!sess||!sess.access_token)throw new Error('Sessão da conta inválida.');

  var response=await fetch(SUPABASE_URL+'/functions/v1/play-billing-verify',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'apikey':SUPABASE_KEY,
      'Authorization':'Bearer '+sess.access_token
    },
    body:JSON.stringify({purchaseToken:token})
  });
  var body=await response.json().catch(function(){return{}});
  if(!response.ok)throw new Error(body.detail||body.error||'Falha ao validar a assinatura.');
  if(!body.entitled||body.tier!=='pro_cloud')throw new Error('A assinatura Pro + Nuvem não está ativa.');
  return body;
}

async function backup(silent){
  if(!cloudPaid())throw new Error('Disponível no Pro + Nuvem.');
  if(!PS.cloudConnected||!cloudUser)throw new Error('Entre na conta da nuvem primeiro.');
  if(PS.syncing)return;
  PS.syncing=true;
  try{
    cloudStatus('Enviando backup...');
    var p=snapshot(),now=new Date().toISOString();
    var r=await cloud.from('playstore_snapshots').upsert({user_id:cloudUser.id,payload:p,updated_at:now},{onConflict:'user_id'});
    if(r.error)throw r.error;
    localStorage.setItem('playstore_last_cloud_sync',now);
    cloudStatus('Sincronizado agora');
    if(!silent&&typeof mostrarAviso==='function')mostrarAviso('Backup enviado para a nuvem.');
  }finally{PS.syncing=false}
}

async function restoreCloud(){
  if(!PS.cloudConnected)return alert('Entre na conta primeiro.');
  try{
    var r=await cloud.from('playstore_snapshots').select('payload').eq('user_id',cloudUser.id).maybeSingle();
    if(r.error)throw r.error;
    if(!r.data||!r.data.payload)return alert('Nenhum backup encontrado.');
    var ok=typeof confirmar==='function'?await confirmar('Restaurar o backup da nuvem? Os dados locais atuais serão substituídos.'):confirm('Restaurar o backup da nuvem?');
    if(ok)applySnapshot(r.data.payload);
  }catch(e){alert('Erro ao restaurar: '+e.message)}
}

async function reconcile(){
  if(!PS.cloudConnected)return;
  var r=await cloud.from('playstore_snapshots').select('payload,updated_at').eq('user_id',cloudUser.id).maybeSingle();
  if(r.error)throw r.error;
  if(!r.data||!r.data.payload){
    if(localHasData())await backup(true);
    else cloudStatus('Conta conectada. Ainda não há dados para enviar.');
    return;
  }
  if(!localHasData()){
    applySnapshot(r.data.payload);
    return;
  }
  var rt=Date.parse(r.data.payload.updated_at||r.data.updated_at||0)||0;
  var lt=Date.parse(localStorage.getItem('playstore_local_updated_at')||0)||0;
  if(lt>rt)await backup(true);
  else if(rt>lt)cloudStatus('Há backup mais recente na nuvem. Use Restaurar da nuvem.');
  else cloudStatus('Local e nuvem sincronizados.');
}

function schedule(){
  if(!cloudPaid()||!PS.cloudConnected)return;
  clearTimeout(PS.timer);
  PS.timer=setTimeout(function(){
    backup(true).catch(function(){cloudStatus('Conta conectada • backup pendente')});
  },4500);
}

async function restoreAuth(){
  cloudReady=false;
  PS.cloudConnected=false;
  if(testBuild()){
    cloudUser=null;
    PS.testAccountConnected=!!localStorage.getItem('ps_test_account_connected');
    cloudStatus();
    return;
  }
  if(!cloudPaid()){
    cloudUser=null;cloudStatus();return;
  }
  try{
    await ensureCloud();
    var r=await cloud.auth.getSession(),sess=r.data&&r.data.session;
    if(!sess&&typeof carregarSessaoNativa==='function'){
      var sv=await carregarSessaoNativa();
      if(sv){
        var z=await cloud.auth.setSession({access_token:sv.access_token,refresh_token:sv.refresh_token});
        sess=z.data&&z.data.session;
      }
    }
    cloudUser=sess&&sess.user||null;
    PS.cloudConnected=!!cloudUser;
    cloudReady=false;
    if(sess&&typeof salvarSessaoNativa==='function')await salvarSessaoNativa(sess);
    if(sess)await linkCloudEntitlement(sess);
    if(PS.cloudConnected&&typeof migrarUsuarioPrincipalParaNuvem==='function')await migrarUsuarioPrincipalParaNuvem();
    cloudStatus();
    if(PS.cloudConnected)await reconcile();
  }catch(e){
    cloudUser=null;PS.cloudConnected=false;cloudReady=false;
    cloudStatus('Nuvem indisponível: '+e.message);
  }
}

async function signIn(){
  try{
    await ensureCloud();
    var email=(document.getElementById('cloudEmail').value||'').trim(),pass=document.getElementById('cloudPass').value||'';
    if(!email||!pass)return alert('Informe e-mail e senha.');
    localStorage.setItem('cav_cloud_email',email);
    var r=await cloud.auth.signInWithPassword({email:email,password:pass});
    if(r.error)throw r.error;
    cloudUser=r.data.user;PS.cloudConnected=true;cloudReady=false;
    if(r.data.session&&typeof salvarSessaoNativa==='function')await salvarSessaoNativa(r.data.session);
    await linkCloudEntitlement(r.data.session);
    if(typeof migrarUsuarioPrincipalParaNuvem==='function')await migrarUsuarioPrincipalParaNuvem();
    if(typeof carregarUsuariosInternos==='function')await carregarUsuariosInternos(false);
    cloudStatus();renderPrivacy();
    await reconcile();
    if(typeof mostrarAviso==='function')mostrarAviso('Conta vinculada ao seu plano Pro + Nuvem.');
  }catch(e){
    PS.cloudConnected=false;cloudUser=null;cloudReady=false;
    cloudStatus();
    alert('Não foi possível ativar a nuvem: '+e.message);
  }
}

async function createAccount(){
  try{
    await ensureCloud();
    var email=(document.getElementById('cloudEmail').value||'').trim(),pass=document.getElementById('cloudPass').value||'';
    if(!email||!pass)return alert('Informe e-mail e senha.');
    var r=await cloud.auth.signUp({email:email,password:pass});
    if(r.error)throw r.error;
    localStorage.setItem('cav_cloud_email',email);
    if(r.data.session){
      cloudUser=r.data.session.user;PS.cloudConnected=true;cloudReady=false;
      if(typeof salvarSessaoNativa==='function')await salvarSessaoNativa(r.data.session);
      await linkCloudEntitlement(r.data.session);
      if(typeof migrarUsuarioPrincipalParaNuvem==='function')await migrarUsuarioPrincipalParaNuvem();
      if(typeof carregarUsuariosInternos==='function')await carregarUsuariosInternos(false);
      await backup(true);cloudStatus();
      alert('Conta criada, vinculada à assinatura e conectada.');
    }else{
      alert('Conta criada. Confirme seu e-mail e depois entre para vincular a assinatura.');
    }
  }catch(e){alert('Não foi possível criar a conta: '+e.message)}
}

async function signOut(){
  try{if(cloud)await cloud.auth.signOut()}catch(e){}
  if(typeof limparSessaoNativa==='function')await limparSessaoNativa();
  cloudUser=null;cloudReady=false;PS.cloudConnected=false;cloudStatus();renderPrivacy();
}

function openExternal(url){
  if(window.AndroidApp&&AndroidApp.openExternalUrl)AndroidApp.openExternalUrl(url);
  else window.open(url,'_blank','noopener');
}

function exportBackup(){
  if(!window.AndroidApp||!AndroidApp.exportBackup)return alert('Backup local disponível na versão Android.');
  var payload=snapshot();
  payload.formato='orcamentos-gestao-local-backup-v1';
  payload.exportado_em=new Date().toISOString();
  var d=new Date(),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  AndroidApp.exportBackup(JSON.stringify(payload),'Vezora_Backup_'+date+'.json');
}

function importBackup(){
  if(!window.AndroidApp||!AndroidApp.importBackup)return alert('Restauração local disponível na versão Android.');
  AndroidApp.importBackup();
}

async function onBackupImported(raw){
  try{
    var payload=typeof raw==='string'?JSON.parse(raw):raw;
    if(!payload||payload.formato!=='orcamentos-gestao-local-backup-v1'||!payload.storage)throw new Error('Arquivo de backup inválido.');
    var ok=typeof confirmar==='function'?await confirmar('Restaurar este backup? Os dados atuais deste aparelho serão substituídos.'):confirm('Restaurar este backup?');
    if(!ok)return;
    payload.formato='orcamentos-gestao-cloud-v1';
    applySnapshot(payload);
  }catch(e){alert('Não foi possível restaurar o backup: '+e.message)}
}

async function deleteAccount(){
  if(!PS.cloudConnected||!cloud)return alert('Entre na conta de nuvem que deseja excluir.');
  var ok=typeof confirmar==='function'?await confirmar('Excluir permanentemente sua conta e todos os dados armazenados na nuvem? Sua assinatura Google Play não será cancelada automaticamente.'):confirm('Excluir permanentemente a conta de nuvem?');
  if(!ok)return;
  try{
    var sess=await currentSession();
    if(!sess||!sess.access_token)throw new Error('Sessão expirada. Entre novamente.');
    var r=await fetch(SUPABASE_URL+'/functions/v1/playstore-account-delete',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+sess.access_token},
      body:'{}'
    });
    var body=await r.json().catch(function(){return{}});
    if(!r.ok)throw new Error(body.detail||body.error||'Falha ao excluir a conta.');
    try{await limparSessaoNativa()}catch(_){}
    localStorage.removeItem('cav_cloud_email');
    PS.cloudConnected=false;cloudUser=null;cloudReady=false;cloud=null;
    renderCloud();renderPrivacy();cloudStatus();
    alert('Conta e dados da nuvem excluídos. Os dados locais deste aparelho foram mantidos.');
  }catch(e){alert('Não foi possível excluir a conta: '+e.message)}
}

function overrides(){
  window.restaurar=restoreAuth;
  window.entrar=signIn;
  window.criarConta=createAccount;
  window.sair=signOut;
  window.sincronizar=function(){backup(false).catch(function(e){alert(e.message)})};
  window.status=cloudStatus;
}

function setTestPlan(tier){
  if(!testBuild()||!window.AndroidApp||!AndroidApp.setTestPlan)return;
  AndroidApp.setTestPlan(tier);
}
function connectTestAccount(){
  if(!testBuild()||!cloudPaid())return;
  var email=(document.getElementById('psTestEmail')?.value||'').trim();
  var pass=document.getElementById('psTestPass')?.value||'';
  if(!email||!email.includes('@'))return alert('Informe um e-mail de teste válido.');
  if(pass.length<6)return alert('Use uma senha de teste com pelo menos 6 caracteres.');
  localStorage.setItem('ps_test_account_email',email);
  localStorage.setItem('ps_test_account_connected','1');
  PS.testAccountConnected=true;
  renderCloud();
  if(typeof carregarUsuariosInternos==='function')carregarUsuariosInternos(false);
  if(typeof aplicarPermissoesUI==='function')aplicarPermissoesUI();
  if(typeof mostrarAviso==='function')mostrarAviso('Conta Pro de teste conectada.');
}
function disconnectTestAccount(){
  if(!testBuild())return;
  localStorage.removeItem('ps_test_account_connected');
  PS.testAccountConnected=false;
  renderCloud();
  if(typeof aplicarPermissoesUI==='function')aplicarPermissoesUI();
}

function buy(tier,basePlanId){
  if(!window.AndroidApp||!AndroidApp.buyPlan)return alert('A assinatura só pode ser comprada pela versão instalada através da Google Play.');
  if(PS.plan.tier===tier&&PS.plan.basePlanId===basePlanId)return manage();
  if(rank(PS.plan.tier)>rank(tier))return manage();
  AndroidApp.buyPlan(tier,basePlanId||'mensal');
}

function restorePurchases(){
  if(window.AndroidApp&&AndroidApp.restorePurchases)AndroidApp.restorePurchases();
}

function manage(){
  if(window.AndroidApp&&AndroidApp.openSubscriptionCenter)AndroidApp.openSubscriptionCenter();
}

function refreshCatalog(){
  if(window.AndroidApp&&AndroidApp.refreshBillingCatalog)AndroidApp.refreshBillingCatalog();
}

function planChanged(p){
  try{
    PS.plan=typeof p==='string'?JSON.parse(p):p;
    PS.testBuild=!!PS.plan.testBuild||testBuild();
    if(!cloudPaid())PS.testAccountConnected=false;
    inject();applyBrand();
    if(typeof aplicarLimiteUsuariosDoPlano==='function')aplicarLimiteUsuariosDoPlano();
    if(!cloudPaid()){
      PS.cloudConnected=false;cloudUser=null;cloudReady=false;
    }
  }catch(e){console.warn(e)}
}

function catalogChanged(c){
  try{
    PS.catalog=typeof c==='string'?JSON.parse(c):c;
    renderPlans();
  }catch(e){console.warn(e)}
}

async function start(){
  hydrateNativeStorage();
  watchStorage();
  overrides();
  if(!localStorage.getItem('playstore_local_updated_at')&&localHasData()){
    localStorage.setItem('playstore_local_updated_at',new Date().toISOString());
  }
  PS.plan=readPlan();
  PS.testBuild=!!PS.plan.testBuild||testBuild();
  PS.testAccountConnected=testBuild()&&!!localStorage.getItem('ps_test_account_connected');
  PS.catalog=readCatalog();
  inject();applyBrand();
  if(typeof window.__legacyIniciarAplicativo==='function')await window.__legacyIniciarAplicativo();
  inject();applyBrand();cloudStatus();
  if(typeof aplicarLimiteUsuariosDoPlano==='function')aplicarLimiteUsuariosDoPlano();
  if(!PS.catalog.ready)refreshCatalog();
}

window.PlayStoreFeatures={
  start:start,
  buy:buy,
  restorePurchases:restorePurchases,
  manage:manage,
  refreshCatalog:refreshCatalog,
  saveBrand:saveBrand,
  removeLogo:removeLogo,
  backup:function(){backup(false).catch(function(e){alert(e.message)})},
  restoreCloud:restoreCloud,
  exportBackup:exportBackup,
  importBackup:importBackup,
  onBackupImported:onBackupImported,
  openPrivacy:function(){openExternal(SUPABASE_URL+'/functions/v1/playstore-privacy')},
  openDeletionPage:function(){openExternal(SUPABASE_URL+'/functions/v1/playstore-account-delete')},
  deleteAccount:deleteAccount,
  setTestPlan:setTestPlan,
  connectTestAccount:connectTestAccount,
  disconnectTestAccount:disconnectTestAccount,
  isTestMode:function(){return testBuild()},
  isTestTeamSimulation:function(){return testTeamSimulation()},
  accountEmail:function(){return testTeamSimulation()?(localStorage.getItem('ps_test_account_email')||''):((cloudUser&&cloudUser.email)||localStorage.getItem('cav_cloud_email')||'')},
  allowsAdditionalUsers:function(){return cloudPaid()},
  isProAccountConnected:function(){return cloudPaid()&&(PS.cloudConnected||testTeamSimulation())},
  onNativePlanChanged:planChanged,
  onCatalogChanged:catalogChanged
};
})();