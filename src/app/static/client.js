// Client-side dashboard and ordering script
let clientProductsCache = [];
let clientOpenCart = null;
let clientOrdersChartRange = 7;
const OPEN_CART_STATUSES = ['open'];

function getClientToken() {
  return localStorage.getItem('client_token');
}

function showAlert(type, message) {
  const container = document.getElementById('alertContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `alert alert-${type} alert-dismissible fade show`;
  el.role = 'alert';
  el.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>`;
  container.innerHTML = '';
  container.appendChild(el);
}

function formatPrice(v) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeClientOrderStatus(status) {
  const normalized = (status || '').toString().toLowerCase();
  if (['initial', 'inicial', 'pendent', 'pendente'].includes(normalized)) return 'pending';
  if (['aprovado'].includes(normalized)) return 'approved';
  if (['completed', 'concluido', 'concluído', 'retirado', 'picked_up', 'withdrawn', 'checked_out'].includes(normalized)) return 'finished';
  return normalized;
}

function getOrderQuantity(order) {
  if (Number.isFinite(Number(order.quantity_total))) return Number(order.quantity_total);
  return (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatChartDateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

async function loadSummary() {
  const token = getClientToken();
  const totalEl = document.getElementById('clientTotalOrders');
  const pendingEl = document.getElementById('clientPendingOrders');
  const approvedEl = document.getElementById('clientApprovedOrders');
  const finishedEl = document.getElementById('clientFinishedOrders');
  const qtyEl = document.getElementById('clientTotalQuantity');
  const totalValueEl = document.getElementById('clientTotalValue');
  const productsEl = document.getElementById('clientProductsCount');

  if (!token) {
    if (totalEl) totalEl.textContent = '—';
    if (pendingEl) pendingEl.textContent = '—';
    if (approvedEl) approvedEl.textContent = '—';
    if (finishedEl) finishedEl.textContent = '—';
    if (qtyEl) qtyEl.textContent = '—';
    if (totalValueEl) totalValueEl.textContent = '—';
    if (productsEl) productsEl.textContent = '—';
    showAlert('warning', 'Autenticação de cliente não encontrada. Faça cadastro/login.');
    return;
  }

  try {
    const resp = await fetch('/api/client/summary', { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        showAlert('warning', 'Sessão expirada. Faça login novamente.');
        return;
      }
      throw new Error(`Erro ${resp.status}`);
    }
    const data = await resp.json();
    if (totalEl) totalEl.textContent = data.total_orders ?? 0;
    if (pendingEl) pendingEl.textContent = data.pending_orders ?? 0;
    if (approvedEl) approvedEl.textContent = data.approved_orders ?? 0;
    if (finishedEl) finishedEl.textContent = data.finished_orders ?? 0;
    if (qtyEl) qtyEl.textContent = data.total_quantity ?? 0;
    if (totalValueEl) totalValueEl.textContent = formatPrice(data.total_value ?? 0);
    if (productsEl) productsEl.textContent = data.products_count ?? 0;
    if (document.getElementById('clientOrdersChart')) {
      await loadClientDashboardOrders(token);
    }
  } catch (err) {
    showAlert('danger', `Falha ao carregar resumo: ${err.message}`);
  }
}

async function loadClientDashboardOrders(token = getClientToken()) {
  if (!token) return;
  const chart = document.getElementById('clientOrdersChart');
  if (!chart) return;

  const response = await fetch('/api/client/orders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error || `Erro ${response.status}`);
  }

  const orders = await response.json();
  updateClientDashboardFromOrders(Array.isArray(orders) ? orders : []);
}

function updateClientDashboardFromOrders(orders) {
  renderClientOrdersChart(Array.isArray(orders) ? orders : [], clientOrdersChartRange);
}

function buildOrdersSeries(orders, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days + 1);

  const buckets = [];
  const bucketMap = new Map();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = getLocalDateKey(date);
    const bucket = { key, label: formatChartDateLabel(key), orders: 0, items: 0 };
    buckets.push(bucket);
    bucketMap.set(key, bucket);
  }

  orders.forEach((order) => {
    if (!order.created_at) return;
    const createdAt = new Date(order.created_at);
    if (Number.isNaN(createdAt.getTime())) return;
    createdAt.setHours(0, 0, 0, 0);
    if (createdAt < startDate || createdAt > today) return;
    const bucket = bucketMap.get(getLocalDateKey(createdAt));
    if (!bucket) return;
    bucket.orders += 1;
    bucket.items += getOrderQuantity(order);
  });

  return buckets;
}

function renderClientOrdersChart(orders, days) {
  const canvas = document.getElementById('clientOrdersChart');
  const emptyEl = document.getElementById('clientOrdersChartEmpty');
  const periodOrdersEl = document.getElementById('clientPeriodOrdersCount');
  const periodItemsEl = document.getElementById('clientPeriodItemsCount');
  if (!canvas) return;

  const series = buildOrdersSeries(orders, days);
  const periodOrders = series.reduce((sum, item) => sum + item.orders, 0);
  const periodItems = series.reduce((sum, item) => sum + item.items, 0);
  if (periodOrdersEl) periodOrdersEl.textContent = periodOrders;
  if (periodItemsEl) periodItemsEl.textContent = periodItems;
  if (emptyEl) emptyEl.classList.toggle('d-none', periodOrders > 0);

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || 720;
  const height = parent?.clientHeight || 320;
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 20, right: 18, bottom: 48, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...series.map((item) => item.orders));
  const gridLines = 4;

  ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e9ecef';
  ctx.fillStyle = '#6c757d';

  for (let index = 0; index <= gridLines; index += 1) {
    const y = padding.top + (chartHeight / gridLines) * index;
    const value = Math.round(maxValue - (maxValue / gridLines) * index);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(String(value), 8, y + 4);
  }

  const gap = days > 30 ? 3 : 6;
  const barWidth = Math.max(3, (chartWidth - gap * (series.length - 1)) / series.length);
  series.forEach((item, index) => {
    const x = padding.left + index * (barWidth + gap);
    const barHeight = (item.orders / maxValue) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    ctx.fillStyle = item.orders > 0 ? '#0d6efd' : '#dbe7ff';
    ctx.fillRect(x, y, barWidth, barHeight || 2);

    const shouldShowLabel = days <= 15 || index === 0 || index === series.length - 1 || index % Math.ceil(days / 8) === 0;
    if (shouldShowLabel) {
      ctx.save();
      ctx.translate(x + barWidth / 2, height - 22);
      ctx.rotate(days > 15 ? -0.5 : 0);
      ctx.fillStyle = '#6c757d';
      ctx.textAlign = days > 15 ? 'right' : 'center';
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    }
  });

  ctx.strokeStyle = '#ced4da';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(width - padding.right, padding.top + chartHeight);
  ctx.stroke();
}

function setClientOrdersChartRange(days) {
  clientOrdersChartRange = days;
  document.querySelectorAll('.client-orders-range-button').forEach((button) => {
    const active = Number(button.dataset.rangeDays) === days;
    button.classList.toggle('btn-primary', active);
    button.classList.toggle('btn-outline-primary', !active);
  });
  updateClientDashboardFromOrders();
}

function getOpenCartFromList(carts) {
  return Array.isArray(carts) ? carts.find((cart) => OPEN_CART_STATUSES.includes(cart.status)) : null;
}

function getCartItemsCount(cart) {
  return (cart?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

async function fetchOpenCart(token = getClientToken()) {
  if (!token) {
    clientOpenCart = null;
    updateCartButton();
    return null;
  }

  const response = await fetch('/api/client/carts', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Erro ${response.status} ao buscar carrinho`);

  const carts = await response.json();
  clientOpenCart = getOpenCartFromList(carts);
  updateCartButton();
  return clientOpenCart;
}

function updateCartButton() {
  const countEl = document.getElementById('clientCartCount');
  if (!countEl) return;
  countEl.textContent = getCartItemsCount(clientOpenCart);
}

async function loadProducts() {
  const tableBody = document.getElementById('clientProductsTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Carregando produtos...</td></tr>';

  try {
    const token = getClientToken();
    const resp = await fetch('/api/client/products', { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const products = await resp.json();
    clientProductsCache = Array.isArray(products) ? products : [];

    if (!Array.isArray(products) || products.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Nenhum produto disponível.</td></tr>';
      return;
    }

    tableBody.innerHTML = products.map((p, index) => {
      const img = p.photo_path ? `<img src="${escapeHtml(p.photo_path)}" alt="${escapeHtml(p.name)}" style="height: 40px; width: auto; border-radius: 4px; margin-right: 8px;">` : '';
      const stock = p.stock ?? 0;
      return `
        <tr>
          <th scope="row">${index + 1}</th>
          <td>
            ${img}
            ${escapeHtml(p.name || '—')}
          </td>
          <td>${formatPrice(p.price)}</td>
          <td>${stock}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-secondary" onclick="visualizarProduto(${p.id})">Visualizar</button>
              <button type="button" class="btn btn-primary" onclick="adicionarRequisicao(${p.id})" ${stock <= 0 ? 'disabled' : ''}>Adicionar requisição</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-danger">Erro ao carregar produtos: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function findClientProduct(productId) {
  return clientProductsCache.find((product) => Number(product.id) === Number(productId));
}

window.visualizarProduto = function(productId) {
  const product = findClientProduct(productId);
  if (!product) return;

  document.getElementById('clientProductDetailModalLabel').textContent = product.name || 'Detalhes do Produto';
  document.getElementById('clientProductDetailName').textContent = product.name || '—';
  document.getElementById('clientProductDetailDescription').textContent = product.description || '—';
  document.getElementById('clientProductDetailPrice').textContent = formatPrice(product.price);
  document.getElementById('clientProductDetailStock').textContent = product.stock ?? '—';
  document.getElementById('clientProductDetailCategories').textContent = Array.isArray(product.categories) && product.categories.length
    ? product.categories.join(', ')
    : '—';

  const imageContainer = document.getElementById('clientProductDetailImage');
  if (imageContainer) {
    imageContainer.innerHTML = product.photo_path
      ? `<img src="${escapeHtml(product.photo_path)}" alt="${escapeHtml(product.name)}" class="img-fluid w-100" style="max-height: 260px; object-fit: cover;">`
      : '<span class="text-muted">Sem imagem</span>';
  }

  const addButton = document.getElementById('clientProductDetailAddButton');
  if (addButton) {
    addButton.onclick = () => adicionarRequisicao(product.id);
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('clientProductDetailModal')).show();
}

async function requestQuantity(productName, maxQuantity) {
  if (window.Swal) {
    const { value } = await Swal.fire({
      title: `Adicionar requisição: ${productName}`,
      input: 'number',
      inputLabel: `Quantidade disponível: ${maxQuantity}`,
      inputValue: 1,
      inputAttributes: {
        min: 1,
        max: maxQuantity,
        step: 1
      },
      showCancelButton: true,
      confirmButtonText: 'Adicionar ao carrinho',
      preConfirm: (v) => {
        const n = Number(v);
        if (!n || n < 1) {
          Swal.showValidationMessage('Informe uma quantidade válida (>=1)');
          return false;
        }
        if (n > maxQuantity) {
          Swal.showValidationMessage(`Quantidade máxima disponível: ${maxQuantity}`);
          return false;
        }
        return n;
      }
    });
    return value;
  }

  const value = window.prompt(`Quantidade para ${productName}`, '1');
  if (value === null) return null;
  const quantity = Number(value);
  if (!quantity || quantity < 1) {
    showAlert('warning', 'Informe uma quantidade válida (>=1).');
    return null;
  }
  if (quantity > maxQuantity) {
    showAlert('warning', `Quantidade máxima disponível: ${maxQuantity}.`);
    return null;
  }
  return quantity;
}

async function getOrCreateActiveCart(token) {
  const activeCart = await fetchOpenCart(token);
  if (activeCart) return activeCart;

  const createResp = await fetch('/api/client/carts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!createResp.ok) {
    const err = await createResp.json().catch(() => null);
    throw new Error(err?.error || `Erro ${createResp.status} ao criar carrinho`);
  }

  clientOpenCart = await createResp.json();
  updateCartButton();
  return clientOpenCart;
}

window.adicionarRequisicao = async function(productId) {
  const product = findClientProduct(productId);
  const productName = product?.name || 'produto';
  const stock = Number(product?.stock ?? 0);

  const token = getClientToken();
  if (!token) {
    showAlert('warning', 'Autenticação de cliente não encontrada. Faça cadastro/login.');
    return;
  }

  try {
    const cart = await getOrCreateActiveCart(token);
    const existingQuantity = Number((cart.items || []).find((item) => Number(item.product_id) === Number(productId))?.quantity || 0);
    const availableQuantity = stock - existingQuantity;
    if (availableQuantity <= 0) {
      showAlert('warning', `Estoque disponível já está no carrinho para ${productName}.`);
      return;
    }

    const qtd = await requestQuantity(productName, availableQuantity);
    if (!qtd) return;

    const resp = await fetch(`/api/client/carts/${cart.id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ product_id: productId, quantity: qtd })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.error || `Erro ${resp.status}`);
    }

    const data = await resp.json();
    await fetchOpenCart(token);
    if (window.Swal) {
      await Swal.fire('Produto adicionado', `${productName} foi adicionado ao carrinho. Quantidade no carrinho: ${data.quantity}`, 'success');
    } else {
      showAlert('success', `${productName} foi adicionado ao carrinho.`);
    }
    await loadSummary();
  } catch (err) {
    if (window.Swal) {
      Swal.fire('Erro', `Falha ao adicionar requisição: ${err.message}`, 'error');
    } else {
      showAlert('danger', `Falha ao adicionar requisição: ${err.message}`);
    }
  }
}

function renderCartSummary(cart) {
  const body = document.getElementById('clientCartItemsBody');
  const totalEl = document.getElementById('clientCartTotal');
  const confirmButton = document.getElementById('confirmClientCartButton');
  if (!body || !totalEl || !confirmButton) return;

  const items = cart?.items || [];
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Carrinho vazio.</td></tr>';
    totalEl.textContent = formatPrice(0);
    confirmButton.disabled = true;
    return;
  }

  let total = 0;
  body.innerHTML = items.map((item) => {
    const unitPrice = Number(item.unit_price || 0);
    const quantity = Number(item.quantity || 0);
    const subtotal = Number(item.subtotal ?? unitPrice * quantity);
    total += subtotal;
    const stock = Number(item.stock ?? 0);
    const stockWarning = quantity > stock
      ? `<div class="text-danger small">Estoque atual: ${stock}</div>`
      : '';

    return `
      <tr>
        <td>${escapeHtml(item.product_name || '—')}${stockWarning}</td>
        <td style="max-width: 140px;">
          <input
            type="number"
            class="form-control form-control-sm"
            id="clientCartItemQuantity-${item.id}"
            min="1"
            max="${stock}"
            value="${quantity}"
            ${stock <= 0 ? 'disabled' : ''}
          />
          <div class="form-text">Estoque: ${stock}</div>
        </td>
        <td>${formatPrice(unitPrice)}</td>
        <td>${formatPrice(subtotal)}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn btn-outline-primary" onclick="updateClientCartItem(${item.id})" ${stock <= 0 ? 'disabled' : ''}>Salvar</button>
            <button type="button" class="btn btn-outline-danger" onclick="removeClientCartItem(${item.id})">Remover</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  totalEl.textContent = formatPrice(total);
  confirmButton.disabled = items.some((item) => Number(item.quantity || 0) > Number(item.stock ?? 0));
}

async function refreshCartSummary(token = getClientToken()) {
  const cart = await fetchOpenCart(token);
  renderCartSummary(cart);
  return cart;
}

window.updateClientCartItem = async function(itemId) {
  const token = getClientToken();
  if (!token || !clientOpenCart) return;

  const item = (clientOpenCart.items || []).find((cartItem) => Number(cartItem.id) === Number(itemId));
  const input = document.getElementById(`clientCartItemQuantity-${itemId}`);
  if (!item || !input) return;

  const quantity = Number(input.value);
  const stock = Number(item.stock ?? 0);
  if (!quantity || quantity < 1) {
    showAlert('warning', 'Informe uma quantidade válida (>=1).');
    return;
  }
  if (quantity > stock) {
    showAlert('warning', `Quantidade máxima disponível para ${item.product_name}: ${stock}.`);
    return;
  }

  try {
    const response = await fetch(`/api/client/carts/${clientOpenCart.id}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ quantity })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || `Erro ${response.status}`);
    }

    await refreshCartSummary(token);
    showAlert('success', 'Quantidade atualizada.');
  } catch (err) {
    showAlert('danger', `Falha ao atualizar item: ${err.message}`);
  }
}

window.removeClientCartItem = async function(itemId) {
  const token = getClientToken();
  if (!token || !clientOpenCart) return;

  try {
    const response = await fetch(`/api/client/carts/${clientOpenCart.id}/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || `Erro ${response.status}`);
    }

    await refreshCartSummary(token);
    showAlert('success', 'Produto removido do carrinho.');
  } catch (err) {
    showAlert('danger', `Falha ao remover item: ${err.message}`);
  }
}

window.openClientCartSummary = async function() {
  const token = getClientToken();
  if (!token) {
    showAlert('warning', 'Autenticação de cliente não encontrada. Faça cadastro/login.');
    return;
  }

  try {
    await refreshCartSummary(token);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('clientCartModal')).show();
  } catch (err) {
    showAlert('danger', `Falha ao carregar carrinho: ${err.message}`);
  }
}

window.confirmClientCart = async function() {
  const token = getClientToken();
  if (!token || !clientOpenCart) return;

  try {
    const response = await fetch(`/api/client/carts/${clientOpenCart.id}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || `Erro ${response.status}`);
    }

    const data = await response.json();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('clientCartModal')).hide();
    clientOpenCart = null;
    updateCartButton();
    await loadSummary();
    await loadProducts();
    showAlert('success', `Solicitação #${data.order_id} confirmada com total ${formatPrice(data.total)}.`);
  } catch (err) {
    showAlert('danger', `Falha ao confirmar solicitação: ${err.message}`);
  }
}

window.clientLogout = function() {
  localStorage.removeItem('client_token');
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  loadProducts();
  fetchOpenCart().catch(() => updateCartButton());
  document.getElementById('refreshClientProductsButton')?.addEventListener('click', loadProducts);
  document.getElementById('clientCartButton')?.addEventListener('click', openClientCartSummary);
  document.getElementById('confirmClientCartButton')?.addEventListener('click', confirmClientCart);
  document.querySelectorAll('.client-orders-range-button').forEach((button) => {
    button.addEventListener('click', () => setClientOrdersChartRange(Number(button.dataset.rangeDays) || 7));
  });
  window.addEventListener('resize', () => {
    if (document.getElementById('clientOrdersChart')) {
      // Buscar dados atualizados da API ao redimensionar, evitando cache em memória
      loadClientDashboardOrders().catch(() => {});
    }
  });
});
