(() => {
'use strict';

const MAX_PARCELAS=24;
let maquinaEditandoIndex=null;

function cfgAtual(){try{return cfg()||{}}catch(_){try{return JSON.parse(localStorage.getItem('cav_cfg')||'{}')}catch(__){return{}}}}
function maquinasLista(){const c=cfgAtual();return Array.isArray(c.maquinasCartao)?c.maquinasCartao:[]}
function salvarMaquinas(a){
  const c={...cfgAtual(),maquinasCartao:a};
  localStorage.setItem('cav_cfg',JSON.stringify(c));
  try{salvarEstado()}catch(_){}
}
function taxaNum(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?Math.max(0,n):0}
function taxaDaMaquina(m,parcelas){return taxaNum(m?.taxas?.[String(parcelas)]??m?.taxa??0)}
function taxaDebitoDaMaquina(m){return taxaNum(m?.taxaDebito??m?.debito??0)}
function brutoAtual(){try{return Number(calc().total)||0}catch(_){return 0}}
function maquinaSelecionada(){const i=Number(document.getElementById('orcMaquinaCartao')?.value);return Number.isInteger(i)&&i>=0?maquinasLista()[i]:null}
function parcelasSelecionadas(){return Math.max(1,Math.min(MAX_PARCELAS,Number(document.getElementById('orcParcelasCartao')?.value)||1))}
function liquidoCartao(total,maquina,parcelas,metodo='credito'){const taxa=metodo==='debito'?taxaDebitoDaMaquina(maquina):taxaDaMaquina(maquina,parcelas);return Math.max(0,(Number(total)||0)*(1-taxa/100))}
function detalhesCartaoAtual(){
  const metodo=document.getElementById('pagamentoMetodo')?.value||'';
  if(metodo!=='credito'&&metodo!=='debito')return null;
  const sel=document.getElementById('orcMaquinaCartao');
  const idx=Number(sel?.value);
  const m=maquinaSelecionada();
  if(!m||!Number.isInteger(idx)||idx<0)return null;
  const parcelas=metodo==='credito'?parcelasSelecionadas():1;
  const taxa=metodo==='debito'?taxaDebitoDaMaquina(m):taxaDaMaquina(m,parcelas);
  const total=brutoAtual();
  return{
    maquinaCartaoId:m.id||('maq_'+idx),
    maquinaCartaoNome:m.nome||'Maquininha',
    parcelasCartao:parcelas,
    taxaCartao:taxa,
    tipoCartao:metodo,
    valorBrutoCartao:total,
    valorLiquidoCartao:liquidoCartao(total,m,parcelas,metodo)
  };
}
function atualizarResumoCartao(){
  const box=document.getElementById('orcCartaoResumo');
  if(!box)return;
  const det=detalhesCartaoAtual();
  const metodo=document.getElementById('pagamentoMetodo')?.value||'';
  if(!det){box.innerHTML='<span class="muted">'+(metodo==='debito'?'Selecione uma maquininha.':'Selecione uma maquininha e o número de parcelas.')+'</span>';return}
  const valorParcela=det.valorBrutoCartao/det.parcelasCartao;
  box.innerHTML=
    '<div class="card-machine-summary-grid">'+
      '<div><span>Total do orçamento</span><b>'+BRL.format(det.valorBrutoCartao)+'</b></div>'+
      (metodo==='credito'?'<div><span>Parcelamento</span><b>'+det.parcelasCartao+'x de '+BRL.format(valorParcela)+'</b></div>':'<div><span>Modalidade</span><b>Débito</b></div>')+
      '<div class="internal-fee"><span>Taxa da maquininha</span><b>'+det.taxaCartao.toLocaleString('pt-BR',{maximumFractionDigits:3})+'%</b></div>'+
      '<div class="internal-net"><span>Valor líquido previsto</span><b>'+BRL.format(det.valorLiquidoCartao)+'</b></div>'+
    '</div>'+
    '<div class="muted" style="margin-top:8px">Taxa e valor líquido são informações internas e não aparecem nos PDFs enviados ao cliente.</div>';
}
function atualizarSelectMaquinas(){
  const sel=document.getElementById('orcMaquinaCartao');if(!sel)return;
  const atual=sel.value;
  const a=maquinasLista();
  sel.innerHTML='<option value="">Selecione a maquininha</option>'+a.map((m,i)=>'<option value="'+i+'">'+esc(m.nome||('Maquininha '+(i+1)))+'</option>').join('');
  if(atual!==''&&a[Number(atual)])sel.value=atual;
}
function atualizarBlocoCartao(){
  const bloco=document.getElementById('orcCartaoBox');if(!bloco)return;
  const metodo=document.getElementById('pagamentoMetodo')?.value||'';
  const cartao=metodo==='credito'||metodo==='debito';
  bloco.style.display=cartao?'':'none';
  const titulo=document.getElementById('orcCartaoTitulo');if(titulo)titulo.textContent=metodo==='debito'?'Cartão de débito':'Cartão de crédito';
  const parcelasWrap=document.getElementById('orcParcelasWrap');if(parcelasWrap)parcelasWrap.style.display=metodo==='credito'?'':'none';
  if(cartao){atualizarSelectMaquinas();atualizarResumoCartao()}
}

function criarCamposOrcamento(){
  const pagamento=document.getElementById('pagamentoMetodo');
  if(!pagamento||document.getElementById('orcCartaoBox'))return;
  const label=pagamento.closest('label');
  const box=document.createElement('div');
  box.id='orcCartaoBox';
  box.className='card-machine-budget-box';
  box.style.display='none';
  box.innerHTML=
    '<h3 id="orcCartaoTitulo">Cartão de crédito</h3>'+
    '<div class="grid">'+
      '<label>Maquininha<select id="orcMaquinaCartao"></select></label>'+
      '<label id="orcParcelasWrap">Parcelas<select id="orcParcelasCartao">'+Array.from({length:MAX_PARCELAS},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'x</option>').join('')+'</select></label>'+
    '</div>'+
    '<div id="orcCartaoResumo" class="card-machine-summary"></div>';
  label.parentNode.insertBefore(box,label.nextSibling);
  document.getElementById('orcMaquinaCartao').addEventListener('change',atualizarResumoCartao);
  document.getElementById('orcParcelasCartao').addEventListener('change',atualizarResumoCartao);
}

function criarAbaMaquinas(){
  if(document.getElementById('view-maquinas-cartao'))return;
  const nav=document.getElementById('sideNav');
  const produtosBtn=nav?.querySelector('[data-view="produtos"]');
  if(nav&&produtosBtn){
    const b=document.createElement('button');
    b.dataset.view='maquinas-cartao';
    b.textContent='Máquinas de cartão';
    produtosBtn.insertAdjacentElement('afterend',b);
    b.addEventListener('click',()=>{try{fecharMenu()}catch(_){};document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('#sideNav button[data-view]').forEach(x=>x.classList.remove('active'));document.getElementById('view-maquinas-cartao')?.classList.add('active');b.classList.add('active');renderMaquinasCartao()});
  }
  const sec=document.createElement('section');
  sec.id='view-maquinas-cartao';sec.className='view';
  sec.innerHTML=
    '<h1>Máquinas de cartão</h1>'+
    '<div class="card"><h2 id="maqFormTitulo">Adicionar maquininha</h2>'+
      '<div class="grid"><label>Nome da maquininha<input id="maqNome" placeholder="Ex.: Stone, Mercado Pago, PagBank"></label><label>Taxa no débito (%)<input id="maqTaxaDebito" inputmode="decimal" placeholder="Ex.: 1,39"></label></div>'+
      '<p class="muted" style="margin:12px 0 8px">Informe a taxa do débito e as taxas do crédito de 1x até 24x.</p>'+
      '<div id="maqTaxasGrid" class="machine-rates-grid"></div>'+
      '<div class="actions" style="margin-top:12px"><button class="btn primary" id="maqSalvar" type="button">Salvar maquininha</button><button class="btn" id="maqCancelar" type="button" style="display:none">Cancelar edição</button></div>'+
    '</div>'+
    '<div class="card"><h2>Maquininhas cadastradas</h2><div id="maqLista" class="list"></div></div>';
  document.querySelector('main')?.appendChild(sec);
  const grid=sec.querySelector('#maqTaxasGrid');
  grid.innerHTML=Array.from({length:MAX_PARCELAS},(_,i)=>'<label>'+(i+1)+'x (%)<input id="maqTaxa'+(i+1)+'" inputmode="decimal" placeholder="0,00"></label>').join('');
  sec.querySelector('#maqSalvar').onclick=salvarMaquinaForm;
  sec.querySelector('#maqCancelar').onclick=cancelarMaquinaForm;
}
function limparMaquinaForm(){
  maquinaEditandoIndex=null;
  const n=document.getElementById('maqNome');if(n)n.value='';
  const d=document.getElementById('maqTaxaDebito');if(d)d.value='';
  for(let i=1;i<=MAX_PARCELAS;i++){const x=document.getElementById('maqTaxa'+i);if(x)x.value=''}
  const t=document.getElementById('maqFormTitulo');if(t)t.textContent='Adicionar maquininha';
  const c=document.getElementById('maqCancelar');if(c)c.style.display='none';
}
function salvarMaquinaForm(){
  if(typeof pode==='function'&&!pode('config_editar'))return typeof negar==='function'?negar('config_editar'):undefined;
  const nome=document.getElementById('maqNome')?.value.trim();if(!nome)return alert('Digite o nome da maquininha.');
  const taxas={};for(let i=1;i<=MAX_PARCELAS;i++)taxas[String(i)]=taxaNum(document.getElementById('maqTaxa'+i)?.value);
  const taxaDebito=taxaNum(document.getElementById('maqTaxaDebito')?.value);
  const a=maquinasLista().slice();const reg={id:a[maquinaEditandoIndex]?.id||('maq_'+Date.now()),nome,taxaDebito,taxas};
  if(maquinaEditandoIndex!==null&&a[maquinaEditandoIndex])a[maquinaEditandoIndex]=reg;else a.push(reg);
  salvarMaquinas(a);limparMaquinaForm();renderMaquinasCartao();atualizarSelectMaquinas();if(typeof mostrarAviso==='function')mostrarAviso('Maquininha salva.');
}
function editarMaquina(i){
  const m=maquinasLista()[i];if(!m)return;
  maquinaEditandoIndex=i;document.getElementById('maqNome').value=m.nome||'';
  document.getElementById('maqTaxaDebito').value=String(taxaDebitoDaMaquina(m)).replace('.',',');
  for(let p=1;p<=MAX_PARCELAS;p++)document.getElementById('maqTaxa'+p).value=String(taxaDaMaquina(m,p)).replace('.',',');
  document.getElementById('maqFormTitulo').textContent='Editar maquininha';
  document.getElementById('maqCancelar').style.display='';
  document.getElementById('maqNome').focus();
}
function cancelarMaquinaForm(){limparMaquinaForm()}
async function excluirMaquina(i){
  if(typeof pode==='function'&&!pode('config_editar'))return typeof negar==='function'?negar('config_editar'):undefined;
  const a=maquinasLista().slice();if(!a[i])return;
  if(typeof confirmar==='function'&&!(await confirmar('Excluir a maquininha '+a[i].nome+'?')))return;
  a.splice(i,1);salvarMaquinas(a);renderMaquinasCartao();atualizarSelectMaquinas();
}
function renderMaquinasCartao(){
  const out=document.getElementById('maqLista');if(!out)return;
  const a=maquinasLista();
  out.innerHTML=a.length?a.map((m,i)=>{
    const taxas='Débito: '+taxaDebitoDaMaquina(m).toLocaleString('pt-BR',{maximumFractionDigits:3})+'% • '+Array.from({length:MAX_PARCELAS},(_,k)=>(k+1)+'x: '+taxaDaMaquina(m,k+1).toLocaleString('pt-BR',{maximumFractionDigits:3})+'%').join(' • ');
    return '<div class="list-item"><div><b>'+esc(m.nome)+'</b><div class="muted" style="margin-top:5px;line-height:1.55">'+esc(taxas)+'</div></div><div><button class="btn" onclick="editarMaquinaCartao('+i+')">Editar</button> <button class="btn danger" onclick="excluirMaquinaCartao('+i+')">Excluir</button></div></div>';
  }).join(''):'<div class="muted">Nenhuma maquininha cadastrada.</div>';
}

function valorLiquidoVenda(o){return (o?.metodo==='credito'||o?.metodo==='debito')&&Number.isFinite(Number(o.valorLiquidoCartao))?Number(o.valorLiquidoCartao):(Number(o?.total)||0)}
function parcelasPublicas(o){return o?.metodo==='credito'?Math.max(1,Number(o.parcelasCartao)||1):0}

function instalarPatches(){
  if(window.__businessCardMachinesPatched)return;window.__businessCardMachinesPatched=true;

  const pagamentoOriginal=pagamentoMudou;
  pagamentoMudou=function(){const r=pagamentoOriginal.apply(this,arguments);atualizarBlocoCartao();return r};

  const calcOriginal=calc;
  calc=function(){const r=calcOriginal.apply(this,arguments);setTimeout(atualizarResumoCartao,0);return r};

  const dadosOriginal=dados;
  dados=function(){
    const o=dadosOriginal.apply(this,arguments);
    if(o.metodo==='credito'||o.metodo==='debito'){
      const det=detalhesCartaoAtual();
      if(det){
        Object.assign(o,det);
        if(o.metodo==='credito'){
          const valorParcela=det.valorBrutoCartao/det.parcelasCartao;
          const infoPublica='Parcelamento no cartão: '+det.parcelasCartao+'x de '+BRL.format(valorParcela)+'.';
          const base=String(o.condicoes||'').trim();
          o.condicoes=base?(base+' '+infoPublica):infoPublica;
        }
      }else{
        o.maquinaCartaoId=null;o.maquinaCartaoNome='';o.parcelasCartao=1;o.taxaCartao=0;o.valorBrutoCartao=Number(o.total)||0;o.valorLiquidoCartao=Number(o.total)||0;
      }
    }else{
      o.maquinaCartaoId=null;o.maquinaCartaoNome='';o.parcelasCartao=0;o.taxaCartao=0;o.valorBrutoCartao=0;o.valorLiquidoCartao=Number(o.total)||0;
    }
    return o;
  };

  const abrirOriginal=abrir;
  abrir=function(n){
    const o=lista().find(x=>x.numero===n);
    const r=abrirOriginal.apply(this,arguments);
    setTimeout(()=>{
      atualizarBlocoCartao();
      if(o?.metodo==='credito'||o?.metodo==='debito'){
        const a=maquinasLista();
        const idx=a.findIndex(m=>(o.maquinaCartaoId&&m.id===o.maquinaCartaoId)||(!o.maquinaCartaoId&&m.nome===o.maquinaCartaoNome));
        const ms=document.getElementById('orcMaquinaCartao');if(ms)ms.value=idx>=0?String(idx):'';
        const ps=document.getElementById('orcParcelasCartao');if(ps)ps.value=String(o.metodo==='credito'?Math.max(1,Number(o.parcelasCartao)||1):1);
        atualizarResumoCartao();
      }
    },0);
    return r;
  };

  const lancarOriginal=lancarVendaRealizada;
  lancarVendaRealizada=async function(){
    const metodoCartao=document.getElementById('pagamentoMetodo')?.value||'';
    if(metodoCartao==='credito'||metodoCartao==='debito'){
      if(!maquinaSelecionada())return alert('Selecione a maquininha usada no cartão.');
      if(metodoCartao==='credito'&&!parcelasSelecionadas())return alert('Selecione a quantidade de parcelas.');
    }
    return lancarOriginal.apply(this,arguments);
  };

  const metodoOriginal=metodoPagamentoNome;
  metodoPagamentoNome=function(m){
    const base=metodoOriginal.apply(this,arguments);
    if(m==='credito'){
      const contexto=window.__businessPdfCardSale;
      if(contexto){
        const p=Math.max(1,Number(contexto.parcelasCartao)||1);
        const total=Number(contexto.total)||0;
        const parcela=total/p;
        return base+' • '+p+'x de '+BRL.format(parcela);
      }
      const p=parcelasSelecionadas();
      if(document.getElementById('view-novo')?.classList.contains('active')&&p)return base+' • '+p+'x';
    }
    return base;
  };

  const reciboOriginal=gerarReciboVenda;
  gerarReciboVenda=async function(numero){
    const o=lista().find(x=>String(x.numero)===String(numero));
    window.__businessPdfCardSale=o||null;
    try{return await reciboOriginal.apply(this,arguments)}
    finally{window.__businessPdfCardSale=null}
  };

  const contratoPdfOriginal=gerarPDFContrato;
  gerarPDFContrato=async function(c){
    window.__businessPdfCardSale=c?.venda||null;
    try{return await contratoPdfOriginal.apply(this,arguments)}
    finally{window.__businessPdfCardSale=null}
  };

  const resumoOriginal=dadosResumoMensal;
  dadosResumoMensal=function(mes){
    const r=resumoOriginal(mes);
    const brutoCliente=r.vendas.reduce((s,o)=>s+(Number(o.total)||0),0);
    const taxasCartao=r.vendas.reduce((s,o)=>s+Math.max(0,(Number(o.total)||0)-valorLiquidoVenda(o)),0);
    const recebidoLiquido=r.vendas.reduce((s,o)=>s+valorLiquidoVenda(o),0);
    const pagamentos={};
    r.vendas.forEach(o=>{const nome=metodoOriginal(o.metodo);pagamentos[nome]=(pagamentos[nome]||0)+valorLiquidoVenda(o)});
    const movimentos=[
      ...r.vendas.map(o=>({data:o.dataVenda||o.data,tipo:'Venda',numero:o.numero,cliente:o.cliente?.nome||'',metodo:metodoOriginal(o.metodo)+(o.metodo==='credito'?' • '+parcelasPublicas(o)+'x':''),valor:valorLiquidoVenda(o),valorBruto:Number(o.total)||0,taxaCartao:Number(o.taxaCartao)||0})),
      ...r.reembolsos.map(o=>({data:o.dataReembolso,tipo:'Reembolso',numero:o.numero,cliente:o.cliente?.nome||'',metodo:metodoOriginal(o.metodo),valor:-(Number(o.valorReembolso)||Number(o.total)||0)}))
    ].sort((a,b)=>String(a.data).localeCompare(String(b.data))||String(a.numero).localeCompare(String(b.numero)));
    return{...r,bruto:brutoCliente,taxasCartao,recebidoLiquido,liquido:recebidoLiquido-r.reembolsado,pagamentos,movimentos};
  };

  const renderResumoOriginal=renderResumoMensal;
  renderResumoMensal=function(){
    renderResumoOriginal.apply(this,arguments);
    if(!document.getElementById('vendaMes'))return;
    const r=dadosResumoMensal(document.getElementById('vendaMes').value);
    const caixa=document.getElementById('mesLiquido');
    if(caixa)caixa.textContent=BRL.format(r.liquido);
    let extra=document.getElementById('mesTaxasCartao');
    if(!extra&&caixa?.closest('.month-summary')){
      extra=document.createElement('div');extra.className='venda-stat';extra.id='mesTaxasCartao';
      extra.innerHTML='<span class="muted">Taxas de cartão</span><b>R$ 0,00</b>';
      caixa.closest('.month-summary').appendChild(extra);
    }
    if(extra)extra.querySelector('b').textContent=BRL.format(r.taxasCartao||0);
    if(document.getElementById('mesMovimentacoes'))document.getElementById('mesMovimentacoes').innerHTML=r.movimentos.length?r.movimentos.map(m=>'<div class="list-item"><div><b>'+m.tipo+' #'+m.numero+' • '+esc(m.cliente)+'</b><div class="muted">'+fmtDataBR(m.data)+' • '+esc(m.metodo)+(m.tipo==='Venda'&&m.valorBruto!==m.valor?' • bruto '+BRL.format(m.valorBruto):'')+'</div></div><b>'+(m.valor<0?'- ':'')+BRL.format(Math.abs(m.valor))+'</b></div>').join(''):'<div class="muted">Nenhuma movimentação neste mês.</div>';
  };

  const renderVendasOriginal=renderVendas;
  renderVendas=function(){
    renderVendasOriginal.apply(this,arguments);
    const vendas=lista().filter(o=>o.vendaRealizada&&!o.reembolsada);
    const totalLiquido=vendas.reduce((s,o)=>s+valorLiquidoVenda(o),0);
    const stat=document.getElementById('vendasTotal');if(stat){stat.textContent=BRL.format(totalLiquido);const label=stat.previousElementSibling;if(label)label.textContent='Valor líquido vendido'}
    document.querySelectorAll('#vendasLista .list-item').forEach((el,i)=>{
      const o=vendas.sort((x,y)=>String(y.dataVenda||y.data||'').localeCompare(String(x.dataVenda||x.data||'')))[i];
      if(o?.metodo==='credito'||o?.metodo==='debito'){
        const d=el.querySelector('.muted');if(d)d.innerHTML+=(o.metodo==='credito'?' • '+parcelasPublicas(o)+'x':'')+' • líquido '+BRL.format(valorLiquidoVenda(o));
      }
    });
  };
}

function criarEstilos(){
  if(document.getElementById('card-machines-style'))return;
  const s=document.createElement('style');s.id='card-machines-style';
  s.textContent=[
    '.card-machine-budget-box{margin:12px 0;padding:13px;border:1px solid var(--line);border-radius:12px;background:#0b2230}',
    '.card-machine-budget-box h3{margin:0 0 10px;font-size:14px}',
    '.card-machine-summary{margin-top:10px}',
    '.card-machine-summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}',
    '.card-machine-summary-grid>div{border:1px solid var(--line);border-radius:10px;padding:10px;background:#0a1f2b}',
    '.card-machine-summary-grid span{display:block;font-size:11px;color:var(--muted);margin-bottom:4px}',
    '.card-machine-summary-grid b{font-size:15px}',
    '.internal-net b{color:#8de0af}',
    '.machine-rates-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
    'body.light-theme .card-machine-budget-box,body.light-theme .card-machine-summary-grid>div{background:#f7fafb}',
    '@media(max-width:700px){.machine-rates-grid{grid-template-columns:repeat(2,1fr)}.card-machine-summary-grid{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(s);
}

function init(){
  criarEstilos();criarCamposOrcamento();criarAbaMaquinas();instalarPatches();atualizarBlocoCartao();
  window.editarMaquinaCartao=editarMaquina;window.excluirMaquinaCartao=excluirMaquina;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();