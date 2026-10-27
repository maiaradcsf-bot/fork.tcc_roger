(function () {
  const appUtils = {
    getStoredToken(key) {
      return localStorage.getItem(key) || '';
    },

    buildAuthHeader(token) {
      return token ? { Authorization: `Bearer ${token}` } : {};
    },

    escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // A value passed as a string argument inside an inline handler, e.g.
    // onclick="fn(1, ${escapeJsArg(name)})": JSON.stringify makes it a JS string literal and
    // escapeHtml keeps it inside the attribute (the browser decodes the entities before running it)
    escapeJsArg(value) {
      return this.escapeHtml(JSON.stringify(value === null || value === undefined ? '' : String(value)));
    },

    showAlert(type, message, containerId = 'alertContainer') {
      const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      if (!container) return null;

      const alertElement = document.createElement('div');
      alertElement.className = `alert alert-${type} alert-dismissible fade show`;
      alertElement.setAttribute('role', 'alert');
      alertElement.innerHTML = `<div>${this.escapeHtml(message)}</div><button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>`;
      container.appendChild(alertElement);

      setTimeout(() => {
        if (!alertElement.parentNode) return;
        window.bootstrap?.Alert?.getOrCreateInstance?.(alertElement)?.close?.();
      }, 7000);

      return alertElement;
    },

    setLoadingState(button, loading, loadingText = 'Carregando...') {
      if (!button) return;
      if (loading) {
        button.disabled = true;
        button.dataset.originalContent = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
      } else {
        button.disabled = false;
        if (button.dataset.originalContent) {
          button.innerHTML = button.dataset.originalContent;
          delete button.dataset.originalContent;
        }
      }
    },

    renderTablePlaceholder(container, colspan, message = 'Carregando dados...') {
      if (!container) return;
      container.innerHTML = `<tr><td colspan="${Number(colspan)}" class="text-center py-5 text-muted">${this.escapeHtml(message)}</td></tr>`;
    },

    formatDate(dateString) {
      if (!dateString) return '—';
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },

    formatPrice(value) {
      return `R$ ${Number(value || 0).toFixed(2)}`;
    },
  };

  window.appUtils = appUtils;
})();
