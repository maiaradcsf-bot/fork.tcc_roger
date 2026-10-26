// Runs the real order/stock action handlers from admin.js against mocked API responses.
// Run with: node --test src/tests/frontend/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ADMIN_JS = new URL('../../app/static/js/admin/admin.js', import.meta.url);
const source = readFileSync(ADMIN_JS, 'utf8');

// Returns the function starting at `marker`, up to the brace closing its body
// (the body starts at the first ") {", so default values like `init = {}` are skipped)
function extract(marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `trecho não encontrado em admin.js: ${marker}`);
  let depth = 0;
  for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`chave de fechamento não encontrada: ${marker}`);
}

const handlers = [
  extract('async function fetchJson('),
  extract('function updateOrderStatus('),
  extract('function confirmPartialWithdrawal('),
  extract('window.handleAdminOrderAction = async function'),
  extract('async function saveStockMove('),
].join(';\n\n');

function setup(responses, { confirm = true, form = {} } = {}) {
  const calls = [];
  const alerts = [];
  const confirms = [];
  const queue = [...responses];
  const elements = {
    stockMoveForm: {},
    stockItemSelect: { value: form.stockId ?? '7' },
    stockMoveType: { value: form.type ?? 'saida' },
    stockQuantityChange: { value: form.quantity ?? '3' },
    stockReason: { value: 'teste' },
    stockMoveModal: {},
  };
  const context = {
    API_BASE_URL: '/api/admin',
    stockMovesTableBody: null,
    window: { confirm: (msg) => { confirms.push(msg); return confirm; } },
    document: { querySelector: () => ({}) },
    bootstrap: { Modal: { getInstance: () => ({ hide() {} }) } },
    getAuthToken: () => 'token',
    buildAuthHeader: () => ({ Authorization: 'Bearer token' }),
    handleLogout: () => {},
    setTimeout: () => {},
    showAlert: (type, message) => alerts.push({ type, message }),
    setLoadingState: () => {},
    loadOrders: async () => {},
    loadDashboardSummary: async () => {},
    loadStockMoves: async () => {},
    loadProducts: async () => {},
    $id: (id) => elements[id],
    fetch: async (url, init) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
      const next = queue.shift();
      assert.ok(next, `requisição inesperada para ${url}`);
      return { ok: next.status < 400, status: next.status, json: async () => next.body };
    },
  };
  vm.createContext(context);
  vm.runInContext(handlers, context);
  return { context, calls, alerts, confirms };
}

const ok = (body = {}) => ({ status: 200, body });
const conflict = (body) => ({ status: 409, body });

test('aprovação recusada por estoque comprometido mostra o erro sem pedir entrega parcial', async () => {
  const t = setup([conflict({ error: 'Estoque livre insuficiente para aprovar o pedido', code: 'insufficient_committed_stock', shortages: [{ product_name: 'A', requested: 5, available: 5 }] })]);
  await t.context.window.handleAdminOrderAction(1, 'approve', {});
  assert.equal(t.calls.length, 1);
  assert.deepEqual(t.calls[0].body, { action: 'approve' });
  assert.equal(t.confirms.length, 0);
  assert.deepEqual(t.alerts, [{ type: 'danger', message: 'Falha ao atualizar pedido 1: Estoque livre insuficiente para aprovar o pedido' }]);
});

test('retirada com falta de estoque confirma e reenvia com allow_partial true', async () => {
  const t = setup([
    conflict({ error: 'Estoque insuficiente para concluir a retirada', code: 'insufficient_stock', shortages: [{ product_name: 'A', requested: 5, available: 2 }] }),
    ok({ id: 1, status: 'finished', partial: true }),
  ]);
  await t.context.window.handleAdminOrderAction(1, 'finish', {});
  assert.deepEqual(t.calls.map((c) => c.body), [{ action: 'finish' }, { action: 'finish', allow_partial: true }]);
  assert.match(t.confirms[0], /A: solicitado 5, disponível 2/);
  assert.deepEqual(t.alerts.map((a) => a.type), ['success']);
});

test('retirada parcial recusada pelo usuário não reenvia', async () => {
  const t = setup([conflict({ error: 'Estoque insuficiente', code: 'insufficient_stock', shortages: [{ product_name: 'A', requested: 5, available: 2 }] })], { confirm: false });
  await t.context.window.handleAdminOrderAction(1, 'finish', {});
  assert.equal(t.calls.length, 1);
  assert.deepEqual(t.alerts.map((a) => a.type), ['warning']);
});

test('entrega parcial sem nenhum item disponível mostra o erro do backend', async () => {
  const t = setup([
    conflict({ error: 'Estoque insuficiente', code: 'insufficient_stock', shortages: [{ product_name: 'A', requested: 2, available: 0 }] }),
    conflict({ error: 'Nenhum item do pedido tem estoque disponível para retirada', code: 'no_stock_available', shortages: [] }),
  ]);
  await t.context.window.handleAdminOrderAction(1, 'finish', {});
  assert.equal(t.calls.length, 2);
  assert.deepEqual(t.alerts, [{ type: 'danger', message: 'Falha ao atualizar pedido 1: Nenhum item do pedido tem estoque disponível para retirada' }]);
});

test('conflito de concorrência mostra "tente novamente" e não confunde com falta de estoque', async () => {
  const t = setup([conflict({ error: 'Outra operação alterou estes dados ao mesmo tempo. Tente novamente.', code: 'concurrent_update' })]);
  await t.context.window.handleAdminOrderAction(1, 'finish', {});
  assert.equal(t.calls.length, 1);
  assert.equal(t.confirms.length, 0);
  assert.equal(t.alerts[0].type, 'danger');
  assert.match(t.alerts[0].message, /Tente novamente/);
});

test('saldo inconsistente é exibido como erro', async () => {
  const t = setup([conflict({ error: 'Saldo de estoque inconsistente para A (-2). Corrija o estoque antes de continuar.', code: 'inconsistent_stock' })]);
  await t.context.window.handleAdminOrderAction(1, 'finish', {});
  assert.match(t.alerts[0].message, /Saldo de estoque inconsistente/);
});

test('saída manual maior que o saldo mostra o 409 do backend', async () => {
  const t = setup([conflict({ error: 'Estoque insuficiente para esta saída (disponível: 1).', code: 'insufficient_stock', available: 1 })]);
  await t.context.saveStockMove({ preventDefault() {}, submitter: {} });
  assert.deepEqual(t.calls[0].body, { stock_id: '7', quantity_change: -3, reason: 'teste' });
  assert.deepEqual(t.alerts, [{ type: 'danger', message: 'Erro ao salvar movimentação: Estoque insuficiente para esta saída (disponível: 1).' }]);
});

test('saída manual válida mostra sucesso', async () => {
  const t = setup([{ status: 201, body: { id: 10 } }]);
  await t.context.saveStockMove({ preventDefault() {}, submitter: {} });
  assert.deepEqual(t.alerts.map((a) => a.type), ['success']);
});
