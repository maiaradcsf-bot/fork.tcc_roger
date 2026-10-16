const API_BASE_URL = '/api/admin';
const $id = (id) => document.getElementById(id);
const ORDER_STATUS_GROUPS = {
  pending: ['pending', 'initial', 'inicial', 'pendent', 'pendente'],
  approved: ['approved', 'aprovado'],
  finished: ['finished', 'completed', 'concluido', 'concluído', 'retirado'],
  rejected: ['rejected', 'rejeitado', 'rejeitada'],
  cancelled: ['cancelled', 'cancelado', 'canceled'],
};
let productPhotoURL = ''; // Armazenar URL da imagem carregada
const alertContainer = $id('alertContainer');
const ordersTableBody = $id('ordersTableBody');
const categoriesTableBody = $id('categoriesTableBody');
const productsTableBody = $id('productsTableBody');
const stockMovesTableBody = $id('stockMovesTableBody');
const clientsTableBody = $id('clientsTableBody');
const summaryOrders = $id('summaryOrders');
const summaryCategories = $id('summaryCategories');
const summaryProducts = $id('summaryProducts');
const summaryClients = $id('summaryClients');
const summaryPendingOrders = $id('summaryPendingOrders');
const summaryStock = $id('summaryStock');
const summaryLowStock = $id('summaryLowStock');
const clientDetailName = $id('clientDetailName');
const clientDetailEmail = $id('clientDetailEmail');
const clientDetailPhone = $id('clientDetailPhone');
const clientDetailOrdersList = $id('clientDetailOrdersList');

const settingsUsersTableBody = $id('settingsUsersTableBody');
const settingsPermissionsTableBody = $id('settingsPermissionsTableBody');
const settingsProfilesTableBody = $id('settingsProfilesTableBody');
const settingsUserForm = $id('settingsUserForm');
const settingsPermissionForm = $id('settingsPermissionForm');
const settingsProfileForm = $id('settingsProfileForm');
const settingsUserRulesSelect = $id('settingsUserRulesSelect');
const settingsProfilePermissionsSelect = $id('settingsProfilePermissionsSelect');

let settingsUsersCache = [];
let settingsPermissionsCache = [];
let settingsProfilesCache = [];
let productsCache = [];
let pendingOrderAction = null;
let adminPermissions = [];

const IMPORT_FIELD_DEFS = [
  { key: 'name', label: 'Nome do produto', required: true },
  { key: 'barcode', label: 'Código de Barras (referência)', required: false },
  { key: 'price', label: 'Preço', required: true },
  { key: 'description', label: 'Descrição', required: false },
  { key: 'min_stock', label: 'Estoque mínimo', required: false },
  { key: 'max_stock', label: 'Estoque máximo', required: false },
  { key: 'stock_quantity', label: 'Quantidade em estoque', required: false },
  { key: 'category', label: 'Categoria', required: false },
];

let importState = {
  importId: null,
  headers: [],
  sampleRows: [],
  mapping: {},
  previewResult: null,
  completed: false,
};

$id('logoutButton')?.addEventListener('click', handleLogout);

function getAuthToken() {
  return window.appUtils.getStoredToken('admin_token');
}

function setStockFilterRange(days, shouldLoad = false) {
  const stockStartDate = $id('stockStartDate');
  const stockEndDate = $id('stockEndDate');
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - days);
  const start = startDateObj.toISOString().slice(0, 10);
  if (stockStartDate) stockStartDate.value = start;
  if (stockEndDate) stockEndDate.value = end;
  if (shouldLoad) {
    loadStockMoves();
  }
}

async function loadStockMoves(button = null) {
  const tableBody = $id('stockMovesTableBody');
  if (!tableBody) return;
  renderTablePlaceholder(tableBody, 5, 'Carregando movimentações...');
  setLoadingState(button, true);

  try {
    const params = [];
    const start = $id('stockStartDate')?.value;
    const end = $id('stockEndDate')?.value;
    if (start) params.push(`start_date=${encodeURIComponent(start)}`);
    if (end) params.push(`end_date=${encodeURIComponent(end)}`);
    const url = `/stock/moves${params.length ? '?' + params.join('&') : ''}`;
    const stockMoves = await fetchJson(url);
    if (Array.isArray(stockMoves) && stockMoves.length > 0) {
      tableBody.innerHTML = stockMoves
        .map((move) => {
          let actionCell = '—';
          if (move.is_reversal) {
            actionCell = '<span class="text-muted">Estorno</span>';
          } else if (move.reverted_at) {
            actionCell = '<span class="text-muted">Revertida</span>';
          } else if (move.order_id) {
            actionCell = `<span class="text-muted">Pedido #${move.order_id}</span>`;
          } else if (hasAdminPermission('admin.stock.moves.delete')) {
            actionCell = `<button type="button" class="btn btn-outline-warning btn-sm" onclick="revertStockMove(${move.id})"><i class="bi bi-arrow-counterclockwise me-1"></i>Voltar ao estoque</button>`;
          }
          return `
          <tr>
            <td>${move.product_name || move.product_id || move.stock_id || '—'}</td>
            <td>${move.quantity_change || '—'}</td>
            <td>${move.reason || '—'}</td>
            <td>${formatDate(move.created_at)}</td>
            <td class="text-center">${actionCell}</td>
          </tr>
        `;
        })
        .join('');
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">Nenhuma movimentação de estoque encontrada.</td>
        </tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5 text-danger">Falha ao carregar movimentações: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar movimentações: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

function buildAuthHeader() {
  return window.appUtils.buildAuthHeader(getAuthToken());
}

function escapeHtml(value) {
  return window.appUtils.escapeHtml(value);
}

function hasAdminPermission(permissionName) {
  if (!permissionName) return false;
  const requiredPermissions = permissionName.split('|').map((name) => name.trim()).filter(Boolean);
  if (!requiredPermissions.length) return false;
  return requiredPermissions.some((permission) => adminPermissions.includes(permission));
}

function showAdminPermissionElements() {
  document.querySelectorAll('[data-permission]').forEach((element) => {
    const requiredPermission = element.dataset.permission;
    if (requiredPermission && !hasAdminPermission(requiredPermission)) {
      element.remove();
    }
  });
}

async function loadAdminProfile() {
  try {
    const profile = await fetchJson('/me');
    adminPermissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    showAdminPermissionElements();
  } catch (error) {
    console.warn('Não foi possível carregar permissões de administrador:', error.message);
  }
}

function handleLogout() {
  localStorage.removeItem('admin_token');
  window.location.href = '/';
}

function showAlert(type, message) {
  return window.appUtils.showAlert(type, message, alertContainer);
}

function setLoadingState(button, loading) {
  return window.appUtils.setLoadingState(button, loading);
}

function renderTablePlaceholder(container, colspan, message = 'Carregando dados...') {
  return window.appUtils.renderTablePlaceholder(container, colspan, message);
}

function formatDate(dateString) {
  return window.appUtils.formatDate(dateString);
}

function createStatusBadge(status) {
  const normalized = (status || '').toString().toLowerCase();
  if (ORDER_STATUS_GROUPS.approved.includes(normalized)) {
    return '<span class="badge bg-info text-dark status-badge">Aprovado (aguardando retirada)</span>';
  }
  if (ORDER_STATUS_GROUPS.rejected.includes(normalized)) {
    return '<span class="badge bg-danger status-badge">Rejeitado</span>';
  }
  if (ORDER_STATUS_GROUPS.finished.includes(normalized)) {
    return '<span class="badge bg-primary status-badge">Retirado</span>';
  }
  if (ORDER_STATUS_GROUPS.pending.includes(normalized)) {
    return '<span class="badge bg-warning text-dark status-badge">Pendente (aguardando aprovação)</span>';
  }
  if (ORDER_STATUS_GROUPS.cancelled.includes(normalized)) {
    return '<span class="badge bg-secondary status-badge">Cancelado</span>';
  }
  return `<span class="badge bg-secondary status-badge">${(status || 'Desconhecido').toString().replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())}</span>`;
}

async function fetchJson(path, init = {}) {
  const token = getAuthToken();
  if (!token) {
    handleLogout();
    throw new Error('Token de autenticação não encontrado.');
  }

  const headers = {
    Accept: 'application/json',
    ...buildAuthHeader(),
    ...(init.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      showAlert('warning', 'Sessão expirada. Faça login novamente.');
      setTimeout(handleLogout, 1800);
    }
    const error = new Error(errorData?.error || `Erro ${response.status} ao acessar ${path}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json().catch(() => null);
}

async function loadDashboardSummary() {
  if (!summaryOrders && !summaryCategories && !summaryProducts && !summaryClients && !summaryPendingOrders && !summaryStock) return;

  try {
    const [orders, categories, products, clients, stockItems] = await Promise.all([
      fetchJson('/orders').catch(() => []),
      fetchJson('/categories').catch(() => []),
      fetchJson('/products').catch(() => []),
      fetchJson('/clients').catch(() => []),
      fetchJson('/stock').catch(() => []),
    ]);

    if (summaryOrders) summaryOrders.textContent = Array.isArray(orders) ? orders.length : '—';
    if (summaryCategories) summaryCategories.textContent = Array.isArray(categories) ? categories.length : '—';
    if (summaryProducts) summaryProducts.textContent = Array.isArray(products) ? products.length : '—';
    if (summaryClients) summaryClients.textContent = Array.isArray(clients) ? clients.length : '—';
    const lowStockProducts = Array.isArray(products)
      ? products.filter((product) => {
          const stock = Number(product.stock || 0);
          const minStock = product.min_stock === null || product.min_stock === undefined ? null : Number(product.min_stock);
          return minStock !== null && Number.isFinite(stock) && Number.isFinite(minStock) && stock <= minStock;
        })
      : [];
    if (summaryLowStock) {
      summaryLowStock.textContent = Array.isArray(lowStockProducts) ? lowStockProducts.length : '—';
    }
    renderLowStockList(lowStockProducts);
    if (summaryPendingOrders) {
      const pendingCount = Array.isArray(orders)
        ? orders.filter((order) => ORDER_STATUS_GROUPS.pending.includes((order.status || '').toString().toLowerCase())).length
        : '—';
      summaryPendingOrders.textContent = pendingCount;
    }
    if (summaryStock) {
      const quantity = Array.isArray(stockItems)
        ? stockItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
        : '—';
      summaryStock.textContent = quantity;
    }
  } catch (error) {
    showAlert('danger', `Não foi possível carregar o resumo do dashboard: ${error.message}`);
  }
}

async function loadOrders(button = null) {
  if (!ordersTableBody) return;
  renderTablePlaceholder(ordersTableBody, 8, 'Carregando pedidos...');
  setLoadingState(button, true);

  try {
    const orders = await fetchJson('/orders');

    if (!Array.isArray(orders) || orders.length === 0) {
      ordersTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">Nenhuma solicitação encontrada.</td>
        </tr>
      `;
      return;
    }

    ordersTableBody.innerHTML = orders
      .map((order, index) => {
        const statusBadge = createStatusBadge(order.status);
        const createdAt = formatDate(order.created_at || order.createdAt || '');
        const productName = order.product_name || order.product || '—';
        const clientName = order.client || order.client_name || '—';
        const quantity = order.quantity ?? order.qty ?? '—';

        const normalizedStatus = (order.status || '').toString().toLowerCase();
        const actionButtons = [];
        if (ORDER_STATUS_GROUPS.pending.includes(normalizedStatus)) {
          if (hasAdminPermission('admin.orders.approve')) {
            actionButtons.push(`<button type="button" class="btn btn-success" onclick="openOrderActionConfirm(${order.id}, 'approve', this)">Aprovar</button>`);
          }
          if (hasAdminPermission('admin.orders.reject')) {
            actionButtons.push(`<button type="button" class="btn btn-danger" onclick="openOrderActionConfirm(${order.id}, 'reject', this)">Rejeitar</button>`);
          }
          if (hasAdminPermission('admin.orders.cancel')) {
            actionButtons.push(`<button type="button" class="btn btn-outline-danger" onclick="openOrderActionConfirm(${order.id}, 'cancel', this)">Cancelar</button>`);
          }
        }
        if (ORDER_STATUS_GROUPS.approved.includes(normalizedStatus)) {
          if (hasAdminPermission('admin.orders.approve')) {
            actionButtons.push(`<button type="button" class="btn btn-primary" onclick="openOrderActionConfirm(${order.id}, 'finish', this)">Retirado</button>`);
          }
          if (hasAdminPermission('admin.orders.cancel')) {
            actionButtons.push(`<button type="button" class="btn btn-outline-danger" onclick="openOrderActionConfirm(${order.id}, 'cancel', this)">Cancelar</button>`);
          }
        }
        if (ORDER_STATUS_GROUPS.finished.includes(normalizedStatus)) {
          if (hasAdminPermission('admin.orders.cancel')) {
            actionButtons.push(`<button type="button" class="btn btn-outline-warning" onclick="openOrderActionConfirm(${order.id}, 'cancel', this, true)"><i class="bi bi-arrow-counterclockwise me-1"></i>Devolver ao estoque</button>`);
          }
        }

        return `
          <tr>
            <th scope="row">${index + 1}</th>
            <td>${clientName}</td>
            <td>${order.product_summary || '—'}</td>
            <td>${order.quantity_total ?? quantity}</td>
            <td>R$ ${Number(order.total || 0).toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>${createdAt}</td>
            <td class="text-center">
              <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-info" onclick="openOrderDetailModal(${order.id})">Detalhes</button>
                ${actionButtons.join('')}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-danger">Falha ao carregar pedidos: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar pedidos: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

function renderLowStockList(items) {
  const container = $id('lowStockList');
  if (!container) return;
  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = '<div class="text-muted">Nenhum produto próximo do estoque mínimo.</div>';
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm mb-0 align-middle">
        <thead class="table-light">
          <tr>
            <th>Produto</th>
            <th>Estoque atual</th>
            <th>Estoque mínimo</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((p) => `
            <tr>
              <td class="py-2">${escapeHtml(p.name || p.product || '—')}</td>
              <td class="py-2">${p.stock ?? '—'}</td>
              <td class="py-2">${p.min_stock ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openStockMoveForProduct(productId) {
  try {
    const stockItems = await fetchJson('/stock');
    const matching = Array.isArray(stockItems) ? stockItems.find((s) => Number(s.product_id) === Number(productId)) : null;
    await loadStockItems();
    if (matching) {
      const select = $id('stockItemSelect');
      if (select) select.value = matching.id;
    }
    openStockMoveModal();
  } catch (error) {
    showAlert('danger', `Erro ao abrir movimentação: ${error.message}`);
  }
}

const ORDER_ACTION_CONFIRM_CONFIGS = {
  approve: { text: 'aprovar', className: 'btn btn-primary', buttonText: 'Confirmar' },
  reject: { text: 'rejeitar', className: 'btn btn-danger', buttonText: 'Confirmar' },
  cancel: { text: 'cancelar', className: 'btn btn-outline-danger', buttonText: 'Confirmar' },
  finish: { text: 'marcar como retirado', className: 'btn btn-primary', buttonText: 'Retirado' },
};

function openOrderActionConfirm(orderId, action, button, restoresStock = false) {
  const modal = $id('orderActionConfirmModal');
  const message = $id('orderActionConfirmMessage');
  const confirmButton = $id('orderActionConfirmButton');
  if (!modal || !message || !confirmButton) return;

  pendingOrderAction = { orderId, action, button };

  if (restoresStock) {
    message.textContent = 'Tem certeza que deseja cancelar esta solicitação já retirada? A quantidade baixada será devolvida ao estoque automaticamente.';
    confirmButton.className = 'btn btn-warning text-dark';
    confirmButton.textContent = 'Devolver ao estoque';
  } else {
    const config = ORDER_ACTION_CONFIRM_CONFIGS[action] || { text: 'realizar esta ação', className: 'btn btn-primary', buttonText: 'Confirmar' };
    message.textContent = `Tem certeza que deseja ${config.text} esta solicitação?`;
    confirmButton.className = config.className;
    confirmButton.textContent = config.buttonText;
  }

  bootstrap.Modal.getOrCreateInstance(modal).show();
}

async function confirmOrderAction() {
  if (!pendingOrderAction) return;
  const { orderId, action, button } = pendingOrderAction;
  pendingOrderAction = null;
  $id('orderActionConfirmModal')?.querySelector('[data-bs-dismiss]')?.click();
  await handleAdminOrderAction(orderId, action, button);
}

async function openOrderDetailModal(orderId) {
  const modalLabel = $id('orderDetailModalLabel');
  const clientField = $id('orderDetailClient');
  const statusField = $id('orderDetailStatus');
  const totalField = $id('orderDetailTotal');
  const reasonRow = $id('orderDetailReasonRow');
  const reasonField = $id('orderDetailReason');
  const createdAtField = $id('orderDetailCreatedAt');
  const auditContainer = $id('orderDetailAudit');
  const itemsBody = $id('orderDetailItemsBody');

  if (!modalLabel || !clientField || !statusField || !totalField || !reasonRow || !reasonField || !createdAtField || !auditContainer || !itemsBody) return;

  itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Carregando detalhes...</td></tr>`;
  modalLabel.textContent = 'Detalhes da Solicitação';

  try {
    const order = await fetchJson(`/orders/${orderId}`);
    clientField.textContent = order.client || order.client_name || '—';
    statusField.innerHTML = createStatusBadge(order.status);
    const reason = order.reason ? order.reason.trim() : '';
    if (reason) {
      reasonField.textContent = reason;
      reasonRow.classList.remove('d-none');
    } else {
      reasonField.textContent = '';
      reasonRow.classList.add('d-none');
    }
    // Use o total retornado pelo backend quando disponível, caso contrário calcule a partir dos itens
    let displayedTotal = Number(order.total || 0);
    if ((!displayedTotal || displayedTotal === 0) && Array.isArray(order.items) && order.items.length > 0) {
      displayedTotal = order.items.reduce((sum, it) => {
        const price = Number(it.unit_price ?? it.unitPrice ?? 0);
        const qty = Number(it.quantity ?? 0);
        return sum + price * qty;
      }, 0);
    }
    totalField.textContent = `R$ ${Number(displayedTotal || 0).toFixed(2)}`;
    createdAtField.textContent = formatDate(order.created_at || order.createdAt || '');

    const auditEntries = [];
    if (order.approved_at) {
      auditEntries.push(`<div class="mb-2"><strong>Aprovado em:</strong> ${formatDate(order.approved_at)}${order.approved_by_name ? ` <span class="text-muted">por ${escapeHtml(order.approved_by_name)}</span>` : ''}</div>`);
    }
    if (order.refused_at) {
      auditEntries.push(`<div class="mb-2"><strong>Rejeitado em:</strong> ${formatDate(order.refused_at)}${order.refused_by_name ? ` <span class="text-muted">por ${escapeHtml(order.refused_by_name)}</span>` : ''}</div>`);
    }
    if (order.finished_at) {
      auditEntries.push(`<div class="mb-2"><strong>Retirado em:</strong> ${formatDate(order.finished_at)}${order.finished_by_name ? ` <span class="text-muted">por ${escapeHtml(order.finished_by_name)}</span>` : ''}</div>`);
    }
    if (order.canceled_at) {
      const canceledBy = order.canceled_by_name || order.canceled_by_client_name || '';
      auditEntries.push(`<div class="mb-2"><strong>Cancelado em:</strong> ${formatDate(order.canceled_at)}${canceledBy ? ` <span class="text-muted">por ${escapeHtml(canceledBy)}</span>` : ''}</div>`);
    }
    auditContainer.innerHTML = auditEntries.length ? auditEntries.join('') : '<p class="mb-0 text-muted">Nenhuma ação adicional registrada.</p>';

    if (!Array.isArray(order.items) || order.items.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Nenhum produto encontrado.</td></tr>`;
    } else {
      itemsBody.innerHTML = order.items
        .map((item) => {
          const productName = item.product || item.product_name || '—';
          const img = item.image_url ? `<img src="${item.image_url}" alt="${productName}" style="height: 50px; width: auto; border-radius: 4px; margin-right: 10px; vertical-align: middle;">` : '';
          const barcode = item.barcode || item.product_barcode || '—';
          return `
            <tr>
              <td>${img}<span style="vertical-align: middle;">${productName}</span></td>
              <td>${item.description || '—'}</td>
              <td>${barcode}</td>
              <td>${item.quantity ?? '—'}</td>
              <td>R$ ${Number(item.unit_price || 0).toFixed(2)}</td>
              <td>R$ ${Number((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</td>
            </tr>
          `;
        })
        .join('');
    }

    bootstrap.Modal.getOrCreateInstance($id('orderDetailModal')).show();
  } catch (error) {
    showAlert('danger', `Erro ao carregar detalhes do pedido: ${error.message}`);
    itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Erro ao carregar detalhes.</td></tr>`;
  }
}

async function loadCategories(button = null) {
  if (!categoriesTableBody) return;
  renderTablePlaceholder(categoriesTableBody, 6, 'Carregando categorias...');
  setLoadingState(button, true);

  try {
    const categories = await fetchJson('/categories');
    if (!Array.isArray(categories) || categories.length === 0) {
      categoriesTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-5 text-muted">Nenhuma categoria encontrada.</td>
          </tr>
        `;
      return;
    }

    const categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat.id] = cat.name;
    });

    categoriesTableBody.innerHTML = categories
      .map((category, index) => {
        const parentName = category.parent_id ? (categoryMap[category.parent_id] || 'Categoria não encontrada') : 'Principal';
        return `
        <tr>
          <th scope="row">${index + 1}</th>
          <td>${category.name || '—'}</td>
          <td>${category.parent_id ? 'Subcategoria' : 'Categoria'}</td>
          <td>${category.description || '—'}</td>
          <td>${category.parent_id ? parentName : ''}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              ${hasAdminPermission('admin.categories.edit') ? `<button type="button" class="btn btn-outline-secondary" onclick="openCategoryModal('edit', ${category.id})">Editar</button>` : ''}
              ${hasAdminPermission('admin.categories.delete') ? `<button type="button" class="btn btn-outline-danger" onclick='deleteCategory(${category.id}, ${JSON.stringify(category.name)})'>Excluir</button>` : ''}
            </div>
          </td>
        </tr>
      `;
      })
      .join('');
  } catch (error) {
    categoriesTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-danger">Falha ao carregar categorias: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar categorias: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

async function loadProducts(button = null) {
  if (!productsTableBody && !stockMovesTableBody) return;
  if (productsTableBody) renderTablePlaceholder(productsTableBody, 9, 'Carregando produtos...');
  if (stockMovesTableBody) renderTablePlaceholder(stockMovesTableBody, 4, 'Carregando movimentações...');
  setLoadingState(button, true);

  try {
    const products = productsTableBody ? await fetchJson('/products') : [];
    if (productsTableBody) {
      productsCache = Array.isArray(products) ? products : [];
      if (!Array.isArray(products) || products.length === 0) {
        productsTableBody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center py-5 text-muted">Nenhum produto encontrado.</td>
          </tr>
        `;
      } else {
        productsTableBody.innerHTML = products
          .map((product, index) => {
            const categoriesText = Array.isArray(product.categories) && product.categories.length
              ? product.categories.map((cat) => cat.path || cat.name).join(', ')
              : '—';
            return `
              <tr data-product-id="${product.id}">
                <th scope="row">${index + 1}</th>
                <td>
                  ${product.photo_path ? `<img src="${product.photo_path}" alt="${product.name}" style="height: 40px; width: auto; border-radius: 4px; margin-right: 8px;">` : ''}
                  ${product.name || '—'}
                </td>
                <td>${escapeHtml(product.barcode || '—')}</td>
                <td>${escapeHtml(categoriesText)}</td>
                <td>R$ ${Number(product.price || 0).toFixed(2)}</td>
                <td>${product.stock ?? '—'}</td>
                <td>${product.min_stock ?? '—'}</td>
                <td>${product.max_stock ?? '—'}</td>
                <td class="text-center">
                  <div class="btn-group btn-group-sm" role="group">
                    ${hasAdminPermission('admin.products.edit') ? `<button type="button" class="btn btn-outline-secondary" onclick="openProductModal('edit', ${product.id})">Editar</button>` : ''}
                    ${hasAdminPermission('admin.products.delete') ? `<button type="button" class="btn btn-outline-danger" onclick='deleteProduct(${product.id}, ${JSON.stringify(product.name)})'>Excluir</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          })
          .join('');
      }
    }

    // stock moves rendering moved to separate page; loadStockMoves handles its rendering
  } catch (error) {
    if (productsTableBody) {
      productsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5 text-danger">Falha ao carregar produtos: ${error.message}</td>
        </tr>
      `;
    }
    if (stockMovesTableBody) {
      stockMovesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-danger">Falha ao carregar movimentações: ${error.message}</td>
        </tr>
      `;
    }
    showAlert('danger', `Erro ao carregar produtos/estoque: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

const EXPORT_FIELD_DEFS = [
  { key: 'id', label: 'ID', value: (p) => p.id },
  { key: 'name', label: 'Nome', value: (p) => p.name || '' },
  { key: 'description', label: 'Descrição', value: (p) => p.description || '' },
  { key: 'barcode', label: 'Código de Barras', value: (p) => p.barcode || '' },
  { key: 'categories', label: 'Categoria', value: (p) => (Array.isArray(p.categories) && p.categories.length ? p.categories.map((cat) => cat.path || cat.name).join(', ') : '') },
  { key: 'price', label: 'Preço', value: (p) => Number(p.price || 0).toFixed(2) },
  { key: 'stock', label: 'Estoque Atual', value: (p) => p.stock ?? '' },
  { key: 'min_stock', label: 'Estoque Mínimo', value: (p) => p.min_stock ?? '' },
  { key: 'max_stock', label: 'Estoque Máximo', value: (p) => p.max_stock ?? '' },
  { key: 'stock_status', label: 'Status do Estoque', value: (p) => getStockStatusLabel(p) },
];

function getStockStatusLabel(product) {
  const stock = Number(product.stock ?? 0);
  if (stock <= 0) return 'Sem estoque';
  if (product.min_stock !== null && product.min_stock !== undefined && stock <= Number(product.min_stock)) return 'Estoque baixo';
  return 'Normal';
}

function getVisibleExportProducts() {
  if (!productsTableBody) return [];
  const productById = new Map(productsCache.map((p) => [Number(p.id), p]));
  return Array.from(productsTableBody.querySelectorAll('tr[data-product-id]'))
    .filter((row) => row.offsetParent !== null && !row.classList.contains('d-none'))
    .map((row) => productById.get(Number(row.dataset.productId)))
    .filter(Boolean);
}

function renderExportColumnsList() {
  const container = $id('exportColumnsList');
  if (!container) return;
  container.innerHTML = EXPORT_FIELD_DEFS.map((field) => `
    <div class="form-check">
      <input class="form-check-input" type="checkbox" value="${field.key}" id="exportColumnOption${field.key}" checked>
      <label class="form-check-label" for="exportColumnOption${field.key}">${escapeHtml(field.label)}</label>
    </div>
  `).join('');
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function openExportModal() {
  const visibleProducts = getVisibleExportProducts();
  const countEl = $id('exportProductsCount');
  if (countEl) countEl.textContent = visibleProducts.length;
  renderExportColumnsList();
  openModal('exportProductsModal');
}

function exportProductsToCsv() {
  const container = $id('exportColumnsList');
  const selectedKeys = Array.from(container?.querySelectorAll('input[type="checkbox"]:checked') || []).map((input) => input.value);
  if (!selectedKeys.length) {
    showAlert('warning', 'Selecione ao menos uma coluna para exportar.');
    return;
  }

  const products = getVisibleExportProducts();
  if (!products.length) {
    showAlert('warning', 'Não há produtos na listagem atual para exportar.');
    return;
  }

  const fields = EXPORT_FIELD_DEFS.filter((field) => selectedKeys.includes(field.key));
  const header = fields.map((field) => escapeCsvValue(field.label)).join(',');
  const rows = products.map((product) => fields.map((field) => escapeCsvValue(field.value(product))).join(','));
  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `produtos_export_${today}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  bootstrap.Modal.getInstance($id('exportProductsModal'))?.hide();
  showAlert('success', `${products.length} produto(s) exportado(s) com sucesso.`);
}

async function loadClients(button = null) {
  if (!clientsTableBody) return;
  renderTablePlaceholder(clientsTableBody, 5, 'Carregando clientes...');
  setLoadingState(button, true);

  try {
    const clients = await fetchJson('/clients');
    if (!Array.isArray(clients) || clients.length === 0) {
      clientsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">Nenhum cliente encontrado.</td>
        </tr>
      `;
      return;
    }

    clientsTableBody.innerHTML = clients
      .map((client, index) => `
        <tr>
          <th scope="row">${index + 1}</th>
          <td>${client.name || '—'}</td>
          <td>${client.email || '—'}</td>
          <td>${client.phone || '—'}</td>
          <td>${client.active ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>'}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-primary btn-sm btn-detail-client" data-client-id="${client.id}">Ver detalhes</button>
              <button type="button" class="btn btn-outline-${client.active ? 'danger' : 'success'} btn-sm" onclick="openClientDeactivateModal(${client.id}, '${(client.name || 'Cliente').replace(/'/g, "\'")}', ${client.active})">${client.active ? 'Inativar' : 'Reativar'}</button>
            </div>
          </td>
        </tr>
      `)
      .join('');
  } catch (error) {
    clientsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-danger">Falha ao carregar clientes: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar clientes: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

function renderClientOrdersList(orders) {
  if (!clientDetailOrdersList) return;
  if (!Array.isArray(orders) || orders.length === 0) {
    clientDetailOrdersList.innerHTML = '<p class="text-muted">Nenhuma solicitação encontrada para este cliente.</p>';
    return;
  }

  clientDetailOrdersList.innerHTML = orders
    .map((order) => `
      <div class="border rounded-3 p-3 mb-3">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-2">
          <div>
            <strong>Pedido #${order.id}</strong>
            <div class="text-muted small">${order.created_at ? new Date(order.created_at).toLocaleString() : 'Data indisponível'}</div>
          </div>
          <div class="text-end">
            ${createStatusBadge(order.status)}
          </div>
        </div>
        <div class="mb-3">
          <span class="badge bg-light text-dark me-2">Total: R$ ${Number(order.total || 0).toFixed(2)}</span>
          <span class="badge bg-light text-dark me-2">Itens: ${order.product_lines || 0}</span>
          <span class="badge bg-light text-dark">Quantidade: ${order.quantity || 0}</span>
        </div>
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead class="table-light">
              <tr>
                <th>Produto</th>
                <th class="text-end">Quantidade</th>
                <th class="text-end">Preço unitário</th>
                <th class="text-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${order.items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.product_name || '—'}</td>
                      <td class="text-end">${item.quantity ?? 0}</td>
                      <td class="text-end">R$ ${Number(item.unit_price || 0).toFixed(2)}</td>
                      <td class="text-end">R$ ${Number((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `)
    .join('');
}

async function openClientDetailModal(clientId) {
  if (!clientDetailName || !clientDetailEmail || !clientDetailPhone || !clientDetailOrdersList) return;

  clientDetailName.textContent = 'Carregando...';
  clientDetailEmail.textContent = 'Carregando...';
  clientDetailPhone.textContent = 'Carregando...';
  clientDetailOrdersList.innerHTML = '<p class="text-muted">Carregando solicitações...</p>';

  try {
    const details = await fetchJson(`/clients/${clientId}/details`);
    clientDetailName.textContent = details.name || '—';
    clientDetailEmail.textContent = details.email || '—';
    clientDetailPhone.textContent = details.phone || '—';
    renderClientOrdersList(details.orders || []);
    openModalById('clientDetailModal');
  } catch (error) {
    showAlert('danger', `Erro ao carregar dados do cliente: ${error.message}`);
  }
}

async function loadSettingsRulesOptions(selectedIds = []) {
  if (!settingsUserRulesSelect && !settingsProfilePermissionsSelect) return;

  try {
    const rules = await fetchJson('/rules');
    settingsUsersCache = settingsUsersCache || [];
    settingsProfilesCache = settingsProfilesCache || [];

    if (settingsUserRulesSelect) {
      settingsUserRulesSelect.innerHTML = rules.length
        ? rules.map((rule) => `
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="${rule.id}" id="settingsUserRuleOption${rule.id}" ${selectedIds.includes(rule.id) ? 'checked' : ''}>
              <label class="form-check-label" for="settingsUserRuleOption${rule.id}">${escapeHtml(rule.name)}</label>
            </div>
          `).join('')
        : '<p class="text-muted mb-0">Nenhum perfil cadastrado.</p>';
    }

    if (settingsProfilePermissionsSelect) {
      const permissions = await fetchJson('/permissions');
      settingsProfilePermissionsSelect.innerHTML = permissions.length
        ? permissions.map((permission) => `
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="${permission.id}" id="settingsProfilePermissionOption${permission.id}" ${selectedIds.includes(permission.id) ? 'checked' : ''}>
              <label class="form-check-label" for="settingsProfilePermissionOption${permission.id}">${escapeHtml(permission.name)}</label>
            </div>
          `).join('')
        : '<p class="text-muted mb-0">Nenhuma permissão cadastrada.</p>';
    }
  } catch (error) {
    showAlert('danger', `Erro ao carregar opções de configurações: ${error.message}`);
  }
}

async function loadSettingsUsers(button = null) {
  if (!settingsUsersTableBody) return;
  renderTablePlaceholder(settingsUsersTableBody, 6, 'Carregando usuários...');
  setLoadingState(button, true);

  try {
    const users = await fetchJson('/users');
    settingsUsersCache = users || [];

    if (!Array.isArray(users) || users.length === 0) {
      settingsUsersTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">Nenhum usuário encontrado.</td>
        </tr>
      `;
      return;
    }

    settingsUsersTableBody.innerHTML = users
      .map((user, index) => {
        const ruleNames = Array.isArray(user.rules) ? user.rules.map((rule) => rule.name).join(', ') : '—';
        return `
          <tr>
            <th scope="row">${index + 1}</th>
            <td>${user.username || '—'}</td>
            <td>${user.email || '—'}</td>
            <td>${ruleNames}</td>
            <td>${formatDate(user.created_at)}</td>
            <td class="text-center">
              <div class="btn-group btn-group-sm" role="group">
                ${hasAdminPermission('admin.settings.users.manage') ? `<button type="button" class="btn btn-outline-secondary" onclick="openSettingsUserModal('edit', ${user.id})">Editar</button>` : ''}
                ${hasAdminPermission('admin.settings.users.manage') ? `<button type="button" class="btn btn-outline-danger" onclick="deleteSettingsUser(${user.id})">Excluir</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    settingsUsersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-danger">Falha ao carregar usuários: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar usuários: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

async function loadSettingsPermissions(button = null) {
  if (!settingsPermissionsTableBody) return;
  renderTablePlaceholder(settingsPermissionsTableBody, 4, 'Carregando permissões...');
  setLoadingState(button, true);

  try {
    const permissions = await fetchJson('/permissions');
    settingsPermissionsCache = permissions || [];

    if (!Array.isArray(permissions) || permissions.length === 0) {
      settingsPermissionsTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-5 text-muted">Nenhuma permissão encontrada.</td>
        </tr>
      `;
      return;
    }

    settingsPermissionsTableBody.innerHTML = permissions
      .map((permission, index) => `
        <tr>
          <th scope="row">${index + 1}</th>
          <td>${permission.name || '—'}</td>
          <td>${permission.description || '—'}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              ${hasAdminPermission('admin.settings.permissions.manage') ? `<button type="button" class="btn btn-outline-secondary" onclick="openSettingsPermissionModal('edit', ${permission.id})">Editar</button>` : ''}
              ${hasAdminPermission('admin.settings.permissions.manage') ? `<button type="button" class="btn btn-outline-danger" onclick="deleteSettingsPermission(${permission.id})">Excluir</button>` : ''}
            </div>
          </td>
        </tr>
      `)
      .join('');
  } catch (error) {
    settingsPermissionsTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-5 text-danger">Falha ao carregar permissões: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar permissões: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

async function loadSettingsProfiles(button = null) {
  if (!settingsProfilesTableBody) return;
  renderTablePlaceholder(settingsProfilesTableBody, 5, 'Carregando perfis...');
  setLoadingState(button, true);

  try {
    const profiles = await fetchJson('/rules');
    settingsProfilesCache = profiles || [];

    if (!Array.isArray(profiles) || profiles.length === 0) {
      settingsProfilesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">Nenhum perfil encontrado.</td>
        </tr>
      `;
      return;
    }

    settingsProfilesTableBody.innerHTML = profiles
      .map((profile, index) => {
        const permissionNames = Array.isArray(profile.permissions) ? profile.permissions.map((permission) => permission.name).join(', ') : '—';
        return `
          <tr>
            <th scope="row">${index + 1}</th>
            <td>${profile.name || '—'}</td>
            <td>${profile.description || '—'}</td>
            <td>${permissionNames}</td>
            <td class="text-center">
              <div class="btn-group btn-group-sm" role="group">
                ${hasAdminPermission('admin.settings.profiles.manage') ? `<button type="button" class="btn btn-outline-secondary" onclick="openSettingsProfileModal('edit', ${profile.id})">Editar</button>` : ''}
                ${hasAdminPermission('admin.settings.profiles.manage') ? `<button type="button" class="btn btn-outline-danger" onclick="deleteSettingsProfile(${profile.id})">Excluir</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    settingsProfilesTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5 text-danger">Falha ao carregar perfis: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar perfis: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

function openModalById(modalId) {
  const element = $id(modalId);
  if (!element) return null;
  const modal = new bootstrap.Modal(element);
  modal.show();
  return modal;
}

async function openSettingsUserModal(mode, userId = null) {
  const title = $id('settingsUserModalLabel');
  const userIdField = $id('settingsUserId');
  const usernameField = $id('settingsUserUsername');
  const emailField = $id('settingsUserEmail');
  const passwordField = $id('settingsUserPassword');

  if (!title || !userIdField || !usernameField || !emailField || !passwordField) return;

  if (mode === 'edit' && userId !== null) {
    const user = settingsUsersCache.find((item) => item.id === userId);
    if (!user) {
      showAlert('danger', 'Usuário não encontrado para edição.');
      return;
    }
    title.textContent = 'Editar Usuário';
    userIdField.value = user.id;
    usernameField.value = user.username || '';
    emailField.value = user.email || '';
    passwordField.value = '';
    await loadSettingsRulesOptions((user.rules || []).map((rule) => rule.id));
  } else {
    title.textContent = 'Novo Usuário';
    userIdField.value = '';
    usernameField.value = '';
    emailField.value = '';
    passwordField.value = '';
    await loadSettingsRulesOptions([]);
  }

  openModalById('settingsUserModal');
}

async function saveSettingsUser(event) {
  if (!settingsUserForm) return;
  event.preventDefault();

  const userId = $id('settingsUserId').value;
  const username = $id('settingsUserUsername').value.trim();
  const email = $id('settingsUserEmail').value.trim();
  const password = $id('settingsUserPassword').value;
  const ruleIds = Array.from(settingsUserRulesSelect?.querySelectorAll('input[type="checkbox"]:checked') || []).map((input) => Number(input.value));
  const submitButton = event.submitter || settingsUserForm.querySelector('button[type="submit"]');

  if (!username || !email) {
    showAlert('warning', 'Preencha usuário e e-mail.');
    return;
  }

  setLoadingState(submitButton, true);

  try {
    const payload = { username, email, rule_ids: ruleIds };
    if (password) payload.password = password;
    if (userId) {
      await fetchJson(`/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Usuário atualizado com sucesso.');
    } else {
      if (!password) {
        showAlert('warning', 'Senha é obrigatória para novo usuário.');
        return;
      }
      await fetchJson('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Usuário criado com sucesso.');
    }
    bootstrap.Modal.getInstance($id('settingsUserModal'))?.hide();
    await loadSettingsUsers();
  } catch (error) {
    showAlert('danger', `Erro ao salvar usuário: ${error.message}`);
  } finally {
    setLoadingState(submitButton, false);
  }
}

async function deleteSettingsUser(userId) {
  if (!confirm('Deseja excluir este usuário?')) return;
  try {
    await fetchJson(`/users/${userId}`, { method: 'DELETE' });
    showAlert('success', 'Usuário excluído com sucesso.');
    await loadSettingsUsers();
  } catch (error) {
    showAlert('danger', `Erro ao excluir usuário: ${error.message}`);
  }
}

function openSettingsPermissionModal(mode, permissionId = null) {
  const title = $id('settingsPermissionModalLabel');
  const idField = $id('settingsPermissionId');
  const nameField = $id('settingsPermissionName');
  const descField = $id('settingsPermissionDescription');

  if (!title || !idField || !nameField || !descField) return;

  if (mode === 'edit' && permissionId !== null) {
    const permission = settingsPermissionsCache.find((item) => item.id === permissionId);
    if (!permission) {
      showAlert('danger', 'Permissão não encontrada para edição.');
      return;
    }
    title.textContent = 'Editar Permissão';
    idField.value = permission.id;
    nameField.value = permission.name || '';
    descField.value = permission.description || '';
  } else {
    title.textContent = 'Nova Permissão';
    idField.value = '';
    nameField.value = '';
    descField.value = '';
  }

  openModalById('settingsPermissionModal');
}

async function saveSettingsPermission(event) {
  if (!settingsPermissionForm) return;
  event.preventDefault();

  const permissionId = $id('settingsPermissionId').value;
  const name = $id('settingsPermissionName').value.trim();
  const description = $id('settingsPermissionDescription').value.trim();
  const submitButton = event.submitter || settingsPermissionForm.querySelector('button[type="submit"]');

  if (!name) {
    showAlert('warning', 'O nome da permissão é obrigatório.');
    return;
  }

  setLoadingState(submitButton, true);

  try {
    const payload = { name, description };
    if (permissionId) {
      await fetchJson(`/permissions/${permissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Permissão atualizada com sucesso.');
    } else {
      await fetchJson('/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Permissão criada com sucesso.');
    }
    bootstrap.Modal.getInstance($id('settingsPermissionModal'))?.hide();
    await loadSettingsPermissions();
  } catch (error) {
    showAlert('danger', `Erro ao salvar permissão: ${error.message}`);
  } finally {
    setLoadingState(submitButton, false);
  }
}

async function deleteSettingsPermission(permissionId) {
  if (!confirm('Deseja excluir esta permissão?')) return;
  try {
    await fetchJson(`/permissions/${permissionId}`, { method: 'DELETE' });
    showAlert('success', 'Permissão excluída com sucesso.');
    await loadSettingsPermissions();
  } catch (error) {
    showAlert('danger', `Erro ao excluir permissão: ${error.message}`);
  }
}

async function openSettingsProfileModal(mode, profileId = null) {
  const title = $id('settingsProfileModalLabel');
  const idField = $id('settingsProfileId');
  const nameField = $id('settingsProfileName');
  const descField = $id('settingsProfileDescription');

  if (!title || !idField || !nameField || !descField) return;

  if (mode === 'edit' && profileId !== null) {
    const profile = settingsProfilesCache.find((item) => item.id === profileId);
    if (!profile) {
      showAlert('danger', 'Perfil não encontrado para edição.');
      return;
    }
    title.textContent = 'Editar Perfil';
    idField.value = profile.id;
    nameField.value = profile.name || '';
    descField.value = profile.description || '';
    await loadSettingsRulesOptions((profile.permission_ids || []));
  } else {
    title.textContent = 'Novo Perfil';
    idField.value = '';
    nameField.value = '';
    descField.value = '';
    await loadSettingsRulesOptions([]);
  }

  openModalById('settingsProfileModal');
}

async function saveSettingsProfile(event) {
  if (!settingsProfileForm) return;
  event.preventDefault();

  const profileId = $id('settingsProfileId').value;
  const name = $id('settingsProfileName').value.trim();
  const description = $id('settingsProfileDescription').value.trim();
  const permissionIds = Array.from(settingsProfilePermissionsSelect?.querySelectorAll('input[type="checkbox"]:checked') || []).map((input) => Number(input.value));
  const submitButton = event.submitter || settingsProfileForm.querySelector('button[type="submit"]');

  if (!name) {
    showAlert('warning', 'O nome do perfil é obrigatório.');
    return;
  }

  setLoadingState(submitButton, true);

  try {
    const payload = { name, description, permission_ids: permissionIds };
    if (profileId) {
      await fetchJson(`/rules/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Perfil atualizado com sucesso.');
    } else {
      await fetchJson('/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Perfil criado com sucesso.');
    }
    bootstrap.Modal.getInstance($id('settingsProfileModal'))?.hide();
    await loadSettingsProfiles();
  } catch (error) {
    showAlert('danger', `Erro ao salvar perfil: ${error.message}`);
  } finally {
    setLoadingState(submitButton, false);
  }
}

async function deleteSettingsProfile(profileId) {
  if (!confirm('Deseja excluir este perfil?')) return;
  try {
    await fetchJson(`/rules/${profileId}`, { method: 'DELETE' });
    showAlert('success', 'Perfil excluído com sucesso.');
    await loadSettingsProfiles();
  } catch (error) {
    showAlert('danger', `Erro ao excluir perfil: ${error.message}`);
  }
}

async function loadStockItems() {
  const stockItemSelect = $id('stockItemSelect');
  if (!stockItemSelect) return;

  stockItemSelect.innerHTML = '<option value="">Carregando...</option>';
  try {
    const stockItems = await fetchJson('/stock');
    stockItemSelect.innerHTML = '<option value="">Selecione um item</option>';

    if (Array.isArray(stockItems) && stockItems.length > 0) {
      stockItems.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.product_name || `Produto #${item.product_id}`} — ${item.quantity ?? 0} unidades`;
        stockItemSelect.append(option);
      });
    } else {
      stockItemSelect.innerHTML = '<option value="">Nenhum item de estoque disponível</option>';
    }
  } catch (error) {
    stockItemSelect.innerHTML = '<option value="">Erro ao carregar estoque</option>';
    showAlert('danger', `Erro ao carregar itens de estoque: ${error.message}`);
  }
}

async function loadCategoryOptions(selectedId = null, currentCategoryId = null) {
  const categoryParent = $id('categoryParent');
  if (!categoryParent) return;

  categoryParent.innerHTML = '<option value="">Nenhuma (Categoria Principal)</option>';
  try {
    const categories = await fetchJson('/categories');
    if (!Array.isArray(categories)) return;

    // Only show top-level categories (no parent) as possible parents
    const parentCategories = categories.filter((c) => c.parent_id === null || c.parent_id === undefined || c.parent_id === 0 || c.parent_id === '');
    parentCategories.forEach((category) => {
      // avoid allowing a category to be parent of itself
      if (currentCategoryId && category.id === currentCategoryId) {
        return;
      }
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      if (selectedId && category.id === selectedId) {
        option.selected = true;
      }
      categoryParent.append(option);
    });
  } catch (error) {
    showAlert('danger', `Erro ao carregar categorias para seleção: ${error.message}`);
  }
}

async function loadProductCategoryOptions(selectedIds = []) {
  const productCategoriesSelect = $id('productCategories');
  if (!productCategoriesSelect) return;

  try {
    const categories = await fetchJson('/categories');
    if (!Array.isArray(categories)) {
      productCategoriesSelect.innerHTML = '<option disabled>Falha ao carregar categorias</option>';
      return;
    }

    const sortedCategories = categories.slice().sort((a, b) => {
      const nameA = ((a.parent_name || '') + a.name).toLowerCase();
      const nameB = ((b.parent_name || '') + b.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    productCategoriesSelect.innerHTML = '';
    sortedCategories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.parent_name ? `${category.parent_name} / ${category.name}` : category.name;
      if (selectedIds.includes(Number(category.id))) {
        option.selected = true;
      }
      productCategoriesSelect.append(option);
    });
  } catch (error) {
    productCategoriesSelect.innerHTML = '<option disabled>Erro ao carregar categorias</option>';
    console.error('Erro ao carregar opções de categorias:', error);
  }
}

function openModal(modalId) {
  const element = $id(modalId);
  if (!element) return null;
  const modal = new bootstrap.Modal(element);
  modal.show();
  return modal;
}

async function openCategoryModal(mode, categoryId = null) {
  const modalTitle = $id('categoryModalLabel');
  const categoryIdField = $id('categoryId');
  const nameField = $id('categoryName');
  const descField = $id('categoryDescription');

  if (!modalTitle || !categoryIdField || !nameField || !descField) return;

  if (mode === 'edit' && categoryId !== null) {
    const categories = await fetchJson('/categories');
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      showAlert('danger', 'Categoria não encontrada.');
      return;
    }
    modalTitle.textContent = 'Editar Categoria';
    categoryIdField.value = category.id;
    nameField.value = category.name || '';
    descField.value = category.description || '';
    await loadCategoryOptions(category.parent_id, categoryId);
  } else {
    modalTitle.textContent = 'Nova Categoria';
    categoryIdField.value = '';
    nameField.value = '';
    descField.value = '';
    await loadCategoryOptions(null, null);
  }

  openModal('categoryModal');
}

async function saveCategory(event) {
  if (!$id('categoryForm')) return;
  event.preventDefault();
  const categoryId = $id('categoryId').value;
  const name = $id('categoryName').value.trim();
  const description = $id('categoryDescription').value.trim();
  const parentId = $id('categoryParent').value || null;
  const submitButton = event.submitter || document.querySelector('#categoryForm button[type="submit"]');

  if (!name) {
    showAlert('warning', 'O nome da categoria é obrigatório.');
    return;
  }

  setLoadingState(submitButton, true);

  try {
    const payload = { name, description, parent_id: parentId };
    if (categoryId) {
      await fetchJson(`/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Categoria atualizada com sucesso.');
    } else {
      await fetchJson('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Categoria criada com sucesso.');
    }
    bootstrap.Modal.getInstance($id('categoryModal'))?.hide();
    await loadCategories();
  } catch (error) {
    showAlert('danger', `Erro ao salvar categoria: ${error.message}`);
  } finally {
    setLoadingState(submitButton, false);
  }
}

function deleteCategory(categoryId, categoryName = null) {
  openDeleteConfirm('category', categoryId, categoryName);
}

async function performDeleteCategory(categoryId) {
  try {
    await fetchJson(`/categories/${categoryId}`, { method: 'DELETE' });
    showAlert('success', 'Categoria excluída com sucesso.');
    await loadCategories();
  } catch (error) {
    showAlert('danger', `Erro ao excluir categoria: ${error.message}`);
  }
}

function deleteProduct(productId, productName = null) {
  openDeleteConfirm('product', productId, productName);
}

async function openProductModal(mode, productId = null) {
  const modalTitle = $id('productModalLabel');
  const idField = $id('productId');
  const nameField = $id('productName');
  const barcodeField = $id('productBarcode');
  const minStockField = $id('productMinStock');
  const maxStockField = $id('productMaxStock');
  const descField = $id('productDescription');
  const priceField = $id('productPrice');
  const photoField = $id('productPhoto');
  const photoPreview = $id('productPhotoPreview');
  const stockField = $id('productStock');

  if (!modalTitle || !idField || !nameField || !barcodeField || !minStockField || !maxStockField || !descField || !priceField || !photoField || !stockField) return;

  productPhotoURL = '';
  photoPreview.innerHTML = '';

  const categorySelect = $id('productCategories');

  if (mode === 'edit' && productId !== null) {
    const products = await fetchJson('/products');
    const product = products.find((item) => item.id === productId);
    if (!product) {
      showAlert('danger', 'Produto não encontrado.');
      return;
    }
    modalTitle.textContent = 'Editar Produto';
    idField.value = product.id;
    nameField.value = product.name || '';
    barcodeField.value = product.barcode || '';
    minStockField.value = product.min_stock ?? 0;
    maxStockField.value = product.max_stock ?? '';
    descField.value = product.description || '';
    priceField.value = product.price ?? 0;
    photoField.value = '';
    stockField.value = product.stock ?? 0;
    // esconder campo de estoque no modo de edição (estoque inicial só ao criar)
    if (stockField && stockField.parentElement) stockField.parentElement.style.display = 'none';
    productPhotoURL = product.photo_path || '';
    if (product.photo_path) {
      photoPreview.innerHTML = `<img src="${product.photo_path}" alt="Prévia" style="height: 80px; width: auto; border-radius: 4px;">`;
    }
    await loadProductCategoryOptions(Array.isArray(product.category_ids) ? product.category_ids : (Array.isArray(product.categories) ? product.categories.map((cat) => cat.id) : []));
  } else {
    modalTitle.textContent = 'Novo Produto';
    idField.value = '';
    nameField.value = '';
    barcodeField.value = '';
    minStockField.value = 0;
    maxStockField.value = '';
    descField.value = '';
    priceField.value = 0;
    photoField.value = '';
    stockField.value = 0;
    // mostrar campo de estoque no modo de criação
    if (stockField && stockField.parentElement) stockField.parentElement.style.display = '';
    if (categorySelect) {
      categorySelect.innerHTML = '';
    }
    await loadProductCategoryOptions();
  }

  openModal('productModal');
}

// Adicionar handler de upload de imagem
document.addEventListener('change', async (e) => {
  if (e.target.id === 'productPhoto' && e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    const preview = $id('productPhotoPreview');
    
    // Mostrar preview local
    const reader = new FileReader();
    reader.onload = (event) => {
      preview.innerHTML = `<img src="${event.target.result}" alt="Prévia" style="height: 80px; width: auto; border-radius: 4px;">`;
    };
    reader.readAsDataURL(file);
    
    // Fazer upload
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { ...buildAuthHeader() },
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload falhou');
      const data = await response.json();
      productPhotoURL = data.url;
    } catch (error) {
      showAlert('danger', `Erro ao fazer upload: ${error.message}`);
    }
  }
});

async function saveProduct(event) {
  if (!$id('productForm')) return;
  event.preventDefault();
  const productId = $id('productId').value;
  const name = $id('productName').value.trim();
  const barcode = $id('productBarcode').value.trim();
  const minStock = Number($id('productMinStock').value || 0);
  const maxStock = $id('productMaxStock').value;
  const description = $id('productDescription').value.trim();
  const price = Number($id('productPrice').value || 0);
  const submitButton = event.submitter || document.querySelector('#productForm button[type="submit"]');

  if (!name) {
    showAlert('warning', 'O nome do produto é obrigatório.');
    return;
  }

  setLoadingState(submitButton, true);

  try {
    const categorySelect = $id('productCategories');
    const categoryIds = categorySelect
      ? Array.from(categorySelect.selectedOptions).map((option) => Number(option.value))
      : [];
    const payload = {
      name,
      barcode: barcode || null,
      min_stock: Number.isFinite(minStock) ? minStock : null,
      max_stock: maxStock !== '' ? Number(maxStock) : null,
      description,
      price,
      photo_path: productPhotoURL,
      category_ids: categoryIds,
    };
    let createdProductId = null;

    if (productId) {
      await fetchJson(`/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert('success', 'Produto atualizado com sucesso.');
    } else {
      const stockValue = Number($id('productStock').value || 0);
      if (payload.max_stock !== null && stockValue > payload.max_stock) {
        showAlert('warning', 'Estoque inicial não pode ser maior que o estoque máximo.');
        setLoadingState(submitButton, false);
        return;
      }
      const createResponse = await fetchJson('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      createdProductId = createResponse?.id;
      showAlert('success', 'Produto criado com sucesso.');

      if (createdProductId) {
        await fetchJson('/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: createdProductId, quantity: 0 }),
        });

        if (stockValue > 0) {
          const stockResp = await fetchJson('/stock');
          const stockId = stockResp?.find((s) => s.product_id === createdProductId)?.id;
          if (stockId) {
            await fetchJson('/stock/moves', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock_id: stockId, quantity_change: stockValue, reason: 'Estoque inicial' }),
            });
          }
        }
      }
    }
    bootstrap.Modal.getInstance($id('productModal'))?.hide();
    await loadProducts();
  } catch (error) {
    showAlert('danger', `Erro ao salvar produto: ${error.message}`);
  } finally {
    setLoadingState(submitButton, false);
  }
}

async function performDeleteProduct(productId) {
  try {
    await fetchJson(`/products/${productId}`, { method: 'DELETE' });
    showAlert('success', 'Produto excluído com sucesso.');
    await loadProducts();
  } catch (error) {
    showAlert('danger', `Erro ao excluir produto: ${error.message}`);
  }
}

function deleteAllProducts() {
  openDeleteConfirm('all-products', null, null);
}

async function performDeleteAllProducts() {
  try {
    const result = await fetchJson('/products/delete-all', { method: 'DELETE' });
    showAlert('success', result?.message || 'Todos os produtos foram excluídos.');
    await loadProducts();
  } catch (error) {
    showAlert('danger', `Erro ao excluir todos os produtos: ${error.message}`);
  }
}

function revertStockMove(moveId) {
  openDeleteConfirm('stock-move', moveId, null);
}

async function performRevertStockMove(moveId) {
  try {
    await fetchJson(`/stock/moves/${moveId}/revert`, { method: 'POST' });
    showAlert('success', 'Movimentação revertida e estoque devolvido com sucesso.');
    await loadStockMoves();
  } catch (error) {
    showAlert('danger', `Erro ao reverter movimentação: ${error.message}`);
  }
}

const DELETE_CONFIRM_CONFIGS = {
  'all-products': {
    message: 'Tem certeza que deseja excluir TODOS os produtos? Eles deixarão de aparecer no sistema, mas o histórico de estoque e os pedidos serão preservados.',
    buttonText: 'Excluir todos',
    buttonClass: 'btn btn-danger',
  },
  'stock-move': {
    message: 'Tem certeza que deseja voltar esta movimentação ao estoque? Uma movimentação de estorno será criada com a quantidade inversa.',
    buttonText: 'Voltar ao estoque',
    buttonClass: 'btn btn-warning text-dark',
  },
};

function openDeleteConfirm(type, id, name = null) {
  const modal = $id('deleteConfirmModal');
  const message = $id('deleteConfirmMessage');
  const confirmButton = $id('deleteConfirmButton');
  if (!modal || !message || !confirmButton) return;

  const label = type === 'category' ? 'categoria' : 'produto';
  const config = DELETE_CONFIRM_CONFIGS[type] || {
    message: name
      ? `Tem certeza que deseja excluir a ${label} "${name}"?`
      : `Tem certeza que deseja excluir este ${label}?`,
    buttonText: `Excluir ${label}`,
    buttonClass: 'btn btn-danger',
  };

  message.textContent = config.message;
  confirmButton.textContent = config.buttonText;
  confirmButton.className = config.buttonClass;

  pendingDelete = { type, id };
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  pendingDelete = null;
  const modal = $id('deleteConfirmModal');
  bootstrap.Modal.getInstance(modal)?.hide();

  if (type === 'category') {
    await performDeleteCategory(id);
  } else if (type === 'all-products') {
    await performDeleteAllProducts();
  } else if (type === 'stock-move') {
    await performRevertStockMove(id);
  } else {
    await performDeleteProduct(id);
  }
}

function guessColumnForField(fieldKey, headers) {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const patterns = {
    name: ['nome', 'nome do produto', 'produto', 'name'],
    barcode: ['codigo de barras', 'código de barras', 'barcode', 'codigo', 'código', 'ean'],
    price: ['preco', 'preço', 'price', 'valor'],
    description: ['descricao', 'descrição', 'description'],
    min_stock: ['estoque minimo', 'estoque mínimo', 'min_stock', 'minimo', 'mínimo'],
    max_stock: ['estoque maximo', 'estoque máximo', 'max_stock', 'maximo', 'máximo'],
    stock_quantity: ['quantidade em estoque', 'quantidade', 'estoque', 'stock', 'qtd'],
    category: ['categoria', 'category'],
  };
  const candidates = patterns[fieldKey] || [];
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate);
    if (idx !== -1) return headers[idx];
  }
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return '';
}

function goToImportStep(step) {
  ['importStep1', 'importStep2', 'importStep3'].forEach((id, idx) => {
    $id(id)?.classList.toggle('d-none', idx + 1 !== step);
  });
  [1, 2, 3].forEach((s) => {
    const indicator = document.querySelector(`[data-step-indicator="${s}"]`);
    if (!indicator) return;
    indicator.className = `badge rounded-pill ${s === step ? 'bg-primary' : s < step ? 'bg-success' : 'bg-secondary'}`;
  });
  $id('importBackButton')?.classList.toggle('d-none', step !== 2);
  $id('importNextButton')?.classList.toggle('d-none', step !== 1);
  $id('importCommitButton')?.classList.toggle('d-none', step !== 2);
  $id('importFinishButton')?.classList.toggle('d-none', step !== 3);
  $id('importCancelButton')?.classList.toggle('d-none', step === 3);
}

function renderImportMappingTable() {
  const tbody = $id('importMappingTableBody');
  if (!tbody) return;

  tbody.innerHTML = IMPORT_FIELD_DEFS.map((field) => {
    const guessed = importState.mapping[field.key] || guessColumnForField(field.key, importState.headers);
    importState.mapping[field.key] = guessed;
    const options = ['<option value="">— não importar —</option>']
      .concat(importState.headers.map((h) => `<option value="${escapeHtml(h)}" ${h === guessed ? 'selected' : ''}>${escapeHtml(h)}</option>`))
      .join('');
    return `
      <tr>
        <td>${escapeHtml(field.label)}${field.required ? ' <span class="text-danger">*</span>' : ''}</td>
        <td>
          <select class="form-select form-select-sm" data-import-field="${field.key}" ${field.required ? 'required' : ''}>
            ${options}
          </select>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-import-field]').forEach((select) => {
    select.addEventListener('change', (event) => {
      importState.mapping[event.target.dataset.importField] = event.target.value;
    });
  });
}

function renderImportSample() {
  const head = $id('importSampleHead');
  const body = $id('importSampleBody');
  if (!head || !body) return;

  head.innerHTML = `<tr>${importState.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  body.innerHTML = importState.sampleRows.length
    ? importState.sampleRows.map((row) => `
        <tr>${importState.headers.map((h) => `<td>${escapeHtml(row[h] ?? '')}</td>`).join('')}</tr>
      `).join('')
    : `<tr><td class="text-muted">Sem linhas de exemplo</td></tr>`;
}

function resetImportWizard() {
  importState = { importId: null, headers: [], sampleRows: [], mapping: {}, previewResult: null, completed: false };
  goToImportStep(1);
}

async function handleImportFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.csv')) {
    showAlert('warning', 'Selecione um arquivo no formato .csv.');
    return;
  }

  const importButton = $id('importProductsButton');
  setLoadingState(importButton, true);

  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/products/import/upload`, {
      method: 'POST',
      headers: { ...buildAuthHeader() },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Falha ao enviar arquivo CSV.');
    }
    const data = await response.json();

    importState = {
      importId: data.import_id,
      headers: data.headers || [],
      sampleRows: data.sample_rows || [],
      mapping: {},
      previewResult: null,
      completed: false,
    };

    const importFileName = $id('importFileName');
    const importRowCount = $id('importRowCount');
    if (importFileName) importFileName.textContent = file.name;
    if (importRowCount) importRowCount.textContent = data.row_count ?? 0;

    renderImportMappingTable();
    renderImportSample();
    goToImportStep(1);
    openModal('importWizardModal');
  } catch (error) {
    showAlert('danger', `Erro ao enviar CSV: ${error.message}`);
  } finally {
    setLoadingState(importButton, false);
  }
}

function importActionBadge(action) {
  if (action === 'create') return '<span class="badge bg-success">Novo</span>';
  if (action === 'update') return '<span class="badge bg-info text-dark">Atualizar</span>';
  return '<span class="badge bg-danger">Inválido</span>';
}

function renderImportPreview() {
  const summaryContainer = $id('importSummaryCards');
  const tbody = $id('importPreviewTableBody');
  if (!summaryContainer || !tbody || !importState.previewResult) return;

  const { summary, rows } = importState.previewResult;
  summaryContainer.innerHTML = `
    <div class="col-6 col-md-3"><div class="border rounded p-2 text-center"><div class="fs-4 fw-semibold">${summary.total}</div><div class="text-muted small">Linhas no arquivo</div></div></div>
    <div class="col-6 col-md-3"><div class="border rounded p-2 text-center"><div class="fs-4 fw-semibold text-success">${summary.to_create}</div><div class="text-muted small">Novos produtos</div></div></div>
    <div class="col-6 col-md-3"><div class="border rounded p-2 text-center"><div class="fs-4 fw-semibold text-info">${summary.to_update}</div><div class="text-muted small">Serão atualizados</div></div></div>
    <div class="col-6 col-md-3"><div class="border rounded p-2 text-center"><div class="fs-4 fw-semibold text-danger">${summary.invalid}</div><div class="text-muted small">Inválidos (ignorados)</div></div></div>
  `;

  tbody.innerHTML = rows.map((row) => {
    let details;
    if (row.action === 'invalid') {
      details = `<span class="text-danger">${row.errors.map(escapeHtml).join('; ')}</span>`;
    } else if (row.action === 'update' && row.current) {
      const diffs = [];
      if (Number(row.current.price ?? 0) !== Number(row.data.price ?? 0)) {
        diffs.push(`Preço: R$ ${Number(row.current.price ?? 0).toFixed(2)} &rarr; R$ ${Number(row.data.price ?? 0).toFixed(2)}`);
      }
      if (row.data.stock_quantity !== null && row.data.stock_quantity !== undefined && row.current.stock_quantity !== row.data.stock_quantity) {
        diffs.push(`Estoque: ${row.current.stock_quantity ?? 0} &rarr; ${row.data.stock_quantity}`);
      }
      details = diffs.length ? diffs.join('<br>') : '<span class="text-muted">Sem alterações relevantes</span>';
    } else {
      details = '<span class="text-muted">—</span>';
    }
    return `
      <tr>
        <td>${row.row}</td>
        <td>${importActionBadge(row.action)}</td>
        <td>${escapeHtml(row.data.name || '—')}</td>
        <td>${escapeHtml(row.data.barcode || '—')}</td>
        <td>${row.data.price !== null && row.data.price !== undefined ? `R$ ${Number(row.data.price).toFixed(2)}` : '—'}</td>
        <td>${row.data.stock_quantity ?? '—'}</td>
        <td>${details}</td>
      </tr>
    `;
  }).join('');
}

async function loadImportPreview() {
  const requiredMissing = IMPORT_FIELD_DEFS.filter((field) => field.required && !importState.mapping[field.key]);
  if (requiredMissing.length) {
    showAlert('warning', `Mapeie as colunas obrigatórias: ${requiredMissing.map((field) => field.label).join(', ')}.`);
    return;
  }

  const nextButton = $id('importNextButton');
  setLoadingState(nextButton, true);

  try {
    const result = await fetchJson('/products/import/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ import_id: importState.importId, mapping: importState.mapping }),
    });
    importState.previewResult = result;
    renderImportPreview();
    goToImportStep(2);
  } catch (error) {
    showAlert('danger', `Erro ao gerar prévia da importação: ${error.message}`);
  } finally {
    setLoadingState(nextButton, false);
  }
}

async function commitImport() {
  const commitButton = $id('importCommitButton');
  setLoadingState(commitButton, true);

  try {
    const result = await fetchJson('/products/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ import_id: importState.importId, mapping: importState.mapping }),
    });

    const resultMessage = $id('importResultMessage');
    if (resultMessage) {
      resultMessage.innerHTML = `
        <strong>${result.created}</strong> produto(s) criado(s) e <strong>${result.updated}</strong> atualizado(s).
        ${result.skipped ? `<br><span class="text-warning">${result.skipped} linha(s) ignorada(s) por erro de validação.</span>` : ''}
      `;
    }
    importState.completed = true;
    goToImportStep(3);
    showAlert('success', 'Importação de produtos concluída com sucesso.');
    await loadProducts();
  } catch (error) {
    showAlert('danger', `Erro ao concluir importação: ${error.message}`);
  } finally {
    setLoadingState(commitButton, false);
  }
}

async function openStockMoveModal() {
  if (!$id('stockMoveForm')) return;
  $id('stockMoveForm')?.reset();
  await loadStockItems();
  openModal('stockMoveModal');
}

async function saveStockMove(event) {
  if (!$id('stockMoveForm')) return;
  event.preventDefault();
  const stockId = $id('stockItemSelect').value;
  const moveType = $id('stockMoveType').value;
  const quantity = Number($id('stockQuantityChange').value || 0);
  const reason = $id('stockReason').value.trim();
  const submitButton = event.submitter || document.querySelector('#stockMoveForm button[type="submit"]');

  if (!stockId || !moveType || quantity === 0) {
    showAlert('warning', 'Preencha todos os campos da movimentação.');
    return;
  }

  const quantity_change = moveType === 'entrada' ? quantity : -quantity;

  setLoadingState(submitButton, true);

  try {
    await fetchJson('/stock/moves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_id: stockId, quantity_change, reason }),
    });
    showAlert('success', 'Movimentação de estoque registrada com sucesso.');
    bootstrap.Modal.getInstance($id('stockMoveModal'))?.hide();
    if (stockMovesTableBody) {
      await loadStockMoves();
    } else {
      await loadProducts();
    }
  } catch (error) {
    showAlert('danger', `Erro ao salvar movimentação: ${error.message}`);
  } finally {
    setLoadingState(submitButton, false);
  }
}

function openClientDeactivateModal(clientId, clientName, clientActive) {
  const clientNameElement = $id('clientDeactivateName');
  const confirmButton = $id('confirmDeactivateClientButton');
  const clientMessage = $id('clientDeactivateMessage');

  if (!clientNameElement || !confirmButton || !clientMessage) return;

  const newStatusText = clientActive ? 'inativar' : 'reativar';
  const badgeText = clientActive ? 'inativo' : 'ativo';

  clientNameElement.textContent = clientName;
  clientMessage.innerHTML = `Deseja ${newStatusText} o cliente <strong>${clientName}</strong>?`;
  const nextActiveState = !clientActive;
  confirmButton.textContent = clientActive ? 'Confirmar inativação' : 'Confirmar reativação';
  confirmButton.className = clientActive ? 'btn btn-danger' : 'btn btn-success';
  confirmButton.dataset.clientId = clientId;
  confirmButton.dataset.nextActive = nextActiveState ? 'true' : 'false';
  confirmButton.onclick = confirmDeactivateClient;

  openModal('clientDeactivateModal');
}

async function confirmDeactivateClient() {
  const modal = $id('clientDeactivateModal');
  const confirmButton = $id('confirmDeactivateClientButton');
  if (!modal || !confirmButton) return;

  const clientId = Number(confirmButton.dataset.clientId);
  const nextActiveStr = confirmButton.dataset.nextActive;
  const newActiveState = nextActiveStr === 'true';

  console.log('Updating client:', { clientId, nextActiveStr, newActiveState });

  bootstrap.Modal.getInstance(modal)?.hide();

  try {
    const response = await fetchJson(`/clients/${clientId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActiveState }),
    });

    console.log('API Response:', response);

    showAlert('success', `Cliente ${newActiveState ? 'reativado' : 'inativado'} com sucesso.`);
    await loadClients();
  } catch (error) {
    console.error('Client status update error:', error);
    showAlert('danger', `Erro ao atualizar cliente: ${error.message}`);
  }
}

function handleClientTableClick(event) {
  const button = event.target.closest('.btn-detail-client');
  if (!button) return;
  const clientId = button.dataset.clientId;
  if (!clientId) return;
  openClientDetailModal(Number(clientId));
}

function updateOrderStatus(orderId, payload) {
  return fetchJson(`/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function confirmPartialWithdrawal(orderId, shortages) {
  const lines = shortages.map(
    (item) => `• ${item.product_name}: solicitado ${item.requested}, disponível ${item.available}`
  );
  return window.confirm(
    `Estoque insuficiente para o pedido #${orderId}:\n\n${lines.join('\n')}\n\n` +
    'Deseja concluir a retirada entregando apenas a quantidade disponível?'
  );
}

window.handleAdminOrderAction = async function (orderId, action, button) {
  setLoadingState(button, true);
  try {
    try {
      await updateOrderStatus(orderId, { action });
    } catch (error) {
      const shortages = error.data?.code === 'insufficient_stock' ? error.data.shortages : null;
      if (!shortages?.length) throw error;
      if (!confirmPartialWithdrawal(orderId, shortages)) {
        showAlert('warning', `Retirada do pedido ${orderId} não concluída por falta de estoque.`);
        return;
      }
      await updateOrderStatus(orderId, { action, allow_partial: true });
    }
    showAlert('success', 'Status da solicitação atualizado.');
    await loadOrders();
    await loadDashboardSummary();
  } catch (error) {
    showAlert('danger', `Falha ao atualizar pedido ${orderId}: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
};

window.openCategoryModal = openCategoryModal;
window.openProductModal = openProductModal;
window.deleteCategory = deleteCategory;
window.deleteProduct = deleteProduct;
window.revertStockMove = revertStockMove;
window.openClientDeactivateModal = openClientDeactivateModal;
window.openClientDetailModal = openClientDetailModal;
window.openOrderDetailModal = openOrderDetailModal;

window.addEventListener('DOMContentLoaded', async () => {
  setupModuleSearch();
  const importProductsFileInput = $id('importProductsFileInput');
  const stockStartDate = $id('stockStartDate');
  const stockEndDate = $id('stockEndDate');

  $id('refreshOrdersButton')?.addEventListener('click', function () { loadOrders(this); });
  $id('refreshCategoriesButton')?.addEventListener('click', function () { loadCategories(this); });
  $id('refreshProductsButton')?.addEventListener('click', function () { loadProducts(this); });
  $id('deleteAllProductsButton')?.addEventListener('click', deleteAllProducts);
  $id('refreshClientsButton')?.addEventListener('click', function () { loadClients(this); });
  clientsTableBody?.addEventListener('click', handleClientTableClick);
  $id('newCategoryButton')?.addEventListener('click', () => openCategoryModal('new'));
  $id('newProductButton')?.addEventListener('click', () => openProductModal('new'));
  $id('importProductsButton')?.addEventListener('click', () => importProductsFileInput?.click());
  importProductsFileInput?.addEventListener('change', handleImportFileSelected);
  $id('importNextButton')?.addEventListener('click', loadImportPreview);
  $id('importBackButton')?.addEventListener('click', () => goToImportStep(1));
  $id('importCommitButton')?.addEventListener('click', commitImport);
  $id('importWizardModal')?.addEventListener('hidden.bs.modal', () => {
    if (importState.importId && !importState.completed) {
      fetch(`${API_BASE_URL}/products/import/${importState.importId}`, {
        method: 'DELETE',
        headers: { ...buildAuthHeader() },
      }).catch(() => {});
    }
    resetImportWizard();
  });
  $id('exportProductsButton')?.addEventListener('click', openExportModal);
  $id('exportConfirmButton')?.addEventListener('click', exportProductsToCsv);
  $id('exportSelectAllColumns')?.addEventListener('click', () => {
    document.querySelectorAll('#exportColumnsList input[type="checkbox"]').forEach((input) => { input.checked = true; });
  });
  $id('exportClearAllColumns')?.addEventListener('click', () => {
    document.querySelectorAll('#exportColumnsList input[type="checkbox"]').forEach((input) => { input.checked = false; });
  });
  $id('newStockMoveButton')?.addEventListener('click', openStockMoveModal);
  $id('viewStockMovesButton')?.addEventListener('click', () => { window.location.href = '/admin/products/stock-moves'; });
  $id('refreshStockMovesButton')?.addEventListener('click', function () { loadStockMoves(this); });
  $id('backToProductsButton')?.addEventListener('click', () => { window.location.href = '/admin/products'; });
  $id('filterStockMovesButton')?.addEventListener('click', function () { loadStockMoves(this); });
  $id('quick7DaysButton')?.addEventListener('click', () => setStockFilterRange(7, true));
  $id('quick90DaysButton')?.addEventListener('click', () => setStockFilterRange(90, true));
  $id('orderActionConfirmButton')?.addEventListener('click', confirmOrderAction);
  $id('deleteConfirmButton')?.addEventListener('click', confirmDelete);
  $id('categoryForm')?.addEventListener('submit', saveCategory);
  $id('productForm')?.addEventListener('submit', saveProduct);
  $id('stockMoveForm')?.addEventListener('submit', saveStockMove);

  $id('refreshSettingsUsersButton')?.addEventListener('click', function () { loadSettingsUsers(this); });
  $id('newSettingsUserButton')?.addEventListener('click', () => openSettingsUserModal('new'));
  $id('refreshSettingsPermissionsButton')?.addEventListener('click', function () { loadSettingsPermissions(this); });
  $id('newSettingsPermissionButton')?.addEventListener('click', () => openSettingsPermissionModal('new'));
  $id('refreshSettingsProfilesButton')?.addEventListener('click', function () { loadSettingsProfiles(this); });
  $id('newSettingsProfileButton')?.addEventListener('click', () => openSettingsProfileModal('new'));
  settingsUserForm?.addEventListener('submit', saveSettingsUser);
  settingsPermissionForm?.addEventListener('submit', saveSettingsPermission);
  settingsProfileForm?.addEventListener('submit', saveSettingsProfile);

  await loadAdminProfile();

  if (summaryOrders || summaryCategories || summaryProducts || summaryClients || summaryPendingOrders || summaryStock) {
    loadDashboardSummary();
  }

  if (ordersTableBody) loadOrders();
  if (categoriesTableBody) loadCategories();
  if (productsTableBody) loadProducts();
  if (stockMovesTableBody) {
    // default filter: últimos 30 dias
    try {
      const today = new Date();
      const end = today.toISOString().slice(0, 10);
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 30);
      const start = startDateObj.toISOString().slice(0, 10);
      if (stockStartDate) stockStartDate.value = start;
      if (stockEndDate) stockEndDate.value = end;
    } catch (e) {
      // ignore date calc errors
    }
    loadStockMoves();
  }
  if (clientsTableBody) loadClients();
  if (settingsUsersTableBody) loadSettingsUsers();
  if (settingsPermissionsTableBody) loadSettingsPermissions();
  if (settingsProfilesTableBody) loadSettingsProfiles();
});
