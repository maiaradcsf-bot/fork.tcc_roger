import { http } from '../../api/httpClient.js';
import { ROLES } from '../../api/tokenStorage.js';

const auth = ROLES.ADMIN;

export const ORDER_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  FINISH: 'finish',
  CANCEL: 'cancel',
});

export function listOrders() {
  return http.get('/admin/orders', { auth });
}

export function getOrder(orderId) {
  return http.get(`/admin/orders/${orderId}`, { auth });
}

export function updateOrderStatus(orderId, action, { allowPartial = false } = {}) {
  const body = allowPartial ? { action, allow_partial: true } : { action };
  return http.patch(`/admin/orders/${orderId}/status`, body, { auth });
}

export function approveOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_ACTIONS.APPROVE);
}

export function rejectOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_ACTIONS.REJECT);
}

export function finishOrder(orderId, { allowPartial = false } = {}) {
  return updateOrderStatus(orderId, ORDER_ACTIONS.FINISH, { allowPartial });
}

export function cancelOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_ACTIONS.CANCEL);
}

export function listClients() {
  return http.get('/admin/clients', { auth });
}

export function getClientsSummary() {
  return http.get('/admin/clients/summary', { auth });
}

export function getClientDetails(clientId) {
  return http.get(`/admin/clients/${clientId}/details`, { auth });
}

export function setClientActive(clientId, active) {
  return http.patch(`/admin/clients/${clientId}/status`, { active: Boolean(active) }, { auth });
}
