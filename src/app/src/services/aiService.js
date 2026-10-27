import { http } from '../api/httpClient.js';
import { ROLES } from '../api/tokenStorage.js';

const AI_TIMEOUT_MS = 60000;

function base(role) {
  return role === ROLES.ADMIN ? '/admin/ai' : '/client/ai';
}

export function getStatus(role) {
  return http.get(`${base(role)}/status`, { auth: role });
}

export function chat(role, messages) {
  return http.post(`${base(role)}/chat`, { messages }, { auth: role, timeoutMs: AI_TIMEOUT_MS });
}

export function suggestReason({ cartId, context } = {}) {
  const body = {};
  if (cartId) body.cart_id = cartId;
  if (context) body.context = context;
  return http.post('/client/ai/reason', body, { auth: ROLES.CLIENT, timeoutMs: AI_TIMEOUT_MS });
}
