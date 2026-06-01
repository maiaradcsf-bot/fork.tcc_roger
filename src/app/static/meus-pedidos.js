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

// Sempre buscar dados atualizados da API (sem cache local)

function setButtonLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Carregando...';
  } else {
    button.disabled = false;
    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
  }
}

function createClientOrderStatusBadge(status) {
  const normalized = (status || '').toString().toLowerCase();
  if (['approved', 'aprovado'].includes(normalized)) {
    return '<span class="badge bg-info text-dark status-badge">Aprovado (aguardando retirada)</span>';
  }
  if (['finished', 'completed', 'concluido', 'concluído', 'retirado'].includes(normalized)) {
    return '<span class="badge bg-primary status-badge">Retirado</span>';
  }
  if (['pending', 'initial', 'inicial', 'pendent', 'pendente'].includes(normalized)) {
    return '<span class="badge bg-warning text-dark status-badge">Aguardando aprovação</span>';
  }
  if (['rejected', 'rejeitado', 'rejeitada'].includes(normalized)) {
    return '<span class="badge bg-danger status-badge">Rejeitado</span>';
  }
  if (['cancelled', 'cancelado', 'canceled'].includes(normalized)) {
    return '<span class="badge bg-secondary status-badge">Cancelado</span>';
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
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Faça login para visualizar suas solicitações.</td></tr>';
    return;
  }

  if (button) {
    button.disabled = true;
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Carregando...';
  }
  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Carregando solicitações...</td></tr>';

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
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Nenhuma solicitação encontrada.</td></tr>';
      return;
    }

    // Não armazenamos em cache; renderiza sempre os dados retornados pela API
    tbody.innerHTML = orders.map((order, index) => {
      const normalizedStatus = (order.status || '').toString().toLowerCase();
      const actions = [];
      actions.push(`<button type="button" class="btn btn-info btn-sm" onclick="openClientOrderDetailModal(${order.id})">Detalhes</button>`);
      if (['pending', 'initial', 'inicial', 'pendent', 'pendente'].includes(normalizedStatus)) {
        actions.push(`<button type="button" class="btn btn-outline-danger btn-sm" onclick="handleClientOrderAction(${order.id}, 'cancel', this)">Cancelar</button>`);
      }

      return `
      <tr>
        <th scope="row">${index + 1}</th>
        <td>${summarizeOrderProducts(order)}</td>
        <td>${summarizeOrderQuantity(order)}</td>
        <td>${formatPrice(order.total)}</td>
        <td>${createClientOrderStatusBadge(order.status)}</td>
        <td>${formatOrderDate(order.created_at)}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm" role="group">
            ${actions.join('')}
          </div>
        </td>
      </tr>
    `;
    }).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-danger">Falha ao carregar solicitações: ${escapeHtml(error.message)}</td></tr>`;
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


async function openClientOrderDetailModal(orderId) {
  const modalLabel = document.getElementById('clientOrderDetailModalLabel');
  const clientField = document.getElementById('clientOrderDetailClient');
  const statusField = document.getElementById('clientOrderDetailStatus');
  const totalField = document.getElementById('clientOrderDetailTotal');
  const createdAtField = document.getElementById('clientOrderDetailCreatedAt');
  const itemsBody = document.getElementById('clientOrderDetailItemsBody');

  if (!modalLabel || !clientField || !statusField || !totalField || !createdAtField || !itemsBody) return;

  itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Carregando detalhes...</td></tr>`;
  modalLabel.textContent = 'Detalhes da Solicitação';

  try {
    const token = getClientToken();
    if (!token) throw new Error('Token não encontrado');
    const resp = await fetch(`/api/client/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.error || `Erro ${resp.status}`);
    }
    const order = await resp.json();
    clientField.textContent = order.client || '—';
    statusField.innerHTML = createClientOrderStatusBadge(order.status);
    totalField.textContent = formatPrice(order.total || 0);
    const reasonEl = document.getElementById('clientOrderDetailReason');
    if (reasonEl) reasonEl.textContent = order.reason || '--';
    createdAtField.textContent = formatOrderDate(order.created_at || order.createdAt || '');

    if (!Array.isArray(order.items) || order.items.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Nenhum produto encontrado.</td></tr>`;
    } else {
      itemsBody.innerHTML = order.items
        .map((item) => `
          <tr>
            <td>${escapeHtml(item.product || item.product_name || '—')}</td>
            <td>${escapeHtml(item.description || '—')}</td>
            <td>${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.product || 'Produto')}" style="height: 60px; width: auto; border-radius: 4px;">` : '—'}</td>
            <td>${item.quantity ?? '—'}</td>
            <td>${formatPrice(item.unit_price)}</td>
            <td>${formatPrice((item.unit_price || 0) * (item.quantity || 0))}</td>
          </tr>
        `)
        .join('');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('clientOrderDetailModal')).show();
  } catch (error) {
    showAlert('danger', `Erro ao carregar detalhes do pedido: ${error.message}`);
    itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Erro ao carregar detalhes.</td></tr>`;
  }
}

async function handleClientOrderAction(orderId, action, button) {
  if (!button) button = document.createElement('button');
  setButtonLoading(button, true);
  try {
    const token = getClientToken();
    if (!token) throw new Error('Token não encontrado');
    const resp = await fetch(`/api/client/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.error || `Erro ${resp.status}`);
    }
    showAlert('success', 'Solicitação atualizada.');
    await loadClientOrders();
  } catch (error) {
    showAlert('danger', `Falha ao atualizar solicitação: ${error.message}`);
  } finally {
    setButtonLoading(button, false);
  }
}
