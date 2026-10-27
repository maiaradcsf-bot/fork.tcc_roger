import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Button, Loading } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { ORDER_ACTIONS, api } from '../../services/index.js';
import { formatDate, formatPrice, matchesSearch, normalizeStatus, orderTotal, statusInfo } from '../../utils/format.js';

const CONFIRM_TEXT = {
  approve: { text: 'aprovar', button: 'Confirmar' },
  reject: { text: 'rejeitar', button: 'Confirmar' },
  cancel: { text: 'cancelar', button: 'Confirmar' },
  finish: { text: 'marcar como retirado', button: 'Retirado' },
};

export function useOrderActions(onDone) {
  const { handleError } = useAuth();
  const { busy, run } = useAction();

  async function execute(orderId, action) {
    try {
      await api.admin.orders.updateOrderStatus(orderId, action);
    } catch (error) {
      const shortages = error?.code === 'insufficient_stock' ? error.data?.shortages : null;
      if (!shortages?.length) throw error;
      const lines = shortages.map((item) => `• ${item.product_name}: solicitado ${item.requested}, disponível ${item.available}`).join('\n');
      const accepted = await new Promise((resolve) =>
        Alert.alert(
          'Estoque insuficiente',
          `Estoque insuficiente para o pedido #${orderId}:\n\n${lines}\n\nDeseja concluir a retirada entregando apenas a quantidade disponível?`,
          [
            { text: 'Não', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Entregar disponível', onPress: () => resolve(true) },
          ],
        ),
      );
      if (!accepted) {
        Alert.alert('Atenção', `Retirada do pedido ${orderId} não concluída por falta de estoque.`);
        return false;
      }
      await api.admin.orders.updateOrderStatus(orderId, action, { allowPartial: true });
    }
    return true;
  }

  function confirmAction(orderId, action, restoresStock = false) {
    const config = CONFIRM_TEXT[action];
    const message = restoresStock
      ? 'Tem certeza que deseja cancelar esta solicitação já retirada? A quantidade baixada será devolvida ao estoque automaticamente.'
      : `Tem certeza que deseja ${config.text} esta solicitação?`;
    Alert.alert('Confirmar ação', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: restoresStock ? 'Devolver ao estoque' : config.button,
        style: action === 'approve' || action === 'finish' ? 'default' : 'destructive',
        onPress: () =>
          run(async () => {
            if (await execute(orderId, action)) {
              Alert.alert('Sucesso', 'Status da solicitação atualizado.');
              await onDone?.();
            }
          }).catch(handleError),
      },
    ]);
  }

  return { busy, confirmAction };
}

const ACTION_STYLE = {
  approve: { label: 'Aprovar', icon: 'checkmark-circle-outline', variant: 'success', color: '#198754' },
  reject: { label: 'Rejeitar', icon: 'close-circle-outline', variant: 'danger', destructive: true },
  finish: { label: 'Marcar como retirado', icon: 'bag-check-outline', variant: 'primary', color: '#0d6efd' },
  cancel: { label: 'Cancelar', icon: 'ban-outline', variant: 'outlineDanger', destructive: true },
  restore: { label: 'Devolver ao estoque', icon: 'return-up-back-outline', variant: 'outlineWarning', color: '#997404' },
};

export function orderActions(order, hasPermission, confirmAction) {
  const status = normalizeStatus(order.status);
  const actions = [];
  const add = (key, action, permission, restores = false) => {
    if (hasPermission(permission)) actions.push({ key, ...ACTION_STYLE[key], onPress: () => confirmAction(order.id, action, restores) });
  };
  if (status === 'pending') {
    add('approve', ORDER_ACTIONS.APPROVE, 'admin.orders.approve');
    add('reject', ORDER_ACTIONS.REJECT, 'admin.orders.reject');
    add('cancel', ORDER_ACTIONS.CANCEL, 'admin.orders.cancel');
  }
  if (status === 'approved') {
    add('finish', ORDER_ACTIONS.FINISH, 'admin.orders.approve');
    add('cancel', ORDER_ACTIONS.CANCEL, 'admin.orders.cancel');
  }
  if (status === 'finished') add('restore', ORDER_ACTIONS.CANCEL, 'admin.orders.cancel', true);
  return actions;
}

export function orderActionButtons(order, hasPermission, confirmAction, small = true) {
  return orderActions(order, hasPermission, confirmAction).map((action) => (
    <Button key={action.key} title={action.key === 'finish' ? 'Retirado' : action.label} icon={action.icon} variant={action.variant} small={small} onPress={action.onPress} />
  ));
}

export default function OrdersScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.orders.listOrders());
  const { confirmAction } = useOrderActions(reload);

  if (loading && !data) return <Loading message="Carregando pedidos..." />;
  const orders = (data || []).filter((order) => matchesSearch(term, order.client, order.product_summary, order.status, order.id));

  const openDetail = (order) => navigation.navigate('OrderDetail', { orderId: order.id });

  return (
    <ListScreen
      data={orders}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhuma solicitação encontrada."
      header={<ListToolbar search={term} onSearch={setTerm} placeholder="Cliente, produto ou status" count={orders.length} />}
      renderItem={({ item: order }) => {
        const status = statusInfo(order.status);
        return (
          <ListItem
            title={`#${order.id} · ${order.client || '—'}`}
            meta={formatPrice(orderTotal(order))}
            subtitle={order.product_summary || '—'}
            details={[`${order.quantity_total ?? 0} un.`, formatDate(order.created_at)]}
            badge={<Pill label={status.label} background={status.background} color={status.text} />}
            onPress={() => openDetail(order)}
            actionsTitle={`Solicitação #${order.id}`}
            actions={[{ label: 'Ver detalhes', icon: 'eye-outline', onPress: () => openDetail(order) }, ...orderActions(order, hasPermission, confirmAction)]}
          />
        );
      }}
    />
  );
}
