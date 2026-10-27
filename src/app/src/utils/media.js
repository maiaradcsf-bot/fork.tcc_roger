import { API_HOST } from '../config/env.js';

export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:|file:|data:|content:)/i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? path : `/${path}`}`;
}

export function pickedFile(asset, fallbackName, fallbackType) {
  return {
    uri: asset.uri,
    name: asset.fileName || asset.name || fallbackName,
    type: asset.mimeType || fallbackType,
  };
}
