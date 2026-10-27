// Assistente de IA (admin e cliente): botão flutuante + painel lateral de conversa.
// Configurado pelos atributos data-* da tag <script>: audience ("admin" | "client") e token-key.
(function () {
  const script = document.currentScript;
  const audience = script?.dataset.audience === 'admin' ? 'admin' : 'client';
  const tokenKey = script?.dataset.tokenKey || (audience === 'admin' ? 'admin_token' : 'client_token');
  const apiBase = `/api/${audience}/ai`;
  const MAX_HISTORY = 12;
  const history = [];

  const SUGGESTIONS = audience === 'admin'
    ? ['O que está com estoque baixo?', 'Quais solicitações estão pendentes?', 'Quais produtos foram mais solicitados nos últimos 30 dias?']
    : ['O que tem disponível?', 'Preciso de material para uma aula de desenho', 'Como estão minhas solicitações?'];

  const utils = window.appUtils;
  const token = () => utils.getStoredToken(tokenKey);

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...utils.buildAuthHeader(token()), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
    return data;
  }

  function formatText(text) {
    return utils.escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  function buildPanel() {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'aiAssistantToggle';
    button.className = 'btn btn-primary rounded-circle shadow position-fixed d-flex align-items-center justify-content-center';
    button.style.cssText = 'right: 24px; bottom: 24px; width: 56px; height: 56px; z-index: 1040;';
    button.setAttribute('aria-label', 'Abrir assistente de IA');
    button.innerHTML = '<i class="bi bi-stars fs-4"></i>';

    const panel = document.createElement('div');
    panel.className = 'offcanvas offcanvas-end';
    panel.id = 'aiAssistantPanel';
    panel.tabIndex = -1;
    panel.setAttribute('aria-labelledby', 'aiAssistantTitle');
    panel.innerHTML = `
      <div class="offcanvas-header border-bottom">
        <div>
          <h5 class="offcanvas-title mb-0" id="aiAssistantTitle"><i class="bi bi-stars text-primary me-1"></i> Assistente</h5>
          <small class="text-muted">Tire dúvidas sobre produtos, estoque e solicitações</small>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Fechar"></button>
      </div>
      <div class="offcanvas-body d-flex flex-column p-0">
        <div id="aiAssistantMessages" class="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2"></div>
        <div id="aiAssistantQuick" class="px-3 pb-2 d-flex flex-wrap gap-2"></div>
        <form id="aiAssistantForm" class="border-top p-3 d-flex gap-2">
          <input id="aiAssistantInput" class="form-control" maxlength="1000" autocomplete="off" placeholder="Digite sua pergunta..." />
          <button class="btn btn-primary" type="submit" aria-label="Enviar"><i class="bi bi-send"></i></button>
        </form>
        <div class="px-3 pb-2 small text-muted">As respostas são geradas por IA e podem conter erros.</div>
      </div>`;

    document.body.append(button, panel);
    const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(panel);
    button.addEventListener('click', () => offcanvas.toggle());
    panel.querySelector('#aiAssistantForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = panel.querySelector('#aiAssistantInput');
      send(input.value);
      input.value = '';
    });

    const quick = panel.querySelector('#aiAssistantQuick');
    SUGGESTIONS.forEach((label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'btn btn-sm btn-outline-secondary rounded-pill';
      chip.textContent = label;
      chip.addEventListener('click', () => send(label));
      quick.appendChild(chip);
    });

    addBubble('assistant', audience === 'admin'
      ? 'Olá! Posso consultar estoque, movimentações e solicitações para você.'
      : 'Olá! Posso mostrar o que está disponível no almoxarifado e ajudar a montar sua solicitação.');
  }

  function addBubble(role, text, extraNode) {
    const container = document.getElementById('aiAssistantMessages');
    const bubble = document.createElement('div');
    bubble.className = role === 'user'
      ? 'align-self-end bg-primary text-white rounded-3 px-3 py-2'
      : 'align-self-start bg-light border rounded-3 px-3 py-2';
    bubble.style.maxWidth = '88%';
    bubble.innerHTML = formatText(text);
    if (extraNode) bubble.appendChild(extraNode);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function suggestionList(suggestions) {
    const list = document.createElement('div');
    list.className = 'mt-2 d-flex flex-column gap-2';
    suggestions.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center justify-content-between gap-2 bg-white border rounded-2 px-2 py-1';
      row.innerHTML = `<div class="small"><div class="fw-semibold">${utils.escapeHtml(item.name)}</div>
        <div class="text-muted">${Number(item.quantity)} un. · ${utils.escapeHtml(utils.formatPrice(item.price))} · estoque ${Number(item.stock)}</div></div>`;
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-sm btn-outline-primary text-nowrap';
      add.innerHTML = '<i class="bi bi-cart-plus"></i> Adicionar';
      add.addEventListener('click', async () => {
        if (typeof window.adicionarSugestaoIA !== 'function') return;
        utils.setLoadingState(add, true, '');
        const added = await window.adicionarSugestaoIA(item.product_id, item.quantity, item.name);
        utils.setLoadingState(add, false);
        if (added) {
          add.disabled = true;
          add.innerHTML = '<i class="bi bi-check2"></i> Adicionado';
        }
      });
      row.appendChild(add);
      list.appendChild(row);
    });
    return list;
  }

  async function send(rawText) {
    const text = String(rawText || '').trim().slice(0, 1000);
    if (!text) return;
    addBubble('user', text);
    history.push({ role: 'user', content: text });
    const typing = addBubble('assistant', 'Pensando...');
    typing.classList.add('text-muted', 'fst-italic');
    try {
      const data = await api('/chat', { method: 'POST', body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }) });
      typing.remove();
      const suggestions = Array.isArray(data.suggestions) && data.suggestions.length ? suggestionList(data.suggestions) : null;
      addBubble('assistant', data.reply || '', suggestions);
      history.push({ role: 'assistant', content: data.reply || '' });
    } catch (error) {
      typing.remove();
      history.pop();
      addBubble('assistant', `Não foi possível responder: ${error.message}`);
    }
  }

  async function setupReasonButton() {
    const button = document.getElementById('clientCartReasonAiButton');
    const textarea = document.getElementById('clientCartReason');
    if (!button || !textarea) return;
    button.classList.remove('d-none');
    button.addEventListener('click', async () => {
      utils.setLoadingState(button, true, 'Gerando...');
      try {
        const cartId = typeof clientOpenCart !== 'undefined' && clientOpenCart ? clientOpenCart.id : undefined;
        const data = await api('/reason', { method: 'POST', body: JSON.stringify({ cart_id: cartId, context: textarea.value.trim().slice(0, 500) || undefined }) });
        textarea.value = data.reason || textarea.value;
      } catch (error) {
        utils.showAlert('warning', `Não foi possível sugerir o motivo: ${error.message}`);
      } finally {
        utils.setLoadingState(button, false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!token()) return;
    try {
      const status = await api('/status');
      if (!status.enabled) return;
    } catch (error) {
      return;
    }
    buildPanel();
    if (audience === 'client') setupReasonButton();
  });
})();
