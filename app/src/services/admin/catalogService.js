import { http } from '../../api/httpClient.js';
import { ROLES } from '../../api/tokenStorage.js';

const auth = ROLES.ADMIN;

export function getMe() {
  return http.get('/admin/me', { auth });
}

export function listProducts() {
  return http.get('/admin/products', { auth });
}

export function getProduct(productId) {
  return http.get(`/admin/products/${productId}`, { auth });
}

export function createProduct(product) {
  return http.post('/admin/products', product, { auth });
}

export function updateProduct(productId, changes) {
  return http.put(`/admin/products/${productId}`, changes, { auth });
}

export function deleteProduct(productId) {
  return http.delete(`/admin/products/${productId}`, { auth });
}

export function deleteAllProducts() {
  return http.delete('/admin/products/delete-all', { auth });
}

export function uploadProductImage(file) {
  return http.upload('/admin/upload', file, { auth });
}

export function uploadImportFile(file) {
  return http.upload('/admin/products/import/upload', file, { auth });
}

export function previewImport(importId, mapping) {
  return http.post('/admin/products/import/preview', { import_id: importId, mapping }, { auth });
}

export function commitImport(importId, mapping) {
  return http.post('/admin/products/import/commit', { import_id: importId, mapping }, { auth });
}

export function cancelImport(importId) {
  return http.delete(`/admin/products/import/${encodeURIComponent(importId)}`, { auth });
}

export function listCategories() {
  return http.get('/admin/categories', { auth });
}

export function createCategory(category) {
  return http.post('/admin/categories', category, { auth });
}

export function updateCategory(categoryId, changes) {
  return http.put(`/admin/categories/${categoryId}`, changes, { auth });
}

export function deleteCategory(categoryId) {
  return http.delete(`/admin/categories/${categoryId}`, { auth });
}
