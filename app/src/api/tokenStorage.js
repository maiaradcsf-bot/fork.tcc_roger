import * as SecureStore from 'expo-secure-store';

export const ROLES = Object.freeze({ ADMIN: 'admin', CLIENT: 'client' });

const KEYS = {
  [ROLES.ADMIN]: 'almoxarifado.admin_token',
  [ROLES.CLIENT]: 'almoxarifado.client_token',
};

function keyFor(role) {
  const key = KEYS[role];
  if (!key) throw new Error(`Perfil de sessão inválido: ${role}`);
  return key;
}

export async function getToken(role) {
  return SecureStore.getItemAsync(keyFor(role));
}

export async function setToken(role, token) {
  if (!token) return clearToken(role);
  return SecureStore.setItemAsync(keyFor(role), token);
}

export async function clearToken(role) {
  return SecureStore.deleteItemAsync(keyFor(role));
}

export async function clearAllTokens() {
  await Promise.all(Object.values(ROLES).map((role) => clearToken(role)));
}

export async function hasToken(role) {
  return Boolean(await getToken(role));
}
