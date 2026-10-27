import { API_BASE_URL, API_TIMEOUT_MS, assertApiConfigured } from '../config/env.js';
import { ApiError } from './ApiError.js';
import { clearToken, getToken } from './tokenStorage.js';

function buildUrl(path, query) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function errorMessage(status, data) {
  if (data && typeof data === 'object' && typeof data.error === 'string') return data.error;
  if (status === 413) return 'Arquivo ou requisição maior que o limite permitido';
  return `Erro ${status} ao acessar a API`;
}

export async function request(path, { method = 'GET', body, query, auth, formData, headers = {}, timeoutMs = API_TIMEOUT_MS } = {}) {
  assertApiConfigured();
  const requestHeaders = { Accept: 'application/json', ...headers };

  if (auth) {
    const token = await getToken(auth);
    if (!token) {
      throw new ApiError('Sessão não encontrada. Faça login novamente.', { status: 401, code: 'missing_token' });
    }
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(buildUrl(path, query), { method, headers: requestHeaders, body: payload, signal: controller.signal });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    throw new ApiError(isTimeout ? 'Tempo de resposta da API esgotado' : 'Não foi possível conectar à API', {
      isNetworkError: !isTimeout,
      isTimeout,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await parseBody(response);
  if (!response.ok) {
    if (auth && response.status === 401) await clearToken(auth);
    throw new ApiError(errorMessage(response.status, data), {
      status: response.status,
      code: data && typeof data === 'object' ? data.code || null : null,
      data,
    });
  }
  return data;
}

export function fileFormData(file, field = 'file') {
  if (!file || !file.uri) throw new Error('Arquivo inválido: informe { uri, name, type }');
  const formData = new FormData();
  const name = file.name || file.uri.split('/').pop() || 'arquivo';
  formData.append(field, { uri: file.uri, name, type: file.type || 'application/octet-stream' });
  return formData;
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, file, options) => request(path, { ...options, method: 'POST', formData: fileFormData(file) }),
};
