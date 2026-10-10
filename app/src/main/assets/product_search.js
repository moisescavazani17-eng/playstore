(() => {
  'use strict';

  function initProductSearch() {
    const tabs = document.querySelector('#view-produtos .product-tabs');
    const card = document.querySelector('#view-produtos .card');
    if (!tabs || !card || document.getElementById('prodTabPesquisa')) return;

    const btn = document.createElement('button');
    btn.id = 'prodTabPesquisa';
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Pesquisar produtos';
    btn.onclick = () => abrirPesquisaProdutos();
    tabs.appendChild(btn);

    const searchPane = document.createElement('div');
    searchPane.id = 'prodPesquisaPane';
    searchPane.style.display = 'none';
    searchPane.innerHTML =
      '<h2>Pesquisar produtos</h2>' +
      '<label style="display:block;margin-bottom:12px">' +
        '<span>Buscar produto</span>' +
        '<input id="prodBusca" type="search" placeholder="Digite o nome do produto..." autocomplete="off">' +
      '</label>' +
      '<div id="prodBuscaResumo" class="muted" style="margin-bottom:10px"></div>' +
      '<div id="prodBuscaResultados" class="list"></div>';
    card.appendChild(searchPane);

    const style = document.createElement('style');
    style.id = 'product-search-style';
    style.textContent =
      '#prodBusca{font-size:16px;padding:13px 14px}' +
      '#prodBuscaResultados .list-item{align-items:center}' +
      '#prodBuscaResultados .product-search-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}' +
      '#prodBuscaResultados .product-search-price{display:flex;gap:10px;flex-wrap:wrap;margin-top:5px}' +
      '#prodBuscaResultados .product-search-price span{font-size:12px;padding:4px 7px;border-radius:999px;background:#102f40;border:1px solid #34576a;color:#c7d7df}' +
      'body.light-theme #prodBuscaResultados .product-search-price span{background:#edf3f6;border-color:#c5d3da;color:#475f6b}' +
      '@media(max-width:640px){#prodBuscaResultados .list-item{display:block}#prodBuscaResultados .product-search-actions{margin-top:10px;justify-content:stretch}#prodBuscaResultados .product-search-actions .btn{flex:1}}';
    document.head.appendChild(style);

    const input = document.getElementById('prodBusca');
    input.addEventListener('input', renderPesquisaProdutos);

    const originalMudar = mudarAbaProduto;
    mudarAbaProduto = function(tipo) {
      fecharPesquisaProdutos();
      return originalMudar(tipo);
    };

    const originalRender = renderProdutos;
    renderProdutos = function() {
      if (tipoProdutoAtual === 'pesquisa') {
        renderPesquisaProdutos();
        return;
      }
      return originalRender();
    };
  }

  function formularioProdutoElements() {
    const ids = ['prodFormTitulo','prodDesc','prodValorVista','prodValorPrazo','prodSalvarBtn','prodCancelarBtn','produtos'];
    return ids.map(id => document.getElementById(id)).filter(Boolean);
  }

  function setFormVisibility(show) {
    const card = document.querySelector('#view-produtos .card');
    if (!card) return;
    const pesquisa = document.getElementById('prodPesquisaPane');

    Array.from(card.children).forEach(el => {
      if (el === pesquisa) return;
      el.style.display = show ? '' : 'none';
    });
    if (pesquisa) pesquisa.style.display = show ? 'none' : '';
  }

  function abrirPesquisaProdutos() {
    produtoEditandoIndex = null;
    tipoProdutoAtual = 'pesquisa';

    if (document.getElementById('prodTabProduto')) document.getElementById('prodTabProduto').className = 'btn';
    if (document.getElementById('prodTabServico')) document.getElementById('prodTabServico').className = 'btn';
    if (document.getElementById('prodTabPesquisa')) document.getElementById('prodTabPesquisa').className = 'btn primary';

    setFormVisibility(false);
    renderPesquisaProdutos();

    const input = document.getElementById('prodBusca');
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }

  function fecharPesquisaProdutos() {
    if (document.getElementById('prodTabPesquisa')) document.getElementById('prodTabPesquisa').className = 'btn';
    setFormVisibility(true);
  }

  function normalizarBuscaProduto(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function renderPesquisaProdutos() {
    const out = document.getElementById('prodBuscaResultados');
    const resumo = document.getElementById('prodBuscaResumo');
    if (!out || !resumo) return;

    const termo = normalizarBuscaProduto(document.getElementById('prodBusca')?.value || '');
    const todos = produtosLista();
    const resultados = todos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.tipo === 'produto')
      .filter(({ p }) => !termo || normalizarBuscaProduto(p.d).includes(termo));

    resumo.textContent = termo
      ? resultados.length + ' produto' + (resultados.length === 1 ? '' : 's') + ' encontrado' + (resultados.length === 1 ? '' : 's') + '.'
      : resultados.length + ' produto' + (resultados.length === 1 ? '' : 's') + ' cadastrado' + (resultados.length === 1 ? '' : 's') + '.';

    out.innerHTML = resultados.length
      ? resultados.map(({ p, i }) =>
          '<div class="list-item">' +
            '<div>' +
              '<b>' + esc(p.d) + '</b>' +
              '<div class="product-search-price">' +
                '<span>À vista: ' + BRL.format(p.vista) + '</span>' +
                '<span>A prazo: ' + BRL.format(p.prazo) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="product-search-actions">' +
              (pode('orcamentos_editar')
                ? '<button class="btn" onclick="usarProd(' + i + ',\'vista\')">Usar à vista</button>' +
                  '<button class="btn" onclick="usarProd(' + i + ',\'prazo\')">Usar a prazo</button>'
                : '') +
              (pode('produtos_editar')
                ? '<button class="btn" onclick="editarProdutoDaPesquisa(' + i + ')">Editar</button>'
                : '') +
            '</div>' +
          '</div>'
        ).join('')
      : '<div class="muted">Nenhum produto encontrado para esta pesquisa.</div>';
  }

  window.abrirPesquisaProdutos = abrirPesquisaProdutos;
  window.renderPesquisaProdutos = renderPesquisaProdutos;
  window.editarProdutoDaPesquisa = function(i) {
    fecharPesquisaProdutos();
    tipoProdutoAtual = 'produto';
    editarProduto(i);
    if (document.getElementById('prodTabProduto')) document.getElementById('prodTabProduto').className = 'btn primary';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductSearch, { once: true });
  } else {
    initProductSearch();
  }
})();
