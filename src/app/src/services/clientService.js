import { http } from '../api/httpClient.js';
import { ROLES } from '../api/tokenStorage.js';

const auth = ROLES.CLIENT;

export function getMe() {
  return http.get('/client/me', { auth });
}

export function getProfile() {
  return http.get('/client/profile', { auth });
}

export function updateProfile({ name, email, phone, photoPath, password, currentPassword } = {}) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (email !== undefined) body.email = email;
  if (phone !== undefined) body.phone = phone;
  if (photoPath !== undefined) body.photo_path = photoPath;
  if (password) {
    body.password = password;
    body.current_password = currentPassword;
  }
  return http.put('/client/profile', body, { auth });
}

export function uploadProfilePhoto(file) {
  return http.upload('/client/upload', file, { auth });
}

export function getSummary() {
  return http.get('/client/summary', { auth });
}

export function listProducts() {
  return http.get('/client/products', { auth });
}

export function getProduct(productId) {
  return http.get(`/client/products/${productId}`, { auth });
}

export function listCarts() {
  return http.get('/client/carts', { auth });
}

export function createCart() {
  return http.post('/client/carts', undefined, { auth });
}

export async function getOpenCart() {
  const carts = await listCarts();
  return (Array.isArray(carts) ? carts : []).find((cart) => cart.status === 'open') || null;
}

export async function getOrCreateOpenCart() {
  return (await getOpenCart()) || createCart();
}

export function addCartItem(cartId, productId, quantity = 1) {
  return http.post(`/client/carts/${cartId}/items`, { product_id: productId, quantity }, { auth });
}

export function updateCartItem(cartId, itemId, quantity) {
  return http.put(`/client/carts/${cartId}/items/${itemId}`, { quantity }, { auth });
}

export function removeCartItem(cartId, itemId) {
  return http.delete(`/client/carts/${cartId}/items/${itemId}`, { auth });
}

export function checkoutCart(cartId, reason) {
  return http.post(`/client/carts/${cartId}/checkout`, reason ? { reason } : {}, { auth });
}

export function listOrders() {
  return http.get('/client/orders', { auth });
}

export function getOrder(orderId) {
  return http.get(`/client/orders/${orderId}`, { auth });
}

export function createOrder(items) {
  const payload = items.map(({ productId, product_id: snakeId, quantity }) => ({
    product_id: productId ?? snakeId,
    quantity,
  }));
  return http.post('/client/orders', { items: payload }, { auth });
}

export function cancelOrder(orderId) {
  return http.patch(`/client/orders/${orderId}/status`, { action: 'cancel' }, { auth });
}
