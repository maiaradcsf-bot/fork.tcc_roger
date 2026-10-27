import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ButtonRow, Card, Loading, Muted, Screen, StatCard, Title } from '../../components/ui.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, spacing } from '../../theme/index.js';
import { formatPrice, orderQuantity, shortDateLabel, toDateKey } from '../../utils/format.js';

const RANGES = [7, 15, 30, 60];
const CHART_HEIGHT = 160;
const safe = (promise) => promise.catch(() => null);

async function loadDashboard() {
  const [summary, orders] = await Promise.all([safe(api.client.getSummary()), safe(api.client.listOrders())]);
  return { summary, orders: Array.isArray(orders) ? orders : [] };
}

function buildSeries(orders, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - days + 1);
  const buckets = [];
  const byKey = new Map();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const bucket = { key: toDateKey(date), orders: 0, items: 0 };
    buckets.push(bucket);
    byKey.set(bucket.key, bucket);
  }
  orders.forEach((order) => {
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) return;
    created.setHours(0, 0, 0, 0);
    const bucket = byKey.get(toDateKey(created));
    if (!bucket) return;
    bucket.orders += 1;
    bucket.items += orderQuantity(order);
  });
  return buckets;
}

function OrdersChart({ series, days }) {
  const max = Math.max(1, ...series.map((item) => item.orders));
  const labelEvery = days <= 15 ? 1 : Math.ceil(days / 8);
  return (
    <View>
      <View style={styles.chart}>
        {series.map((item, index) => (
          <View key={item.key} style={styles.barSlot}>
            <View style={[styles.bar, { height: Math.max(2, (item.orders / max) * CHART_HEIGHT), backgroundColor: item.orders ? colors.primary : '#dbe7ff' }]} />
            {index % labelEvery === 0 || index === series.length - 1 ? <Text style={styles.barLabel}>{shortDateLabel(item.key)}</Text> : <Text style={styles.barLabel}> </Text>}
          </View>
        ))}
      </View>
      <Muted style={styles.axis}>Máximo no período: {max} solicitação(ões) por dia</Muted>
    </View>
  );
}

export default function ClientDashboardScreen({ navigation }) {
  const [days, setDays] = useState(7);
  const { data, loading, refreshing, refresh } = useLoader(loadDashboard);

  if (loading && !data) return <Loading />;
  const summary = data?.summary || {};
  const series = buildSeries(data?.orders || [], days);
  const periodOrders = series.reduce((sum, item) => sum + item.orders, 0);
  const periodItems = series.reduce((sum, item) => sum + item.items, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title subtitle="Acompanhe suas solicitações">Dashboard</Title>
      <View style={styles.grid}>
        <StatCard title="Solicitações" value={summary.total_orders ?? '—'} actionLabel="Ver solicitações" onPress={() => navigation.navigate('ClientOrders')} />
        <StatCard title="Aprovação" value={summary.pending_orders ?? '—'} />
        <StatCard title="Retirada" value={summary.approved_orders ?? '—'} />
        <StatCard title="Finalizadas" value={summary.finished_orders ?? '—'} />
      </View>
      <Card>
        <Text style={styles.section}>Solicitações por dia</Text>
        <ButtonRow>
          {RANGES.map((range) => (
            <Button key={range} title={`${range} dias`} small variant={range === days ? 'primary' : 'outlinePrimary'} onPress={() => setDays(range)} />
          ))}
        </ButtonRow>
        {periodOrders ? <OrdersChart series={series} days={days} /> : <Muted>Nenhuma solicitação no período selecionado.</Muted>}
      </Card>
      <Card>
        <Text style={styles.section}>Resumo rápido</Text>
        <View style={styles.quick}>
          <View style={styles.quickItem}>
            <Muted>Itens solicitados</Muted>
            <Text style={styles.quickValue}>{summary.total_quantity ?? '—'}</Text>
          </View>
          <View style={styles.quickItem}>
            <Muted>Valor total</Muted>
            <Text style={styles.quickValue}>{formatPrice(summary.total_value ?? 0)}</Text>
          </View>
        </View>
        <View style={styles.quick}>
          <View style={styles.quickItem}>
            <Muted>Solicitações no período</Muted>
            <Text style={styles.quickValue}>{periodOrders}</Text>
          </View>
          <View style={styles.quickItem}>
            <Muted>Itens no período</Muted>
            <Text style={styles.quickValue}>{periodItems}</Text>
          </View>
        </View>
        <Button title="Nova solicitação" onPress={() => navigation.navigate('ClientProducts')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT + 24, gap: 2 },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '80%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLabel: { fontSize: 8, color: colors.muted, marginTop: 4 },
  axis: { marginTop: spacing.xs },
  quick: { flexDirection: 'row', gap: spacing.md },
  quickItem: { flex: 1, backgroundColor: colors.light, borderRadius: 8, padding: spacing.md },
  quickValue: { fontSize: 20, fontWeight: '700', color: colors.text },
});
