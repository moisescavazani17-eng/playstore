(() => {
'use strict';

const TOUR_KEY='og_onboarding_tour_v1';
let indice=0;
let ativo=false;
let passos=[];

function q(sel){return document.querySelector(sel)}
function visivel(el){return !!(el&&el.offsetParent!==null)}
function textoSeguro(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function irPara(view){
  const btn=q('#sideNav button[data-view="'+view+'"]');
  if(btn&&visivel(btn))btn.click();
  try{if(typeof fecharMenu==='function')fecharMenu()}catch(_){}
}

function criarPassos(){
  return [
    {
      titulo:'Bem-vindo ao aplicativo',
      texto:'Aqui você organiza seu negócio de um jeito simples. Vou mostrar rapidamente onde fica cada função.',
      alvo:'header .brand',
      view:null
    },
    {
      titulo:'Novo orçamento',
      texto:'É aqui que você monta um orçamento: escolhe o cliente, adiciona itens, valores, forma de pagamento e depois pode gerar o PDF.',
      alvo:'#view-novo',
      view:'novo'
    },
    {
      titulo:'Orçamentos',
      texto:'Nesta aba ficam os orçamentos já salvos. Você pode abrir, editar e acompanhar cada um.',
      alvo:'#view-historico',
      view:'historico'
    },
    {
      titulo:'Vendas',
      texto:'Quando um orçamento vira venda, ele aparece aqui. Esta área ajuda a acompanhar o que realmente foi vendido e recebido.',
      alvo:'#view-vendas',
      view:'vendas'
    },
    {
      titulo:'Contratos',
      texto:'Aqui você cria contratos usando os dados de uma venda e também consulta os contratos que já foram salvos.',
      alvo:'#view-contrato',
      view:'contrato'
    },
    {
      titulo:'Reembolsos',
      texto:'Use esta área quando precisar registrar a devolução de uma venda. O valor é descontado dos resultados.',
      alvo:'#view-reembolsos',
      view:'reembolsos'
    },
    {
      titulo:'Clientes',
      texto:'Aqui fica sua lista de clientes. Você pode cadastrar os dados e começar um novo orçamento para um cliente rapidamente.',
      alvo:'#view-clientes',
      view:'clientes'
    },
    {
      titulo:'Cheques',
      texto:'Se você trabalha com cheques, estas abas ajudam a controlar recebimentos, destinos e os cheques emitidos pelo próprio negócio.',
      alvo:'#view-cheques',
      view:'cheques'
    },
    {
      titulo:'Produtos e serviços',
      texto:'Cadastre o que você vende ou presta. Você pode informar preço à vista e a prazo e depois adicionar esses itens ao orçamento com mais rapidez.',
      alvo:'#view-produtos',
      view:'produtos'
    },
    {
      titulo:'Máquinas de cartão',
      texto:'Cadastre suas maquininhas e as taxas de débito e crédito de 1x até 24x. O app calcula o valor líquido que realmente entra no caixa.',
      alvo:'#view-maquinas-cartao',
      view:'maquinas-cartao',
      opcional:true
    },
    {
      titulo:'Configurações',
      texto:'Aqui você configura os dados do negócio, backup, aparência, planos e, quando disponível, conta por e-mail e usuários adicionais.',
      alvo:'#view-config',
      view:'config'
    },
    {
      titulo:'Tudo pronto',
      texto:'Você já conhece o básico. Comece criando um orçamento. Se quiser ver este guia novamente, use o botão “Refazer tour do aplicativo” em Configurações.',
      alvo:'#view-novo',
      view:'novo'
    }
  ];
}

function garantirUI(){
  if(q('#tourOverlay'))return;
  const overlay=document.createElement('div');
  overlay.id='tourOverlay';
  overlay.innerHTML=
    '<div id="tourSpotlight"></div>'+
    '<div id="tourCard" role="dialog" aria-modal="true" aria-labelledby="tourTitulo">'+
      '<div class="tour-progress"><span id="tourContador"></span><button id="tourPular" type="button">Pular</button></div>'+
      '<h2 id="tourTitulo"></h2>'+
      '<p id="tourTexto"></p>'+
      '<div class="tour-actions">'+
        '<button id="tourVoltar" class="btn" type="button">Voltar</button>'+
        '<button id="tourProximo" class="btn primary" type="button">Próximo</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);

  const style=document.createElement('style');
  style.id='tourStyles';
  style.textContent=[
    '#tourOverlay{position:fixed;inset:0;z-index:5000;display:none;pointer-events:none}',
    '#tourOverlay.show{display:block}',
    '#tourSpotlight{position:fixed;z-index:5001;border:3px solid var(--accent,#dce7ed);border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.72),0 0 0 5px rgba(255,255,255,.12);transition:all .22s ease;pointer-events:none}',
    '#tourCard{position:fixed;z-index:5002;left:50%;bottom:18px;transform:translateX(-50%);width:min(520px,calc(100vw - 24px));background:var(--panel,#102a39);border:1px solid var(--line,#345769);border-radius:18px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.45);pointer-events:auto}',
    '#tourCard h2{margin:5px 0 8px;font-size:20px}',
    '#tourCard p{margin:0;color:var(--muted,#c7d7df);line-height:1.55;font-size:14px}',
    '.tour-progress{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted,#c7d7df)}',
    '#tourPular{border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer;padding:4px}',
    '.tour-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}',
    '.tour-highlight{position:relative;z-index:5001!important}',
    'body.light-theme #tourCard{background:#fff;border-color:#ccd7dc}',
    '@media(max-width:640px){#tourCard{bottom:10px;padding:14px}#tourCard h2{font-size:18px}#tourCard p{font-size:13px}}'
  ].join('');
  document.head.appendChild(style);

  q('#tourPular').onclick=()=>encerrar(true);
  q('#tourVoltar').onclick=()=>mostrar(indice-1);
  q('#tourProximo').onclick=()=>indice>=passos.length-1?encerrar(false):mostrar(indice+1);
  window.addEventListener('resize',reposicionar);
  window.addEventListener('scroll',reposicionar,{passive:true});
}

function alvoDoPasso(p){
  let el=p&&q(p.alvo);
  if(!el||!visivel(el))return null;
  return el;
}

function limparDestaque(){
  document.querySelectorAll('.tour-highlight').forEach(el=>el.classList.remove('tour-highlight'));
}

function reposicionar(){
  if(!ativo)return;
  const p=passos[indice],el=alvoDoPasso(p),spot=q('#tourSpotlight');
  if(!spot)return;
  if(!el){
    spot.style.cssText='left:12px;top:70px;width:calc(100vw - 24px);height:72px';
    return;
  }
  const r=el.getBoundingClientRect(),pad=6;
  const left=Math.max(6,r.left-pad),top=Math.max(6,r.top-pad);
  const width=Math.min(window.innerWidth-left-6,r.width+pad*2);
  const height=Math.min(window.innerHeight-top-6,r.height+pad*2);
  spot.style.left=left+'px';
  spot.style.top=top+'px';
  spot.style.width=Math.max(40,width)+'px';
  spot.style.height=Math.max(40,height)+'px';
}

function mostrar(n){
  if(!ativo)return;
  limparDestaque();
  if(n<0)n=0;
  if(n>=passos.length){encerrar(false);return}
  indice=n;
  let p=passos[indice];

  if(p.view){
    const btn=q('#sideNav button[data-view="'+p.view+'"]');
    if((!btn||!visivel(btn))&&p.opcional){mostrar(indice+1);return}
    irPara(p.view);
  }

  setTimeout(()=>{
    const el=alvoDoPasso(p);
    if(!el&&p.opcional){mostrar(indice+1);return}
    if(el){
      el.classList.add('tour-highlight');
      try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(_){}
    }
    q('#tourTitulo').textContent=p.titulo;
    q('#tourTexto').textContent=p.texto;
    q('#tourContador').textContent=(indice+1)+' de '+passos.length;
    q('#tourVoltar').style.visibility=indice===0?'hidden':'visible';
    q('#tourProximo').textContent=indice===passos.length-1?'Finalizar':'Próximo';
    setTimeout(reposicionar,180);
  },80);
}

function encerrar(pulado){
  ativo=false;
  limparDestaque();
  q('#tourOverlay')?.classList.remove('show');
  localStorage.setItem(TOUR_KEY,'done');
  irPara('novo');
  if(!pulado&&typeof mostrarAviso==='function')mostrarAviso('Tour concluído. Você pode refazê-lo em Configurações.');
}

function iniciar(forcar=false){
  if(ativo)return;
  if(!forcar&&localStorage.getItem(TOUR_KEY)==='done')return;
  garantirUI();
  passos=criarPassos();
  ativo=true;
  indice=0;
  q('#tourOverlay').classList.add('show');
  mostrar(0);
}

function podeIniciar(){
  const auth=q('#internalAuthOverlay');
  const bloqueado=auth&&auth.classList.contains('show');
  let usuarioOk=false;
  try{usuarioOk=typeof usuarioInternoAtual!=='undefined'&&!!usuarioInternoAtual}catch(_){}
  return usuarioOk&&!bloqueado&&q('#sideNav')&&q('#view-novo');
}

function iniciarQuandoPronto(){
  if(localStorage.getItem(TOUR_KEY)==='done')return;
  let tentativas=0;
  const timer=setInterval(()=>{
    tentativas++;
    if(podeIniciar()){
      clearInterval(timer);
      setTimeout(()=>iniciar(false),450);
    }else if(tentativas>240){
      clearInterval(timer);
    }
  },250);
}

function adicionarBotaoConfig(){
  const view=q('#view-config');
  if(!view||q('#tourReplayCard'))return;
  const card=document.createElement('div');
  card.id='tourReplayCard';
  card.className='card';
  card.innerHTML='<h2>Ajuda para começar</h2><p class="muted">Veja novamente uma explicação simples das principais áreas do aplicativo.</p><button class="btn" type="button" onclick="AppTour.start(true)">Refazer tour do aplicativo</button>';
  view.appendChild(card);
}

window.AppTour={start:iniciar,finish:encerrar};

function init(){
  adicionarBotaoConfig();
  iniciarQuandoPronto();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();