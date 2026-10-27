// Renders the real admin/client/auth scripts in a DOM (jsdom, inline handlers enabled) with
// malicious API data and checks it ends up as text: no injected elements, no executed code.
// Setup once: (cd src/web/tests/frontend && npm install)   Run: node --test src/web/tests/frontend/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// XSS_JS_ROOT lets the same tests run against another copy of the scripts (e.g. an older commit)
const JS_ROOT = process.env.XSS_JS_ROOT || new URL('../../app/static/js/', import.meta.url).pathname;
const source = (path) => readFileSync(`${JS_ROOT}/${path}`, 'utf8');

const MARK = '__xss';
// One value that tries to break out of every context the templates use: HTML text,
// double/single-quoted attributes and JS string arguments inside onclick handlers
const PAYLOAD = `<img src=x onerror="window.${MARK}=1"><svg onload="window.${MARK}=1"></svg>"'><script>window.${MARK}=1</script>');window.${MARK}=1;//";window.${MARK}=1;//`;
const BAD_URL = `x" onerror="window.${MARK}=1`;

const ADMIN_BODY = `
  <div id="alertContainer"></div>
  <table><tbody id="ordersTableBody"></tbody></table>
  <table><tbody id="categoriesTableBody"></tbody></table>
  <table><tbody id="productsTableBody"></tbody></table>
  <table><tbody id="stockMovesTableBody"></tbody></table>
  <table><tbody id="clientsTableBody"></tbody></table>
  <table><tbody id="settingsUsersTableBody"></tbody></table>
  <table><tbody id="settingsPermissionsTableBody"></tbody></table>
  <table><tbody id="settingsProfilesTableBody"></tbody></table>
  <div id="clientDetailName"></div><div id="clientDetailEmail"></div><div id="clientDetailPhone"></div>
  <div id="clientDetailOrdersList"></div><div id="clientDetailModal"></div>
  <div id="orderDetailModal"></div><div id="orderDetailModalLabel"></div><div id="orderDetailClient"></div>
  <div id="orderDetailStatus"></div><div id="orderDetailTotal"></div><div id="orderDetailReasonRow"></div>
  <div id="orderDetailReason"></div><div id="orderDetailCreatedAt"></div><div id="orderDetailAudit"></div>
  <table><tbody id="orderDetailItemsBody"></tbody></table>
  <div id="clientDeactivateModal"></div><div id="clientDeactivateName"></div>
  <div id="clientDeactivateMessage"></div><button id="confirmDeactivateClientButton"></button>
  <div id="productModal"></div><div id="productModalLabel"></div><input id="productId"><input id="productName">
  <input id="productBarcode"><input id="productMinStock"><input id="productMaxStock"><input id="productDescription">
  <input id="productPrice"><input id="productPhoto"><div id="productPhotoPreview"></div>
  <div><input id="productStock"></div><select id="productCategories" multiple></select>
  <div id="importSummaryCards"></div><table><tbody id="importPreviewTableBody"></tbody></table>
  <div id="importResultMessage"></div>
  <div id="importStep1"></div><div id="importStep2"></div><div id="importStep3"></div>
  <div id="lowStockList"></div>
`;

const CLIENT_BODY = `
  <div id="alertContainer"></div>
  <table><tbody id="clientProductsTableBody"></tbody></table>
  <table><tbody id="clientCartItemsBody"></tbody></table>
  <span id="clientCartTotal"></span><button id="confirmClientCartButton"></button><span id="clientCartCount"></span>
  <table><tbody id="clientOrdersTableBody"></tbody></table>
  <div id="clientOrderDetailModal"></div><div id="clientOrderDetailModalLabel"></div><div id="clientOrderDetailClient"></div>
  <div id="clientOrderDetailStatus"></div><div id="clientOrderDetailTotal"></div><div id="clientOrderDetailReasonRow"></div>
  <div id="clientOrderDetailReason"></div><div id="clientOrderDetailCreatedAt"></div><div id="clientOrderDetailAudit"></div>
  <table><tbody id="clientOrderDetailItemsBody"></tbody></table>
  <div id="clientProfilePhotoPreview"></div>
`;

const AUTH_BODY = `
  <div id="alertContainer"></div>
  <form id="loginForm"><input id="email" value="a@a"><input id="password" value="x"><button id="loginButton"></button></form>
`;

class FakeModal {
  static getOrCreateInstance() { return new FakeModal(); }
  static getInstance() { return new FakeModal(); }
  show() {}
  hide() {}
}

function createPage(body, scripts, routes) {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
  });
  const w = dom.window;
  w.bootstrap = { Modal: FakeModal };
  w.confirm = () => true;
  w.console.warn = () => {};
  w.console.error = () => {};
  w.localStorage.setItem('admin_token', 'token');
  w.localStorage.setItem('client_token', 'token');
  w.fetch = async (url, init = {}) => {
    const path = String(url).split('?')[0];
    const route = routes[path];
    if (route === undefined) throw new Error(`rota não simulada: ${path}`);
    const { status = 200, body: payload } = typeof route === 'function' ? route(init) : { body: route };
    return { ok: status < 400, status, json: async () => payload };
  };
  // Classic <script> elements, like the browser: top-level let/const stay in the shared global scope
  for (const script of scripts) {
    const element = w.document.createElement('script');
    element.textContent = source(script);
    w.document.body.appendChild(element);
  }
  return w;
}

// The rendered region must contain no element created from the data and show the payload as text
function assertInert(w, element, { expectText = true } = {}) {
  assert.ok(element, 'elemento não encontrado');
  assert.equal(w[MARK], undefined, 'código do payload foi executado');
  const injected = element.querySelectorAll('script, svg, [onerror], [onload]');
  assert.equal(injected.length, 0, `elementos injetados: ${Array.from(injected).map((el) => el.outerHTML).join(' | ')}`);
  if (expectText) assert.ok(element.textContent.includes(PAYLOAD), 'o payload não aparece como texto literal');
}

// Clicks every inline-handler button and records what the handler received instead of running it
function clickHandlers(w, element, handlerNames) {
  const calls = [];
  for (const name of handlerNames) w[name] = (...args) => calls.push({ name, args });
  element.querySelectorAll('[onclick]').forEach((button) => button.click());
  assert.equal(w[MARK], undefined, 'um onclick executou o payload');
  return calls;
}

const ADMIN_SCRIPTS = ['common/app-helpers.js', 'common/module-search.js', 'admin/admin.js'];
const ALL_PERMISSIONS = `adminPermissions = ['admin.orders.approve','admin.orders.reject','admin.orders.cancel',
  'admin.categories.edit','admin.categories.delete','admin.products.edit','admin.products.delete',
  'admin.stock.moves.delete','admin.settings.users.manage','admin.settings.permissions.manage',
  'admin.settings.profiles.manage'];`;

function adminPage(routes) {
  const w = createPage(ADMIN_BODY, ADMIN_SCRIPTS, routes);
  w.eval(ALL_PERMISSIONS);
  return w;
}

test('admin: lista de pedidos (nome do cliente, produtos, status)', async () => {
  const w = adminPage({
    '/api/admin/orders': [{ id: 1, client: PAYLOAD, product_summary: PAYLOAD, quantity_total: PAYLOAD, status: PAYLOAD, total: 1, created_at: '2026-01-01T00:00:00' },
                          { id: 2, client: PAYLOAD, status: 'pending', total: 1 }],
  });
  await w.eval('loadOrders()');
  const body = w.document.getElementById('ordersTableBody');
  assertInert(w, body);
  const calls = clickHandlers(w, body, ['openOrderActionConfirm', 'openOrderDetailModal']);
  assert.ok(calls.length >= 4);
});

test('admin: detalhes do pedido (itens, imagem, auditoria, motivo)', async () => {
  const w = adminPage({
    '/api/admin/orders/1': {
      id: 1, client: PAYLOAD, status: PAYLOAD, reason: PAYLOAD, total: 1, approved_at: '2026-01-01', approved_by_name: PAYLOAD,
      canceled_at: '2026-01-02', canceled_by_name: PAYLOAD,
      items: [{ product: PAYLOAD, description: PAYLOAD, barcode: PAYLOAD, image_url: BAD_URL, quantity: PAYLOAD, unit_price: 1 }],
    },
  });
  await w.eval('openOrderDetailModal(1)');
  const items = w.document.getElementById('orderDetailItemsBody');
  assertInert(w, items);
  assert.equal(items.querySelector('img').getAttribute('src'), BAD_URL, 'a URL deve ficar inteira no atributo src');
  assertInert(w, w.document.getElementById('orderDetailAudit'));
  // the status badge reformats the text (capitalisation, '_' -> ' '), so only check nothing was injected
  assertInert(w, w.document.getElementById('orderDetailStatus'), { expectText: false });
  assert.equal(w.document.getElementById('orderDetailClient').textContent, PAYLOAD);
});

test('admin: clientes (nome, email, telefone) e modal de inativação', async () => {
  const w = adminPage({ '/api/admin/clients': [{ id: 7, name: PAYLOAD, email: PAYLOAD, phone: PAYLOAD, active: true }] });
  await w.eval('loadClients()');
  const body = w.document.getElementById('clientsTableBody');
  assertInert(w, body);
  body.querySelector('[onclick]').click();   // runs the real openClientDeactivateModal
  assert.equal(w[MARK], undefined, 'o onclick executou o payload');
  assert.equal(w.document.getElementById('clientDeactivateName').textContent, PAYLOAD, 'o nome deve chegar intacto ao modal');
  assertInert(w, w.document.getElementById('clientDeactivateMessage'));
  assert.equal(w.document.getElementById('confirmDeactivateClientButton').dataset.clientId, '7');
});

test('admin: detalhes do cliente (pedidos e itens)', async () => {
  const w = adminPage({
    '/api/admin/clients/7/details': {
      name: PAYLOAD, email: PAYLOAD, phone: PAYLOAD,
      orders: [{ id: 1, status: PAYLOAD, total: 1, product_lines: PAYLOAD, quantity: PAYLOAD, items: [{ product_name: PAYLOAD, quantity: 1, unit_price: 1 }] }],
    },
  });
  await w.eval('openClientDetailModal(7)');
  assertInert(w, w.document.getElementById('clientDetailOrdersList'));
  assert.equal(w.document.getElementById('clientDetailName').textContent, PAYLOAD);
});

test('admin: categorias e botão de exclusão', async () => {
  const w = adminPage({
    '/api/admin/categories': [{ id: 1, name: PAYLOAD, description: PAYLOAD, parent_id: null },
                              { id: 2, name: PAYLOAD, description: PAYLOAD, parent_id: 1 }],
  });
  await w.eval('loadCategories()');
  const body = w.document.getElementById('categoriesTableBody');
  assertInert(w, body);
  const deletes = clickHandlers(w, body, ['openCategoryModal', 'deleteCategory']).filter((c) => c.name === 'deleteCategory');
  assert.deepEqual(deletes.map((c) => c.args), [[1, PAYLOAD], [2, PAYLOAD]]);
});

test('admin: produtos (nome, foto, categorias) e botão de exclusão', async () => {
  const w = adminPage({
    '/api/admin/products': [{ id: 3, name: PAYLOAD, barcode: PAYLOAD, photo_path: BAD_URL, price: 1, stock: PAYLOAD,
                              min_stock: PAYLOAD, max_stock: PAYLOAD, categories: [{ name: PAYLOAD, path: PAYLOAD }] }],
  });
  await w.eval('loadProducts()');
  const body = w.document.getElementById('productsTableBody');
  assertInert(w, body);
  assert.equal(body.querySelector('img').getAttribute('alt'), PAYLOAD);
  const deletes = clickHandlers(w, body, ['openProductModal', 'deleteProduct']).filter((c) => c.name === 'deleteProduct');
  assert.deepEqual(deletes.map((c) => c.args), [[3, PAYLOAD]]);
});

test('admin: prévia da foto ao editar produto', async () => {
  const w = adminPage({
    '/api/admin/products': [{ id: 3, name: 'P', photo_path: BAD_URL, price: 1, categories: [] }],
    '/api/admin/categories': [],
  });
  await w.eval('openProductModal("edit", 3)');
  const preview = w.document.getElementById('productPhotoPreview');
  assertInert(w, preview, { expectText: false });
  assert.equal(preview.querySelector('img').getAttribute('src'), BAD_URL);
});

test('admin: movimentações de estoque', async () => {
  const w = adminPage({
    '/api/admin/stock/moves': [{ id: 4, product_name: PAYLOAD, quantity_change: PAYLOAD, reason: PAYLOAD, created_at: '2026-01-01' },
                               { id: 5, product_name: 'P', quantity_change: -1, reason: 'r', order_id: PAYLOAD }],
  });
  await w.eval('loadStockMoves()');
  const body = w.document.getElementById('stockMovesTableBody');
  assertInert(w, body);
  clickHandlers(w, body, ['revertStockMove']);
});

test('admin: usuários, permissões e perfis', async () => {
  const w = adminPage({
    '/api/admin/users': [{ id: 1, username: PAYLOAD, email: PAYLOAD, rules: [{ id: 1, name: PAYLOAD }] }],
    '/api/admin/permissions': [{ id: 1, name: PAYLOAD, description: PAYLOAD }],
    '/api/admin/rules': [{ id: 1, name: PAYLOAD, description: PAYLOAD, permissions: [{ id: 1, name: PAYLOAD }] }],
  });
  await w.eval('loadSettingsUsers()');
  await w.eval('loadSettingsPermissions()');
  await w.eval('loadSettingsProfiles()');
  for (const id of ['settingsUsersTableBody', 'settingsPermissionsTableBody', 'settingsProfilesTableBody']) {
    assertInert(w, w.document.getElementById(id));
  }
});

test('admin: mensagens de erro vindas da API nas tabelas e alertas', async () => {
  const failing = () => ({ status: 500, body: { error: PAYLOAD } });
  const w = adminPage({
    '/api/admin/orders': failing, '/api/admin/categories': failing, '/api/admin/products': failing,
    '/api/admin/stock/moves': failing, '/api/admin/clients': failing, '/api/admin/users': failing,
    '/api/admin/permissions': failing, '/api/admin/rules': failing,
  });
  for (const fn of ['loadOrders', 'loadCategories', 'loadProducts', 'loadStockMoves', 'loadClients',
                    'loadSettingsUsers', 'loadSettingsPermissions', 'loadSettingsProfiles']) {
    await w.eval(`${fn}()`);
  }
  for (const id of ['ordersTableBody', 'categoriesTableBody', 'productsTableBody', 'stockMovesTableBody', 'clientsTableBody',
                    'settingsUsersTableBody', 'settingsPermissionsTableBody', 'settingsProfilesTableBody', 'alertContainer']) {
    assertInert(w, w.document.getElementById(id));
  }
});

test('admin: importação de produtos (prévia e resultado)', async () => {
  const w = adminPage({ '/api/admin/products/import/commit': { created: PAYLOAD, updated: PAYLOAD, skipped: PAYLOAD } });
  w.eval(`importState.previewResult = ${JSON.stringify({
    summary: { total: PAYLOAD, to_create: PAYLOAD, to_update: PAYLOAD, invalid: PAYLOAD },
    rows: [
      { row: PAYLOAD, action: 'update', data: { name: PAYLOAD, barcode: PAYLOAD, price: 1, stock_quantity: PAYLOAD }, current: { price: 1, stock_quantity: PAYLOAD } },
      { row: 3, action: 'invalid', errors: [PAYLOAD], data: { name: PAYLOAD } },
    ],
  })};`);
  w.eval('renderImportPreview()');
  assertInert(w, w.document.getElementById('importSummaryCards'));
  assertInert(w, w.document.getElementById('importPreviewTableBody'));
  w.eval('loadProducts = async () => {};');
  await w.eval('commitImport()');
  assertInert(w, w.document.getElementById('importResultMessage'));
});

const CLIENT_SCRIPTS = ['common/app-helpers.js', 'common/module-search.js', 'client/client.js', 'client/meus-pedidos.js'];

function clientPage(routes) {
  const w = createPage(CLIENT_BODY, CLIENT_SCRIPTS, routes);
  w.eval(`clientPermissions = ['clients.products.view','clients.products.request','clients.cart.manage','clients.orders.view','clients.orders.cancel'];`);
  return w;
}

test('cliente: produtos, carrinho, pedidos e detalhes', async () => {
  const w = clientPage({
    '/api/client/products': [{ id: 1, name: PAYLOAD, photo_path: BAD_URL, price: 1, stock: 5, categories: [PAYLOAD] }],
    '/api/client/orders': [{ id: 1, status: PAYLOAD, total: 1, items: [{ product: PAYLOAD, quantity: 1 }] }],
    '/api/client/orders/1': { id: 1, client: PAYLOAD, status: PAYLOAD, reason: PAYLOAD, approved_at: '2026-01-01', approved_by_name: PAYLOAD,
                              items: [{ product: PAYLOAD, description: PAYLOAD, barcode: PAYLOAD, image_url: BAD_URL, quantity: 1, unit_price: 1 }] },
  });
  await w.eval('loadProducts()');
  assertInert(w, w.document.getElementById('clientProductsTableBody'));
  w.eval(`renderCartSummary(${JSON.stringify({ items: [{ id: 1, product_name: PAYLOAD, quantity: 1, stock: 5, unit_price: 1 }] })})`);
  assertInert(w, w.document.getElementById('clientCartItemsBody'));
  await w.eval('loadClientOrders()');
  assertInert(w, w.document.getElementById('clientOrdersTableBody'));
  await w.eval('openClientOrderDetailModal(1)');
  assertInert(w, w.document.getElementById('clientOrderDetailItemsBody'));
  assertInert(w, w.document.getElementById('clientOrderDetailAudit'));
  w.eval(`updateClientProfilePhotoPreview(${JSON.stringify(BAD_URL)})`);
  assertInert(w, w.document.getElementById('clientProfilePhotoPreview'), { expectText: false });
});

async function swalCallFor(cartsRoute) {
  const w = clientPage({
    '/api/client/products': [{ id: 1, name: PAYLOAD, price: 1, stock: 5, categories: [] }],
    '/api/client/carts': cartsRoute,
    '/api/client/carts/1/items': { id: 1, product_id: 1, quantity: 1 },
    '/api/client/summary': {},
  });
  await w.eval('loadProducts()');
  const calls = [];
  w.Swal = { fire: (...args) => { calls.push(args); return Promise.resolve({}); } };
  w.prompt = () => '1';
  await w.eval('adicionarRequisicao(1)');
  assert.equal(w[MARK], undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1, 'usar a forma com objeto, sem o atalho posicional que interpreta HTML');
  const options = calls[0][0];
  assert.equal(options.html, undefined);
  assert.ok(String(options.text).includes(PAYLOAD), 'o valor deve ir no campo text');
  return options;
}

test('cliente: SweetAlert (se carregado) recebe o nome do produto como texto', async () => {
  const options = await swalCallFor((init) => (init.method === 'POST'
    ? { status: 201, body: { id: 1, status: 'open', items: [] } }
    : { body: [] }));
  assert.equal(options.icon, 'success');
});

test('cliente: SweetAlert (se carregado) recebe o erro da API como texto', async () => {
  const options = await swalCallFor((init) => (init.method === 'POST'
    ? { status: 500, body: { error: PAYLOAD } }
    : { body: [] }));
  assert.equal(options.icon, 'error');
});

test('login: mensagem de erro da API exibida como texto', async () => {
  const w = createPage(AUTH_BODY, ['auth.js'], { '/api/login': () => ({ status: 401, body: { error: PAYLOAD } }) });
  await w.eval('login({ preventDefault() {} })');
  assertInert(w, w.document.getElementById('alertContainer'));
});

test('regressão: nomes legítimos com aspas, & e apóstrofo aparecem iguais e chegam intactos aos botões', async () => {
  const NAME = `Caneta "Bic" & D'Ávila <azul>`;
  const w = adminPage({
    '/api/admin/categories': [{ id: 1, name: NAME, description: NAME, parent_id: null }],
    '/api/admin/products': [{ id: 3, name: NAME, barcode: 'B-1', price: 2.5, stock: 4, min_stock: 1, max_stock: 9, categories: [{ name: NAME }] }],
    '/api/admin/clients': [{ id: 7, name: NAME, email: 'a@a', phone: '1', active: false }],
  });
  await w.eval('loadCategories()');
  await w.eval('loadProducts()');
  await w.eval('loadClients()');
  const categoryCells = w.document.querySelectorAll('#categoriesTableBody td');
  assert.equal(categoryCells[0].textContent, NAME);
  const productRow = w.document.querySelector('#productsTableBody tr');
  assert.equal(productRow.querySelectorAll('td')[0].textContent.trim(), NAME);
  assert.equal(productRow.querySelectorAll('td')[4].textContent, '4');
  w.document.querySelector('#clientsTableBody [onclick]').click();   // real openClientDeactivateModal
  assert.equal(w.document.getElementById('clientDeactivateName').textContent, NAME);
  assert.equal(w.document.getElementById('confirmDeactivateClientButton').dataset.nextActive, 'true');
  const calls = clickHandlers(w, w.document.getElementById('categoriesTableBody'), ['openCategoryModal', 'deleteCategory']);
  assert.deepEqual(calls.find((c) => c.name === 'deleteCategory').args, [1, NAME]);
  const productCalls = clickHandlers(w, w.document.getElementById('productsTableBody'), ['openProductModal', 'deleteProduct']);
  assert.deepEqual(productCalls.find((c) => c.name === 'deleteProduct').args, [3, NAME]);
});
