const API_BASE_URL = '/api/admin';
let productPhotoURL = ''; // Armazenar URL da imagem carregada
const alertContainer = document.getElementById('alertContainer');
const ordersTableBody = document.getElementById('ordersTableBody');
const categoriesTableBody = document.getElementById('categoriesTableBody');
const productsTableBody = document.getElementById('productsTableBody');
const stockMovesTableBody = document.getElementById('stockMovesTableBody');
const clientsTableBody = document.getElementById('clientsTableBody');
const logoutButton = document.getElementById('logoutButton');
const summaryOrders = document.getElementById('summaryOrders');
const summaryCategories = document.getElementById('summaryCategories');
const summaryProducts = document.getElementById('summaryProducts');
const summaryClients = document.getElementById('summaryClients');
const summaryPendingOrders = document.getElementById('summaryPendingOrders');
const summaryStock = document.getElementById('summaryStock');
const summaryLowStock = document.getElementById('summaryLowStock');
const clientsOrdersCount = document.getElementById('clientsOrdersCount');
const clientsOrdersQuantity = document.getElementById('clientsOrdersQuantity');
const clientsOrdersProducts = document.getElementById('clientsOrdersProducts');
const clientDetailName = document.getElementById('clientDetailName');
const clientDetailEmail = document.getElementById('clientDetailEmail');
const clientDetailPhone = document.getElementById('clientDetailPhone');
const clientDetailOrdersList = document.getElementById('clientDetailOrdersList');

const settingsUsersTableBody = document.getElementById('settingsUsersTableBody');
const settingsPermissionsTableBody = document.getElementById('settingsPermissionsTableBody');
const settingsProfilesTableBody = document.getElementById('settingsProfilesTableBody');
const settingsUserForm = document.getElementById('settingsUserForm');
const settingsPermissionForm = document.getElementById('settingsPermissionForm');
const settingsProfileForm = document.getElementById('settingsProfileForm');
const settingsUserRulesSelect = document.getElementById('settingsUserRulesSelect');
const settingsProfilePermissionsSelect = document.getElementById('settingsProfilePermissionsSelect');
const newSettingsUserButton = document.getElementById('newSettingsUserButton');
const refreshSettingsUsersButton = document.getElementById('refreshSettingsUsersButton');
const newSettingsPermissionButton = document.getElementById('newSettingsPermissionButton');
const refreshSettingsPermissionsButton = document.getElementById('refreshSettingsPermissionsButton');
const newSettingsProfileButton = document.getElementById('newSettingsProfileButton');
const refreshSettingsProfilesButton = document.getElementById('refreshSettingsProfilesButton');

let settingsUsersCache = [];
let settingsPermissionsCache = [];
let settingsProfilesCache = [];
let pendingOrderAction = null;
let adminPermissions = [];

logoutButton?.addEventListener('click', handleLogout);

function getAuthToken() {
  return localStorage.getItem('admin_token');
}

function setStockFilterRange(days, shouldLoad = false) {
  const stockStartDate = document.getElementById('stockStartDate');
  const stockEndDate = document.getElementById('stockEndDate');
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
  const tableBody = document.getElementById('stockMovesTableBody');
  if (!tableBody) return;
  renderTablePlaceholder(tableBody, 4, 'Carregando movimentações...');
  setLoadingState(button, true);

  try {
    const params = [];
    const start = document.getElementById('stockStartDate')?.value;
    const end = document.getElementById('stockEndDate')?.value;
    if (start) params.push(`start_date=${encodeURIComponent(start)}`);
    if (end) params.push(`end_date=${encodeURIComponent(end)}`);
    const url = `/stock/moves${params.length ? '?' + params.join('&') : ''}`;
    const stockMoves = await fetchJson(url);
    if (Array.isArray(stockMoves) && stockMoves.length > 0) {
      tableBody.innerHTML = stockMoves
        .map((move) => `
          <tr>
            <td>${move.product_name || move.product_id || move.stock_id || '—'}</td>
            <td>${move.quantity_change || '—'}</td>
            <td>${move.reason || '—'}</td>
            <td>${formatDate(move.created_at)}</td>
          </tr>
        `)
        .join('');
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-5 text-muted">Nenhuma movimentação de estoque encontrada.</td>
        </tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-5 text-danger">Falha ao carregar movimentações: ${error.message}</td>
      </tr>
    `;
    showAlert('danger', `Erro ao carregar movimentações: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
}

function buildAuthHeader() {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  if (!alertContainer) return;

  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.setAttribute('role', 'alert');
  alertElement.innerHTML = `
    <div>${message}</div>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  alertContainer.appendChild(alertElement);

  setTimeout(() => {
    if (alertElement.parentNode) {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
      bsAlert.close();
    }
  }, 7000);
}

function setLoadingState(button, loading) {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Carregando...
    `;
  } else {
    button.disabled = false;
    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
  }
}

function renderTablePlaceholder(container, colspan, message = 'Carregando dados...') {
  if (!container) return;
  container.innerHTML = `
    <tr>
      <td colspan="${colspan}" class="text-center py-5 text-muted">${message}</td>
    </tr>
  `;
}

function formatDate(dateString) {
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

function createStatusBadge(status) {
  const normalized = (status || '').toString().toLowerCase();
  if (['approved', 'aprovado'].includes(normalized)) {
    return '<span class="badge bg-info text-dark status-badge">Aprovado (aguardando retirada)</span>';
  }
  if (['rejected', 'rejeitado', 'rejeitada'].includes(normalized)) {
    return '<span class="badge bg-danger status-badge">Rejeitado</span>';
  }
  if (['finished', 'completed', 'concluido', 'concluído', 'retirado'].includes(normalized)) {
    return '<span class="badge bg-primary status-badge">Retirado</span>';
  }
  if (['pending', 'initial', 'inicial', 'pendent', 'pendente'].includes(normalized)) {
    return '<span class="badge bg-warning text-dark status-badge">Pendente (aguardando aprovação)</span>';
  }
  if (['cancelled', 'cancelado', 'canceled'].includes(normalized)) {
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
    throw new Error(errorData?.error || `Erro ${response.status} ao acessar ${path}`);
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
        ? orders.filter((order) => ['pending', 'initial', 'inicial', 'pendent', 'pendente'].includes((order.status || '').toString().toLowerCase())).length
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
        if (['pending', 'initial', 'inicial', 'pendent', 'pendente'].includes(normalizedStatus)) {
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
        if (['approved', 'aprovado'].includes(normalizedStatus)) {
          if (hasAdminPermission('admin.orders.approve')) {
            actionButtons.push(`<button type="button" class="btn btn-primary" onclick="openOrderActionConfirm(${order.id}, 'finish', this)">Retirado</button>`);
          }
          if (hasAdminPermission('admin.orders.cancel')) {
            actionButtons.push(`<button type="button" class="btn btn-outline-danger" onclick="openOrderActionConfirm(${order.id}, 'cancel', this)">Cancelar</button>`);
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
  const container = document.getElementById('lowStockList');
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
      const select = document.getElementById('stockItemSelect');
      if (select) select.value = matching.id;
    }
    openStockMoveModal();
  } catch (error) {
    showAlert('danger', `Erro ao abrir movimentação: ${error.message}`);
  }
}

function openOrderActionConfirm(orderId, action, button) {
  const modal = document.getElementById('orderActionConfirmModal');
  const message = document.getElementById('orderActionConfirmMessage');
  const confirmButton = document.getElementById('orderActionConfirmButton');
  if (!modal || !message || !confirmButton) return;

  const actionText = {
    approve: 'aprovar',
    reject: 'rejeitar',
    cancel: 'cancelar',
    finish: 'marcar como retirado'
  }[action] || 'realizar esta ação';

  pendingOrderAction = { orderId, action, button };
  message.textContent = `Tem certeza que deseja ${actionText} esta solicitação?`;
  confirmButton.className = action === 'reject' ? 'btn btn-danger' : action === 'cancel' ? 'btn btn-outline-danger' : 'btn btn-primary';
  confirmButton.textContent = action === 'finish' ? 'Retirado' : 'Confirmar';

  bootstrap.Modal.getOrCreateInstance(modal).show();
}

async function confirmOrderAction() {
  if (!pendingOrderAction) return;
  const { orderId, action, button } = pendingOrderAction;
  pendingOrderAction = null;
  document.getElementById('orderActionConfirmModal')?.querySelector('[data-bs-dismiss]')?.click();
  await handleAdminOrderAction(orderId, action, button);
}

async function openOrderDetailModal(orderId) {
  const modalLabel = document.getElementById('orderDetailModalLabel');
  const clientField = document.getElementById('orderDetailClient');
  const statusField = document.getElementById('orderDetailStatus');
  const totalField = document.getElementById('orderDetailTotal');
  const createdAtField = document.getElementById('orderDetailCreatedAt');
  const itemsBody = document.getElementById('orderDetailItemsBody');

  if (!modalLabel || !clientField || !statusField || !totalField || !createdAtField || !itemsBody) return;

  itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Carregando detalhes...</td></tr>`;
  modalLabel.textContent = 'Detalhes da Solicitação';

  try {
    const order = await fetchJson(`/orders/${orderId}`);
    clientField.textContent = order.client || order.client_name || '—';
    statusField.innerHTML = createStatusBadge(order.status);
    // show reason when present
    const reasonEl = document.getElementById('orderDetailReason');
    if (reasonEl) reasonEl.textContent = order.reason || '--';
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

    if (!Array.isArray(order.items) || order.items.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Nenhum produto encontrado.</td></tr>`;
    } else {
      itemsBody.innerHTML = order.items
        .map((item) => `
          <tr>
            <td>${item.product || item.product_name || '—'}</td>
            <td>${item.description || '—'}</td>
            <td>${item.image_url ? `<img src="${item.image_url}" alt="${item.product || 'Produto'}" style="height: 60px; width: auto; border-radius: 4px;">` : '—'}</td>
            <td>${item.quantity ?? '—'}</td>
            <td>R$ ${Number(item.unit_price || 0).toFixed(2)}</td>
            <td>R$ ${Number((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</td>
          </tr>
        `)
        .join('');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('orderDetailModal')).show();
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
              <tr>
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
          <td colspan="4" class="text-center py-5 text-danger">Falha ao carregar movimentações: ${error.message}</td>
        </tr>
      `;
    }
    showAlert('danger', `Erro ao carregar produtos/estoque: ${error.message}`);
  } finally {
    setLoadingState(button, false);
  }
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
      settingsUserRulesSelect.innerHTML = '';
      rules.forEach((rule) => {
        const option = document.createElement('option');
        option.value = rule.id;
        option.textContent = rule.name;
        if (selectedIds.includes(rule.id)) option.selected = true;
        settingsUserRulesSelect.append(option);
      });
    }

    if (settingsProfilePermissionsSelect) {
      const permissions = await fetchJson('/permissions');
      settingsProfilePermissionsSelect.innerHTML = '';
      permissions.forEach((permission) => {
        const option = document.createElement('option');
        option.value = permission.id;
        option.textContent = permission.name;
        if (selectedIds.includes(permission.id)) option.selected = true;
        settingsProfilePermissionsSelect.append(option);
      });
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
  const element = document.getElementById(modalId);
  if (!element) return null;
  const modal = new bootstrap.Modal(element);
  modal.show();
  return modal;
}

async function openSettingsUserModal(mode, userId = null) {
  const title = document.getElementById('settingsUserModalLabel');
  const userIdField = document.getElementById('settingsUserId');
  const usernameField = document.getElementById('settingsUserUsername');
  const emailField = document.getElementById('settingsUserEmail');
  const passwordField = document.getElementById('settingsUserPassword');

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

  const userId = document.getElementById('settingsUserId').value;
  const username = document.getElementById('settingsUserUsername').value.trim();
  const email = document.getElementById('settingsUserEmail').value.trim();
  const password = document.getElementById('settingsUserPassword').value;
  const ruleIds = Array.from(settingsUserRulesSelect?.selectedOptions || []).map((option) => Number(option.value));
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
    bootstrap.Modal.getInstance(document.getElementById('settingsUserModal'))?.hide();
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
  const title = document.getElementById('settingsPermissionModalLabel');
  const idField = document.getElementById('settingsPermissionId');
  const nameField = document.getElementById('settingsPermissionName');
  const descField = document.getElementById('settingsPermissionDescription');

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

  const permissionId = document.getElementById('settingsPermissionId').value;
  const name = document.getElementById('settingsPermissionName').value.trim();
  const description = document.getElementById('settingsPermissionDescription').value.trim();
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
    bootstrap.Modal.getInstance(document.getElementById('settingsPermissionModal'))?.hide();
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
  const title = document.getElementById('settingsProfileModalLabel');
  const idField = document.getElementById('settingsProfileId');
  const nameField = document.getElementById('settingsProfileName');
  const descField = document.getElementById('settingsProfileDescription');

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

  const profileId = document.getElementById('settingsProfileId').value;
  const name = document.getElementById('settingsProfileName').value.trim();
  const description = document.getElementById('settingsProfileDescription').value.trim();
  const permissionIds = Array.from(settingsProfilePermissionsSelect?.selectedOptions || []).map((option) => Number(option.value));
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
    bootstrap.Modal.getInstance(document.getElementById('settingsProfileModal'))?.hide();
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
  const stockItemSelect = document.getElementById('stockItemSelect');
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
  const categoryParent = document.getElementById('categoryParent');
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
  const productCategoriesSelect = document.getElementById('productCategories');
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
  const element = document.getElementById(modalId);
  if (!element) return null;
  const modal = new bootstrap.Modal(element);
  modal.show();
  return modal;
}

async function openCategoryModal(mode, categoryId = null) {
  const modalTitle = document.getElementById('categoryModalLabel');
  const categoryIdField = document.getElementById('categoryId');
  const nameField = document.getElementById('categoryName');
  const descField = document.getElementById('categoryDescription');

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
  if (!document.getElementById('categoryForm')) return;
  event.preventDefault();
  const categoryId = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  const description = document.getElementById('categoryDescription').value.trim();
  const parentId = document.getElementById('categoryParent').value || null;
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
    bootstrap.Modal.getInstance(document.getElementById('categoryModal'))?.hide();
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
  const modalTitle = document.getElementById('productModalLabel');
  const idField = document.getElementById('productId');
  const nameField = document.getElementById('productName');
  const barcodeField = document.getElementById('productBarcode');
  const minStockField = document.getElementById('productMinStock');
  const maxStockField = document.getElementById('productMaxStock');
  const descField = document.getElementById('productDescription');
  const priceField = document.getElementById('productPrice');
  const photoField = document.getElementById('productPhoto');
  const photoPreview = document.getElementById('productPhotoPreview');
  const stockField = document.getElementById('productStock');

  if (!modalTitle || !idField || !nameField || !barcodeField || !minStockField || !maxStockField || !descField || !priceField || !photoField || !stockField) return;

  productPhotoURL = '';
  photoPreview.innerHTML = '';

  const categorySelect = document.getElementById('productCategories');

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
    const preview = document.getElementById('productPhotoPreview');
    
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
  if (!document.getElementById('productForm')) return;
  event.preventDefault();
  const productId = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const barcode = document.getElementById('productBarcode').value.trim();
  const minStock = Number(document.getElementById('productMinStock').value || 0);
  const maxStock = document.getElementById('productMaxStock').value;
  const description = document.getElementById('productDescription').value.trim();
  const price = Number(document.getElementById('productPrice').value || 0);
  const submitButton = event.submitter || document.querySelector('#productForm button[type="submit"]');

  if (!name) {
    showAlert('warning', 'O nome do produto é obrigatório.');
    return;
  }

  setLoadingState(submitButton, true);

  try {
    const categorySelect = document.getElementById('productCategories');
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
      const stockValue = Number(document.getElementById('productStock').value || 0);
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
    bootstrap.Modal.getInstance(document.getElementById('productModal'))?.hide();
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

function openDeleteConfirm(type, id, name = null) {
  const modal = document.getElementById('deleteConfirmModal');
  const message = document.getElementById('deleteConfirmMessage');
  const confirmButton = document.getElementById('deleteConfirmButton');
  if (!modal || !message || !confirmButton) return;

  const label = type === 'category' ? 'categoria' : 'produto';
  message.textContent = name
    ? `Tem certeza que deseja excluir a ${label} "${name}"?`
    : `Tem certeza que deseja excluir este ${label}?`;
  confirmButton.textContent = `Excluir ${label}`;
  confirmButton.className = 'btn btn-danger';

  pendingDelete = { type, id };
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  pendingDelete = null;
  const modal = document.getElementById('deleteConfirmModal');
  bootstrap.Modal.getInstance(modal)?.hide();

  if (type === 'category') {
    await performDeleteCategory(id);
  } else {
    await performDeleteProduct(id);
  }
}

async function openStockMoveModal() {
  if (!document.getElementById('stockMoveForm')) return;
  document.getElementById('stockMoveForm')?.reset();
  await loadStockItems();
  openModal('stockMoveModal');
}

async function saveStockMove(event) {
  if (!document.getElementById('stockMoveForm')) return;
  event.preventDefault();
  const stockId = document.getElementById('stockItemSelect').value;
  const moveType = document.getElementById('stockMoveType').value;
  const quantity = Number(document.getElementById('stockQuantityChange').value || 0);
  const reason = document.getElementById('stockReason').value.trim();
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
    bootstrap.Modal.getInstance(document.getElementById('stockMoveModal'))?.hide();
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
  const clientNameElement = document.getElementById('clientDeactivateName');
  const confirmButton = document.getElementById('confirmDeactivateClientButton');
  const clientMessage = document.getElementById('clientDeactivateMessage');

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
  const modal = document.getElementById('clientDeactivateModal');
  const confirmButton = document.getElementById('confirmDeactivateClientButton');
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

window.handleAdminOrderAction = async function (orderId, action, button) {
  setLoadingState(button, true);
  try {
    await fetchJson(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
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
window.openClientDeactivateModal = openClientDeactivateModal;
window.openClientDetailModal = openClientDetailModal;
window.openOrderDetailModal = openOrderDetailModal;

window.addEventListener('DOMContentLoaded', async () => {
  const refreshOrdersButton = document.getElementById('refreshOrdersButton');
  const refreshCategoriesButton = document.getElementById('refreshCategoriesButton');
  const refreshProductsButton = document.getElementById('refreshProductsButton');
  const refreshClientsButton = document.getElementById('refreshClientsButton');
  const newCategoryButton = document.getElementById('newCategoryButton');
  const newProductButton = document.getElementById('newProductButton');
  const newStockMoveButton = document.getElementById('newStockMoveButton');
  const viewStockMovesButton = document.getElementById('viewStockMovesButton');
  const refreshStockMovesButton = document.getElementById('refreshStockMovesButton');
  const backToProductsButton = document.getElementById('backToProductsButton');
  const filterStockMovesButton = document.getElementById('filterStockMovesButton');
  const quick7DaysButton = document.getElementById('quick7DaysButton');
  const quick90DaysButton = document.getElementById('quick90DaysButton');
  const orderActionConfirmButton = document.getElementById('orderActionConfirmButton');
  const deleteConfirmButton = document.getElementById('deleteConfirmButton');
  const stockStartDate = document.getElementById('stockStartDate');
  const stockEndDate = document.getElementById('stockEndDate');
  const categoryForm = document.getElementById('categoryForm');
  const productForm = document.getElementById('productForm');
  const stockMoveForm = document.getElementById('stockMoveForm');

  refreshOrdersButton?.addEventListener('click', () => loadOrders(refreshOrdersButton));
  refreshCategoriesButton?.addEventListener('click', () => loadCategories(refreshCategoriesButton));
  refreshProductsButton?.addEventListener('click', () => loadProducts(refreshProductsButton));
  refreshClientsButton?.addEventListener('click', () => loadClients(refreshClientsButton));
  clientsTableBody?.addEventListener('click', handleClientTableClick);
  newCategoryButton?.addEventListener('click', () => openCategoryModal('new'));
  newProductButton?.addEventListener('click', () => openProductModal('new'));
  newStockMoveButton?.addEventListener('click', openStockMoveModal);
  viewStockMovesButton?.addEventListener('click', () => { window.location.href = '/admin/products/stock-moves'; });
  refreshStockMovesButton?.addEventListener('click', () => loadStockMoves(refreshStockMovesButton));
  backToProductsButton?.addEventListener('click', () => { window.location.href = '/admin/products'; });
  filterStockMovesButton?.addEventListener('click', () => loadStockMoves(filterStockMovesButton));
  quick7DaysButton?.addEventListener('click', () => setStockFilterRange(7, true));
  quick90DaysButton?.addEventListener('click', () => setStockFilterRange(90, true));
  orderActionConfirmButton?.addEventListener('click', confirmOrderAction);
  deleteConfirmButton?.addEventListener('click', confirmDelete);
  categoryForm?.addEventListener('submit', saveCategory);
  productForm?.addEventListener('submit', saveProduct);
  stockMoveForm?.addEventListener('submit', saveStockMove);

  refreshSettingsUsersButton?.addEventListener('click', () => loadSettingsUsers(refreshSettingsUsersButton));
  newSettingsUserButton?.addEventListener('click', () => openSettingsUserModal('new'));
  refreshSettingsPermissionsButton?.addEventListener('click', () => loadSettingsPermissions(refreshSettingsPermissionsButton));
  newSettingsPermissionButton?.addEventListener('click', () => openSettingsPermissionModal('new'));
  refreshSettingsProfilesButton?.addEventListener('click', () => loadSettingsProfiles(refreshSettingsProfilesButton));
  newSettingsProfileButton?.addEventListener('click', () => openSettingsProfileModal('new'));
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
