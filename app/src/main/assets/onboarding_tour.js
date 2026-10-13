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
      titulo:'Bem-vindo ao Vezora',
      texto:'Em poucos passos você já consegue criar seu primeiro orçamento e entender o essencial do aplicativo.',
      alvo:'header .brand',
      view:null
    },
    {
      titulo:'Crie seu primeiro orçamento',
      texto:'Comece por aqui. Escolha o cliente, adicione produtos ou serviços, informe os valores e gere o PDF para enviar.',
      alvo:'#view-novo',
      view:'novo'
    },
    {
      titulo:'Cadastre seus clientes',
      texto:'Salve os dados dos clientes para não precisar preencher tudo novamente a cada novo orçamento.',
      alvo:'#view-clientes',
      view:'clientes'
    },
    {
      titulo:'Deixe produtos e serviços prontos',
      texto:'Cadastre o que você vende ou presta e reutilize esses itens nos próximos orçamentos com muito mais rapidez.',
      alvo:'#view-produtos',
      view:'produtos'
    },
    {
      titulo:'Acompanhe suas vendas',
      texto:'Quando um orçamento virar venda, acompanhe por aqui o histórico do que realmente foi vendido.',
      alvo:'#view-vendas',
      view:'vendas'
    },
    {
      titulo:'Configure do seu jeito',
      texto:'Em Configurações você encontra backup, aparência, planos e os recursos de conta e nuvem disponíveis para seu plano.',
      alvo:'#view-config',
      view:'config'
    },
    {
      titulo:'Pronto para começar',
      texto:'Agora crie seu primeiro orçamento. Os outros recursos continuam disponíveis no menu e você pode refazer este guia quando quiser em Configurações.',
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
    '#tourOverlay{position:fixed;inset:0;z-index:2147483000;display:none;pointer-events:none;isolation:isolate}',
    '#tourOverlay.show{display:block}',
    '#tourSpotlight{position:fixed;z-index:1;border:3px solid var(--accent,#dce7ed);border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.72),0 0 0 5px rgba(255,255,255,.12);transition:all .22s ease;pointer-events:none;background:transparent}',
    '#tourCard{position:fixed;z-index:2;left:50%;bottom:18px;transform:translateX(-50%);width:min(520px,calc(100vw - 24px));max-height:min(44vh,420px);overflow:auto;background:var(--panel,#102a39);border:1px solid var(--line,#345769);border-radius:18px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.65);pointer-events:auto}',
    '#tourCard h2{margin:5px 0 8px;font-size:20px}',
    '#tourCard p{margin:0;color:var(--muted,#c7d7df);line-height:1.55;font-size:14px}',
    '.tour-progress{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted,#c7d7df)}',
    '#tourPular{border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer;padding:4px}',
    '.tour-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}',
    '.tour-highlight{outline:none!important}',
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
  const p=passos[indice],el=alvoDoPasso(p),spot=q('#tourSpotlight'),card=q('#tourCard');
  if(!spot||!card)return;

  const margem=10;
  if(!el){
    spot.style.left='12px';
    spot.style.top='70px';
    spot.style.width='calc(100vw - 24px)';
    spot.style.height='72px';
    card.style.top='auto';
    card.style.bottom='12px';
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

  // Mantém o cartão do tour longe do elemento destacado.
  // Em telas pequenas, prioriza topo/rodapé conforme houver mais espaço.
  const cardH=Math.min(card.scrollHeight||260,Math.max(180,window.innerHeight*0.44));
  const espacoAcima=Math.max(0,r.top-margem);
  const espacoAbaixo=Math.max(0,window.innerHeight-r.bottom-margem);

  if(espacoAbaixo>=cardH+18){
    card.style.top=Math.min(window.innerHeight-cardH-10,r.bottom+14)+'px';
    card.style.bottom='auto';
  }else if(espacoAcima>=cardH+18){
    card.style.top=Math.max(10,r.top-cardH-14)+'px';
    card.style.bottom='auto';
  }else{
    // Se o alvo ocupa quase a tela toda, fixa o cartão na região com menor sobreposição.
    const alvoCentro=r.top+r.height/2;
    if(alvoCentro>window.innerHeight/2){
      card.style.top='10px';
      card.style.bottom='auto';
    }else{
      card.style.top='auto';
      card.style.bottom='10px';
    }
  }
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
      try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(_){}
    }
    q('#tourTitulo').textContent=p.titulo;
    q('#tourTexto').textContent=p.texto;
    q('#tourContador').textContent=(indice+1)+' de '+passos.length;
    q('#tourVoltar').style.visibility=indice===0?'hidden':'visible';
    q('#tourProximo').textContent=indice===passos.length-1?'Finalizar':'Próximo';
    setTimeout(reposicionar,120);
    setTimeout(reposicionar,320);
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