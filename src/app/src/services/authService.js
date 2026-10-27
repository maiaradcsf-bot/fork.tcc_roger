import { http } from '../api/httpClient.js';
import { ROLES, clearToken, getToken, setToken } from '../api/tokenStorage.js';

export async function login(email, password) {
  const data = await http.post('/login', { email, password });
  const role = data.role === 'client' ? ROLES.CLIENT : ROLES.ADMIN;
  await setToken(role, data.token);
  return { token: data.token, role };
}

export async function adminLogin(username, password) {
  const data = await http.post('/admin/login', { username, password });
  await setToken(ROLES.ADMIN, data.token);
  return data;
}

export async function adminLogout() {
  try {
    if (await getToken(ROLES.ADMIN)) await http.post('/admin/logout', undefined, { auth: ROLES.ADMIN });
  } finally {
    await clearToken(ROLES.ADMIN);
  }
}

export async function registerClient({ name, email, password, phone }) {
  const data = await http.post('/client/register', { name, email, password, phone });
  await setToken(ROLES.CLIENT, data.token);
  return data;
}

export async function clientLogin(email, password) {
  const data = await http.post('/client/login', { email, password });
  await setToken(ROLES.CLIENT, data.token);
  return data;
}

export async function clientLogout() {
  try {
    if (await getToken(ROLES.CLIENT)) await http.post('/client/logout', undefined, { auth: ROLES.CLIENT });
  } finally {
    await clearToken(ROLES.CLIENT);
  }
}
