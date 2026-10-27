const DEFAULT_TIMEOUT_MS = 15000;

function normalizeHost(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

function parseTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export const API_HOST = normalizeHost(process.env.EXPO_PUBLIC_API_HOST);
export const API_BASE_URL = API_HOST ? `${API_HOST}/api` : '';
export const API_TIMEOUT_MS = parseTimeout(process.env.EXPO_PUBLIC_API_TIMEOUT_MS);

export function assertApiConfigured() {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_HOST não configurado. Defina o host da API no arquivo .env.local');
  }
}
