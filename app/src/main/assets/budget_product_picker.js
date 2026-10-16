(() => {
  'use strict';

  function norm(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function produtosDisponiveis() {
    try {
      return produtosLista()
        .map((p, i) => ({ p, i }))
        .filter(x => x.p.tipo === 'produto');
    } catch (_) {
      return [];
    }
  }

  function garantirModalProdutoOrcamento() {
    if (document.getElementById('orcProdutoModal')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'orcProdutoModal';
    backdrop.className = 'orc-prod-modal';
    backdrop.innerHTML =
      '<div class="orc-prod-dialog" role="dialog" aria-modal="true" aria-labelledby="orcProdTitulo">' +
        '<div class="orc-prod-head">' +
          '<div><b id="orcProdTitulo">Adicionar produto ao orçamento</b><div class="muted">Pesquise o produto e escolha o valor à vista ou a prazo.</div></div>' +
          '<button class="orc-prod-close" type="button" aria-label="Fechar" onclick="fecharProdutoOrcamento()">×</button>' +
        '</div>' +
        '<div class="orc-prod-search-wrap">' +
          '<input id="orcProdBusca" type="search" placeholder="Digite o nome do produto..." autocomplete="off">' +
        '</div>' +
        '<div id="orcProdResumo" class="muted"></div>' +
        '<div id="orcProdResultados" class="orc-prod-results"></div>' +
      '</div>';

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) fecharProdutoOrcamento();
    });
    document.body.appendChild(backdrop);

    const input = document.getElementById('orcProdBusca');
    input.addEventListener('input', renderProdutosOrcamento);
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') fecharProdutoOrcamento();
    });
  }

  function abrirProdutoOrcamento() {
    if (typeof pode === 'function' && !pode('orcamentos_editar')) {
      if (typeof negar === 'function') return negar('orcamentos_editar');
      return;
    }

    garantirModalProdutoOrcamento();
    const modal = document.getElementById('orcProdutoModal');
    const input = document.getElementById('orcProdBusca');
    if (!modal || !input) return;

    modal.classList.add('show');
    document.body.classList.add('orc-prod-modal-open');
    input.value = '';
    renderProdutosOrcamento();
    setTimeout(() => input.focus(), 50);
  }

  function fecharProdutoOrcamento() {
    const modal = document.getElementById('orcProdutoModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('orc-prod-modal-open');
  }

  function adicionarProdutoOrcamento(index, tipoValor) {
    if (typeof pode === 'function' && !pode('orcamentos_editar')) {
      if (typeof negar === 'function') return negar('orcamentos_editar');
      return;
    }

    const produtos = produtosLista();
    const p = produtos[index];
    if (!p || p.tipo !== 'produto') return;

    const valor = tipoValor === 'prazo' ? Number(p.prazo || 0) : Number(p.vista || 0);
    itens.push({
      d: p.d || 'Produto',
      cor: '',
      q: 1,
      v: valor,
      produtoId: p.id || null
    });

    renderItens();
    calc();
    fecharProdutoOrcamento();

    if (typeof mostrarAviso === 'function') {
      mostrarAviso((p.d || 'Produto') + ' adicionado ' + (tipoValor === 'prazo' ? 'a prazo.' : 'à vista.'));
    }
  }

  function renderProdutosOrcamento() {
    const out = document.getElementById('orcProdResultados');
    const resumo = document.getElementById('orcProdResumo');
    if (!out || !resumo) return;

    const termo = norm(document.getElementById('orcProdBusca')?.value || '');
    const resultados = produtosDisponiveis().filter(({ p }) => !termo || norm(p.d).includes(termo));

    resumo.textContent = termo
      ? resultados.length + ' produto' + (resultados.length === 1 ? '' : 's') + ' encontrado' + (resultados.length === 1 ? '' : 's') + '.'
      : resultados.length + ' produto' + (resultados.length === 1 ? '' : 's') + ' cadastrado' + (resultados.length === 1 ? '' : 's') + '.';

    out.innerHTML = resultados.length
      ? resultados.map(({ p, i }) =>
          '<div class="orc-prod-item">' +
            '<div class="orc-prod-info">' +
              '<b>' + esc(p.d) + '</b>' +
              '<div class="orc-prod-prices">' +
                '<span>À vista <strong>' + BRL.format(Number(p.vista || 0)) + '</strong></span>' +
                '<span>A prazo <strong>' + BRL.format(Number(p.prazo || 0)) + '</strong></span>' +
              '</div>' +
            '</div>' +
            '<div class="orc-prod-actions">' +
              '<button class="btn primary" type="button" onclick="adicionarProdutoOrcamento(' + i + ',\'vista\')">Adicionar à vista</button>' +
              '<button class="btn" type="button" onclick="adicionarProdutoOrcamento(' + i + ',\'prazo\')">Adicionar a prazo</button>' +
            '</div>' +
          '</div>'
        ).join('')
      : '<div class="orc-prod-empty">Nenhum produto encontrado.</div>';
  }

  function init() {
    const itemAdd = document.querySelector('#view-novo .card .item-add');
    if (!itemAdd || document.getElementById('btnAdicionarProdutoOrcamento')) return;

    const actions = itemAdd.querySelector('.item-edit-actions');
    if (!actions) return;

    const btn = document.createElement('button');
    btn.id = 'btnAdicionarProdutoOrcamento';
    btn.type = 'button';
    btn.className = 'btn orc-prod-open-btn';
    btn.textContent = 'Adicionar produto';
    btn.onclick = abrirProdutoOrcamento;
    actions.insertBefore(btn, actions.firstChild);

    const style = document.createElement('style');
    style.id = 'budget-product-picker-style';
    style.textContent = [
      '.orc-prod-open-btn{font-weight:700}',
      '.orc-prod-modal{position:fixed;inset:0;z-index:200;background:#0009;display:none;align-items:center;justify-content:center;padding:18px}',
      '.orc-prod-modal.show{display:flex}',
      'body.orc-prod-modal-open{overflow:hidden}',
      '.orc-prod-dialog{width:min(760px,100%);max-height:min(760px,88vh);overflow:hidden;display:flex;flex-direction:column;background:linear-gradient(180deg,#0f2a38,#091f2b);border:1px solid #345769;border-radius:18px;box-shadow:0 24px 70px #0009;padding:16px}',
      '.orc-prod-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}',
      '.orc-prod-head b{font-size:18px}',
      '.orc-prod-close{width:40px;height:40px;border-radius:10px;border:1px solid #35566a;background:#102a39;color:#fff;font-size:25px;line-height:1;cursor:pointer}',
      '.orc-prod-search-wrap{margin-bottom:9px}',
      '#orcProdBusca{font-size:16px;padding:13px 14px}',
      '#orcProdResumo{margin:2px 0 10px}',
      '.orc-prod-results{display:grid;gap:9px;overflow:auto;padding-right:3px}',
      '.orc-prod-item{display:flex;justify-content:space-between;align-items:center;gap:14px;border:1px solid var(--line);background:#0c2230;border-radius:13px;padding:12px}',
      '.orc-prod-info{min-width:0;flex:1}',
      '.orc-prod-info>b{font-size:14px}',
      '.orc-prod-prices{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}',
      '.orc-prod-prices span{font-size:11px;padding:5px 7px;border-radius:999px;background:#102f40;border:1px solid #34576a;color:#c7d7df}',
      '.orc-prod-prices strong{color:#fff;margin-left:4px}',
      '.orc-prod-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}',
      '.orc-prod-empty{padding:22px;text-align:center;border:1px dashed var(--line);border-radius:12px;color:var(--muted)}',
      'body.light-theme .orc-prod-dialog{background:linear-gradient(180deg,#fff,#f5f9fa);border-color:#c7d4db;box-shadow:0 24px 70px #283f4d45}',
      'body.light-theme .orc-prod-close{background:#eef3f6;border-color:#c8d4db;color:#20313b}',
      'body.light-theme .orc-prod-item{background:#fff}',
      'body.light-theme .orc-prod-prices span{background:#edf3f6;border-color:#c5d3da;color:#475f6b}',
      'body.light-theme .orc-prod-prices strong{color:#263b46}',
      '@media(max-width:640px){.orc-prod-modal{padding:10px;align-items:flex-end}.orc-prod-dialog{max-height:90vh;border-radius:18px 18px 10px 10px}.orc-prod-item{display:block}.orc-prod-actions{margin-top:10px;display:grid;grid-template-columns:1fr 1fr}.orc-prod-actions .btn{width:100%;padding:10px 8px}.item-edit-actions{grid-template-columns:1fr!important;display:grid!important}.item-edit-actions .btn{width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  window.abrirProdutoOrcamento = abrirProdutoOrcamento;
  window.fecharProdutoOrcamento = fecharProdutoOrcamento;
  window.renderProdutosOrcamento = renderProdutosOrcamento;
  window.adicionarProdutoOrcamento = adicionarProdutoOrcamento;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
