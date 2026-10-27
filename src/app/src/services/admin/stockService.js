import { http } from '../../api/httpClient.js';
import { ROLES } from '../../api/tokenStorage.js';

const auth = ROLES.ADMIN;

export function listStock() {
  return http.get('/admin/stock', { auth });
}

export function createStock(productId, quantity = 0) {
  return http.post('/admin/stock', { product_id: productId, quantity }, { auth });
}

export function deleteAllStock() {
  return http.delete('/admin/stock', { auth });
}

export function listStockMoves({ startDate, endDate, productId } = {}) {
  return http.get('/admin/stock/moves', {
    auth,
    query: { start_date: startDate, end_date: endDate, product_id: productId },
  });
}

export function createStockMove({ stockId, productId, quantityChange, reason } = {}) {
  return http.post(
    '/admin/stock/moves',
    { stock_id: stockId, product_id: productId, quantity_change: quantityChange, reason },
    { auth },
  );
}

export function registerEntry({ stockId, productId, quantity, reason }) {
  return createStockMove({ stockId, productId, quantityChange: Math.abs(quantity), reason });
}

export function registerExit({ stockId, productId, quantity, reason }) {
  return createStockMove({ stockId, productId, quantityChange: -Math.abs(quantity), reason });
}

export function revertStockMove(moveId, reason) {
  return http.post(`/admin/stock/moves/${moveId}/revert`, reason ? { reason } : undefined, { auth });
}
