import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Loading, Muted, Screen, StatCard, Title } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, spacing } from '../../theme/index.js';
import { ORDER_STATUS_GROUPS } from '../../utils/format.js';
import { isLowStock } from '../../utils/products.js';

const safe = (promise) => promise.catch(() => null);

async function loadDashboard() {
  const [orders, categories, products, clients, stock] = await Promise.all([
    safe(api.admin.orders.listOrders()),
    safe(api.admin.catalog.listCategories()),
    safe(api.admin.catalog.listProducts()),
    safe(api.admin.orders.listClients()),
    safe(api.admin.stock.listStock()),
  ]);
  return { orders, categories, products, clients, stock };
}

const count = (list) => (Array.isArray(list) ? list.length : '—');

export default function DashboardScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const { data, loading, refreshing, refresh } = useLoader(loadDashboard);

  if (loading && !data) return <Loading />;
  const { orders, categories, products, clients, stock } = data || {};
  const lowStock = Array.isArray(products) ? products.filter(isLowStock) : [];
  const pending = Array.isArray(orders) ? orders.filter((order) => ORDER_STATUS_GROUPS.pending.includes(String(order.status || '').toLowerCase())).length : '—';
  const totalStock = Array.isArray(stock) ? stock.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : '—';
  const go = (route, permission) => (hasPermission(permission) ? () => navigation.navigate(route) : undefined);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title subtitle="Visão geral do almoxarifado">Dashboard</Title>
      <View style={styles.grid}>
        <StatCard title="Solicitações" subtitle="Total de pedidos" value={count(orders)} actionLabel="Ver solicitações" onPress={go('Orders', 'admin.orders.list')} />
        <StatCard title="Categorias" subtitle="Itens de produto" value={count(categories)} actionLabel="Ver categorias" onPress={go('Categories', 'admin.categories.list')} />
        <StatCard title="Produtos" subtitle="Itens cadastrados" value={count(products)} actionLabel="Ver produtos" onPress={go('Products', 'admin.products.list')} />
        <StatCard title="Clientes" subtitle="Cadastros ativos" value={count(clients)} actionLabel="Ver clientes" onPress={go('Clients', 'admin.clients.list')} />
      </View>
      <Card>
        <Text style={styles.section}>Resumo rápido</Text>
        <Muted>Navegue pelos módulos para abrir as páginas de gerenciamento individuais.</Muted>
        <View style={styles.quick}>
          <View style={styles.quickItem}>
            <Muted>Aguardando aprovação</Muted>
            <Text style={styles.quickValue}>{pending}</Text>
          </View>
          <View style={styles.quickItem}>
            <Muted>Estoque total</Muted>
            <Text style={styles.quickValue}>{totalStock}</Text>
          </View>
        </View>
        {hasPermission('admin.orders.list') ? <Button title="Ir para Solicitações" variant="outlinePrimary" onPress={() => navigation.navigate('Orders')} /> : null}
      </Card>
      <Card>
        <Text style={styles.section}>Atenção ao estoque</Text>
        <Muted>Produtos no ou abaixo do estoque mínimo</Muted>
        {lowStock.length ? (
          lowStock.map((product) => (
            <View key={product.id} style={styles.lowRow}>
              <Text style={styles.lowName}>{product.name || '—'}</Text>
              <Text style={styles.lowValue}>
                {product.stock ?? '—'} / mín. {product.min_stock ?? '—'}
              </Text>
            </View>
          ))
        ) : (
          <Muted>Nenhum produto próximo do estoque mínimo.</Muted>
        )}
      </Card>
      <Card>
        <Text style={styles.section}>Próximos passos</Text>
        {['Revisar solicitações aguardando aprovação', 'Atualizar categorias existentes', 'Adicionar novos produtos', 'Conferir clientes ativos'].map((step) => (
          <Text key={step} style={styles.step}>
            • {step}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  quick: { flexDirection: 'row', gap: spacing.md },
  quickItem: { flex: 1, backgroundColor: colors.light, borderRadius: 8, padding: spacing.md },
  quickValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  lowRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  lowName: { flex: 1, color: colors.text },
  lowValue: { color: colors.danger, fontWeight: '600' },
  step: { color: colors.text, fontSize: 14 },
});
