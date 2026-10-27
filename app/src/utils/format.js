import { colors } from '../theme/index.js';

export const ORDER_STATUS_GROUPS = {
  pending: ['pending', 'initial', 'inicial', 'pendent', 'pendente'],
  approved: ['approved', 'aprovado'],
  finished: ['finished', 'completed', 'concluido', 'concluído', 'retirado', 'picked_up', 'withdrawn', 'checked_out'],
  rejected: ['rejected', 'rejeitado', 'rejeitada'],
  cancelled: ['cancelled', 'cancelado', 'canceled'],
};

export function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  return Object.keys(ORDER_STATUS_GROUPS).find((group) => ORDER_STATUS_GROUPS[group].includes(value)) || value;
}

const ADMIN_LABELS = {
  pending: 'Pendente (aguardando aprovação)',
  approved: 'Aprovado (aguardando retirada)',
  finished: 'Retirado',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

const CLIENT_LABELS = { ...ADMIN_LABELS, pending: 'Aguardando aprovação' };

const STATUS_COLORS = {
  pending: { background: colors.warning, text: colors.text },
  approved: { background: colors.info, text: colors.text },
  finished: { background: colors.primary, text: colors.white },
  rejected: { background: colors.danger, text: colors.white },
  cancelled: { background: colors.secondary, text: colors.white },
};

export function statusInfo(status, audience = 'admin') {
  const key = normalizeStatus(status);
  const labels = audience === 'client' ? CLIENT_LABELS : ADMIN_LABELS;
  const fallback = String(status || 'Desconhecido').replace(/_/g, ' ');
  return { key, label: labels[key] || fallback, ...(STATUS_COLORS[key] || STATUS_COLORS.cancelled) };
}

export function formatPrice(value) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shortDateLabel(dateKey) {
  const [, month, day] = dateKey.split('-');
  return `${day}/${month}`;
}

export function isoDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function orderTotal(order) {
  const total = Number(order?.total || 0);
  if (total) return total;
  return (order?.items || []).reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
}

export function orderQuantity(order) {
  if (Number.isFinite(Number(order?.quantity_total))) return Number(order.quantity_total);
  return (order?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

export function matchesSearch(term, ...values) {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value ?? '').toLowerCase().includes(needle));
}
