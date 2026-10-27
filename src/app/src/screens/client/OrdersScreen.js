import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { formatDate, formatPrice, matchesSearch, normalizeStatus, orderQuantity, statusInfo } from '../../utils/format.js';

const productNames = (order) => (order.items || []).map((item) => item.product || item.product_name).filter(Boolean).join(', ') || '—';

export default function ClientOrdersScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.client.listOrders());

  if (loading && !data) return <Loading message="Carregando solicitações..." />;
  const orders = (data || []).filter((order) => matchesSearch(term, productNames(order), statusInfo(order.status, 'client').label, order.id));

  function confirmCancel(order) {
    Alert.alert('Cancelar solicitação', 'Deseja cancelar esta solicitação?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar solicitação',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await api.client.cancelOrder(order.id);
            Alert.alert('Sucesso', 'Solicitação atualizada.');
            await reload();
          }),
      },
    ]);
  }

  const canView = hasPermission('clients.orders.view');
  const openDetail = (order) => navigation.navigate('ClientOrderDetail', { orderId: order.id });

  return (
    <ListScreen
      data={orders}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhuma solicitação encontrada."
      header={<ListToolbar search={term} onSearch={setTerm} placeholder="Produto ou status" count={orders.length} />}
      renderItem={({ item: order }) => {
        const status = statusInfo(order.status, 'client');
        const canCancel = normalizeStatus(order.status) === 'pending' && hasPermission('clients.orders.cancel');
        return (
          <ListItem
            title={`Solicitação #${order.id}`}
            meta={formatPrice(order.total)}
            subtitle={productNames(order)}
            details={[`${orderQuantity(order)} un.`, formatDate(order.created_at)]}
            badge={<Pill label={status.label} background={status.background} color={status.text} />}
            onPress={canView ? () => openDetail(order) : undefined}
            actions={[
              canView && { label: 'Ver detalhes', icon: 'eye-outline', onPress: () => openDetail(order) },
              canCancel && { label: 'Cancelar solicitação', icon: 'ban-outline', destructive: true, onPress: () => confirmCancel(order) },
            ]}
          />
        );
      }}
    />
  );
}
