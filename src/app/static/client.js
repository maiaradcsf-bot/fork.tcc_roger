// Client-side dashboard and ordering script

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

async function loadSummary() {
  const token = getClientToken();
  const totalEl = document.getElementById('clientTotalOrders');
  const pendingEl = document.getElementById('clientPendingOrders');
  const qtyEl = document.getElementById('clientTotalQuantity');
  const productsEl = document.getElementById('clientProductsCount');

  if (!token) {
    if (totalEl) totalEl.textContent = '—';
    if (pendingEl) pendingEl.textContent = '—';
    if (qtyEl) qtyEl.textContent = '—';
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
    if (qtyEl) qtyEl.textContent = data.total_quantity ?? 0;
    if (productsEl) productsEl.textContent = data.products_count ?? 0;
  } catch (err) {
    showAlert('danger', `Falha ao carregar resumo: ${err.message}`);
  }
}

async function loadProducts() {
  const grid = document.getElementById('clientProductsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="col text-center text-muted py-4">Carregando produtos...</div>';

  try {
    const resp = await fetch('/api/products');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const products = await resp.json();
    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<div class="col text-center text-muted py-4">Nenhum produto disponível.</div>';
      return;
    }

    grid.innerHTML = products.map(p => {
      const img = p.photo_path ? `<img src="${p.photo_path}" class="card-img-top" style="height:160px;object-fit:cover;" alt="${p.name}">` : '';
      const stock = p.stock ?? 0;
      return `
        <div class="col">
          <div class="card h-100">
            ${img}
            <div class="card-body d-flex flex-column">
              <h5 class="card-title">${p.name}</h5>
              <p class="card-text text-truncate">${p.description || ''}</p>
              <div class="mt-auto d-flex justify-content-between align-items-center">
                <div>
                  <small class="text-muted">Estoque: ${stock}</small>
                </div>
                <div class="text-end">
                  <div class="fw-bold text-warning">${formatPrice(p.price)}</div>
                  <button class="btn btn-primary btn-sm mt-2" onclick="requisitarProduto(${p.id}, '${(p.name||'').replace("'","\'")}')">Requisitar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="col text-center text-danger py-4">Erro ao carregar produtos: ${err.message}</div>`;
  }
}

window.requisitarProduto = async function(productId, productName) {
  const { value: qtd } = await Swal.fire({
    title: `Requisitar: ${productName}`,
    input: 'number',
    inputLabel: 'Quantidade',
    inputValue: 1,
    showCancelButton: true,
    confirmButtonText: 'Enviar solicitação',
    preConfirm: (v) => {
      const n = Number(v);
      if (!n || n < 1) {
        Swal.showValidationMessage('Informe uma quantidade válida (>=1)');
        return false;
      }
      return n;
    }
  });

  if (!qtd) return;

  const token = getClientToken();
  if (!token) {
    showAlert('warning', 'Autenticação de cliente não encontrada. Faça cadastro/login.');
    return;
  }

  try {
    const resp = await fetch('/api/client/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: qtd }] })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.error || `Erro ${resp.status}`);
    }

    const data = await resp.json();
    await Swal.fire('Solicitação enviada', `Pedido #${data.order_id} criado com total ${formatPrice(data.total)}`, 'success');
    await loadSummary();
  } catch (err) {
    Swal.fire('Erro', `Falha ao criar solicitação: ${err.message}`, 'error');
  }
}

window.clientLogout = function() {
  localStorage.removeItem('client_token');
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  loadProducts();
});
