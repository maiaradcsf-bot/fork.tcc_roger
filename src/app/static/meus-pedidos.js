function formatOrderDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createClientOrderStatusBadge(status) {
  const normalized = (status || '').toString().toLowerCase();
  if (['approved', 'aprovado'].includes(normalized)) {
    return '<span class="badge bg-info text-dark status-badge">Aguardando retirada</span>';
  }
  if (['finished', 'completed', 'concluido', 'concluído', 'retirado'].includes(normalized)) {
    return '<span class="badge bg-primary status-badge">Retirado</span>';
  }
  if (['pending', 'initial', 'inicial', 'pendent', 'pendente'].includes(normalized)) {
    return '<span class="badge bg-warning text-dark status-badge">Aguardando aprovação</span>';
  }
  return `<span class="badge bg-secondary status-badge">${escapeHtml(status || 'Desconhecido')}</span>`;
}

function summarizeOrderProducts(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const names = items.map((item) => item.product || item.product_name).filter(Boolean);
  return names.length ? names.map(escapeHtml).join(', ') : '—';
}

function summarizeOrderQuantity(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

async function loadClientOrders(button = null) {
  const tbody = document.getElementById('clientOrdersTableBody');
  if (!tbody) return;

  const token = getClientToken();
  if (!token) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">Faça login para visualizar suas solicitações.</td></tr>';
    return;
  }

  if (button) {
    button.disabled = true;
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Carregando...';
  }
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">Carregando solicitações...</td></tr>';

  try {
    const response = await fetch('/api/client/orders', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || `Erro ${response.status}`);
    }

    const orders = await response.json();
    if (!Array.isArray(orders) || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">Nenhuma solicitação encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map((order, index) => `
      <tr>
        <th scope="row">${index + 1}</th>
        <td>${summarizeOrderProducts(order)}</td>
        <td>${summarizeOrderQuantity(order)}</td>
        <td>${formatPrice(order.total)}</td>
        <td>${createClientOrderStatusBadge(order.status)}</td>
        <td>${formatOrderDate(order.created_at)}</td>
      </tr>
    `).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Falha ao carregar solicitações: ${escapeHtml(error.message)}</td></tr>`;
    showAlert('danger', `Erro ao carregar solicitações: ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = button.dataset.originalContent || '<i class="bi bi-arrow-clockwise me-1"></i> Atualizar solicitações';
      delete button.dataset.originalContent;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refreshClientOrdersButton');
  refreshButton?.addEventListener('click', () => loadClientOrders(refreshButton));
  loadClientOrders();
});
