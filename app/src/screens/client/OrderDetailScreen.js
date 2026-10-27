import { OrderDetailView } from '../../components/OrderDetailView.js';
import { ErrorCard, Loading, Screen } from '../../components/ui.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';

export default function ClientOrderDetailScreen({ route }) {
  const { orderId } = route.params;
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.client.getOrder(orderId));

  if (loading && !data) return <Loading message="Carregando detalhes..." />;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorCard error={error} onRetry={reload} />
      {data ? <OrderDetailView order={data} audience="client" /> : null}
    </Screen>
  );
}
