import { http } from '../../api/httpClient.js';
import { ROLES } from '../../api/tokenStorage.js';

const auth = ROLES.ADMIN;

export function listUsers() {
  return http.get('/admin/users', { auth });
}

export function createUser({ username, email, password, ruleIds = [] }) {
  return http.post('/admin/users', { username, email, password, rule_ids: ruleIds }, { auth });
}

export function updateUser(userId, { username, email, password, ruleIds } = {}) {
  const body = {};
  if (username !== undefined) body.username = username;
  if (email !== undefined) body.email = email;
  if (password) body.password = password;
  if (ruleIds !== undefined) body.rule_ids = ruleIds;
  return http.put(`/admin/users/${userId}`, body, { auth });
}

export function deleteUser(userId) {
  return http.delete(`/admin/users/${userId}`, { auth });
}

export function listRules() {
  return http.get('/admin/rules', { auth });
}

export function createRule({ name, description, permissionIds = [] }) {
  return http.post('/admin/rules', { name, description, permission_ids: permissionIds }, { auth });
}

export function updateRule(ruleId, { name, description, permissionIds } = {}) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (permissionIds !== undefined) body.permission_ids = permissionIds;
  return http.put(`/admin/rules/${ruleId}`, body, { auth });
}

export function deleteRule(ruleId) {
  return http.delete(`/admin/rules/${ruleId}`, { auth });
}

export function listPermissions() {
  return http.get('/admin/permissions', { auth });
}

export function createPermission({ name, description }) {
  return http.post('/admin/permissions', { name, description }, { auth });
}

export function updatePermission(permissionId, { name, description } = {}) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  return http.put(`/admin/permissions/${permissionId}`, body, { auth });
}

export function deletePermission(permissionId) {
  return http.delete(`/admin/permissions/${permissionId}`, { auth });
}
