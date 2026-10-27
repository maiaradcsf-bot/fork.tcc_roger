import { OrderDetailView } from '../../components/OrderDetailView.js';
import { ButtonRow, ErrorCard, Loading, Screen } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { orderActionButtons, useOrderActions } from './OrdersScreen.js';

export default function OrderDetailScreen({ route }) {
  const { orderId } = route.params;
  const { hasPermission } = useAuth();
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.orders.getOrder(orderId));
  const { confirmAction } = useOrderActions(reload);

  if (loading && !data) return <Loading message="Carregando detalhes..." />;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorCard error={error} onRetry={reload} />
      {data ? (
        <>
          <ButtonRow>{orderActionButtons(data, hasPermission, confirmAction, false)}</ButtonRow>
          <OrderDetailView order={data} audience="admin" />
        </>
      ) : null}
    </Screen>
  );
}
