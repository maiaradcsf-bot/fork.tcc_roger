import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ListItem, ListScreen, Pill } from '../../components/list.js';
import { Card, InfoRow, Loading } from '../../components/ui.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, spacing } from '../../theme/index.js';
import { formatDate, formatPrice, statusInfo } from '../../utils/format.js';

export default function ClientDetailScreen({ route }) {
  const { clientId } = route.params;
  const [expanded, setExpanded] = useState(null);
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.orders.getClientDetails(clientId));

  if (loading && !data) return <Loading message="Carregando solicitações..." />;
  const orders = data?.orders || [];
  const toggle = (order) => setExpanded((current) => (current === order.id ? null : order.id));

  return (
    <ListScreen
      data={orders}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhuma solicitação encontrada para este cliente."
      header={
        data ? (
          <>
            <Card>
              <Text style={styles.name}>{data.name || '—'}</Text>
              <InfoRow label="E-mail" value={data.email || '—'} />
              <InfoRow label="Telefone" value={data.phone || '—'} />
            </Card>
            <Text style={styles.section}>Solicitações do cliente ({orders.length})</Text>
          </>
        ) : null
      }
      renderItem={({ item: order }) => {
        const status = statusInfo(order.status);
        const open = expanded === order.id;
        return (
          <ListItem
            title={`Pedido #${order.id}`}
            meta={formatPrice(order.total)}
            details={[order.created_at ? formatDate(order.created_at) : 'Data indisponível', `${order.product_lines || 0} itens`, `${order.quantity || 0} un.`]}
            badge={<Pill label={status.label} background={status.background} color={status.text} />}
            onPress={() => toggle(order)}
            actions={[{ label: open ? 'Ocultar itens' : 'Ver itens', icon: open ? 'chevron-up' : 'list-outline', onPress: () => toggle(order) }]}
          >
            {open
              ? (order.items || []).map((item, index) => (
                  <View key={`${item.product_name}-${index}`} style={styles.item}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.product_name || '—'}
                    </Text>
                    <Text style={styles.itemValue}>
                      {item.quantity ?? 0} × {formatPrice(item.unit_price)} = {formatPrice(Number(item.unit_price || 0) * Number(item.quantity || 0))}
                    </Text>
                  </View>
                ))
              : null}
          </ListItem>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  item: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.xs, marginTop: spacing.xs },
  itemName: { fontSize: 13, color: colors.text, fontWeight: '600' },
  itemValue: { fontSize: 12, color: colors.muted },
});
