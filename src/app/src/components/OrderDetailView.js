import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme/index.js';
import { formatDate, formatPrice, orderTotal, statusInfo } from '../utils/format.js';
import { Badge, Card, InfoRow, Muted, ProductImage } from './ui.js';

function auditEntries(order) {
  const entries = [];
  if (order.approved_at) entries.push({ label: 'Aprovado em', date: order.approved_at, by: order.approved_by_name });
  if (order.refused_at) entries.push({ label: 'Rejeitado em', date: order.refused_at, by: order.refused_by_name });
  if (order.finished_at) entries.push({ label: 'Retirado em', date: order.finished_at, by: order.finished_by_name });
  if (order.canceled_at) entries.push({ label: 'Cancelado em', date: order.canceled_at, by: order.canceled_by_name || order.canceled_by_client_name });
  return entries;
}

export function OrderDetailView({ order, audience = 'admin' }) {
  const status = statusInfo(order.status, audience);
  const reason = order.reason ? String(order.reason).trim() : '';
  const entries = auditEntries(order);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <View style={styles.wrapper}>
      <Card>
        <InfoRow label="Cliente" value={order.client || order.client_name || '—'} />
        <InfoRow label="Status">
          <Badge label={status.label} background={status.background} color={status.text} />
        </InfoRow>
        <InfoRow label="Total" value={formatPrice(orderTotal(order))} />
        <InfoRow label="Solicitado em" value={formatDate(order.created_at)} />
        {reason ? <InfoRow label="Motivo" value={reason} /> : null}
      </Card>
      <Card>
        <Text style={styles.section}>Histórico</Text>
        {entries.length ? (
          entries.map((entry) => (
            <Text key={entry.label} style={styles.audit}>
              <Text style={styles.auditLabel}>{entry.label}: </Text>
              {formatDate(entry.date)}
              {entry.by ? <Text style={styles.auditBy}> por {entry.by}</Text> : null}
            </Text>
          ))
        ) : (
          <Muted>Nenhuma ação adicional registrada.</Muted>
        )}
      </Card>
      <Text style={styles.section}>Itens</Text>
      {items.length ? (
        items.map((item, index) => {
          const name = item.product || item.product_name || '—';
          const unit = Number(item.unit_price || 0);
          return (
            <Card key={`${name}-${index}`}>
              <View style={styles.itemHeader}>
                <ProductImage path={item.image_url} size={56} />
                <View style={styles.itemTitle}>
                  <Text style={styles.itemName}>{name}</Text>
                  <Muted>{item.description || '—'}</Muted>
                </View>
              </View>
              <InfoRow label="Código de Barras" value={item.barcode || item.product_barcode || '—'} />
              <View style={styles.itemNumbers}>
                <InfoRow label="Quantidade" value={String(item.quantity ?? '—')} />
                <InfoRow label="Valor unitário" value={formatPrice(unit)} />
                <InfoRow label="Subtotal" value={formatPrice(unit * Number(item.quantity || 0))} />
              </View>
            </Card>
          );
        })
      ) : (
        <Card>
          <Muted>Nenhum produto encontrado.</Muted>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  audit: { fontSize: 14, color: colors.text },
  auditLabel: { fontWeight: '700' },
  auditBy: { color: colors.muted },
  itemHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  itemTitle: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemNumbers: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md },
});
