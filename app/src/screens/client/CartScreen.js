import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ActionMenu } from '../../components/list.js';
import { Button, ButtonRow, Card, EmptyState, Field, Loading, Muted, Screen } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useCart } from '../../context/CartContext.js';
import { useAction } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, radius, spacing } from '../../theme/index.js';
import { formatPrice } from '../../utils/format.js';

export default function CartScreen({ navigation }) {
  const { handleError } = useAuth();
  const { cart, canManage, refreshCart } = useCart();
  const { busy, run } = useAction();
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      refreshCart()
        .catch(handleError)
        .finally(() => setLoading(false));
    }, [refreshCart, handleError]),
  );

  useEffect(() => {
    setQuantities(Object.fromEntries((cart?.items || []).map((item) => [item.id, String(item.quantity)])));
  }, [cart]);

  if (!canManage) return <Screen><EmptyState message="Sem permissão para gerenciar o carrinho." /></Screen>;
  if (loading && !cart) return <Loading message="Carregando carrinho..." />;

  const items = cart?.items || [];
  const total = items.reduce((sum, item) => sum + Number(item.subtotal ?? Number(item.unit_price || 0) * Number(item.quantity || 0)), 0);
  const blocked = items.some((item) => Number(item.quantity || 0) > Number(item.stock ?? 0));

  function saveItem(item) {
    const quantity = Number(quantities[item.id]);
    const stock = Number(item.stock ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1) {
      Alert.alert('Atenção', 'Informe uma quantidade válida (>=1).');
      return;
    }
    if (quantity > stock) {
      Alert.alert('Atenção', `Quantidade máxima disponível para ${item.product_name}: ${stock}.`);
      return;
    }
    run(async () => {
      await api.client.updateCartItem(cart.id, item.id, quantity);
      await refreshCart();
      Alert.alert('Sucesso', 'Quantidade atualizada.');
    });
  }

  function removeItem(item) {
    run(async () => {
      await api.client.removeCartItem(cart.id, item.id);
      await refreshCart();
      Alert.alert('Sucesso', 'Produto removido do carrinho.');
    });
  }

  function confirmRequest() {
    if (!reason.trim()) {
      Alert.alert('Atenção', 'Informe o motivo da solicitação antes de confirmar.');
      return;
    }
    run(async () => {
      const data = await api.client.checkoutCart(cart.id, reason.trim());
      setReason('');
      await refreshCart();
      Alert.alert('Sucesso', `Solicitação #${data.order_id} confirmada com total ${formatPrice(data.total)}.`);
      navigation.goBack();
    });
  }

  return (
    <Screen>
      {!items.length ? <EmptyState message="Carrinho vazio." /> : null}
      {items.length ? (
        <View style={styles.list}>
          {items.map((item, index) => {
            const stock = Number(item.stock ?? 0);
            const unit = Number(item.unit_price || 0);
            const over = Number(item.quantity) > stock;
            return (
              <View key={item.id} style={[styles.item, index > 0 && styles.itemBorder]}>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.product_name || '—'}
                  </Text>
                  <Text style={styles.detail}>
                    {formatPrice(unit)} un. · Estoque {stock}
                  </Text>
                  {over ? <Text style={styles.warning}>Acima do estoque atual</Text> : null}
                  <Text style={styles.subtotal}>{formatPrice(item.subtotal ?? unit * Number(item.quantity || 0))}</Text>
                </View>
                <TextInput
                  value={quantities[item.id] ?? ''}
                  onChangeText={(text) => setQuantities((current) => ({ ...current, [item.id]: text.replace(/[^0-9]/g, '') }))}
                  onSubmitEditing={() => saveItem(item)}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={stock > 0}
                  style={[styles.quantity, over && styles.quantityOver]}
                  accessibilityLabel={`Quantidade de ${item.product_name}`}
                />
                <ActionMenu
                  title={item.product_name}
                  actions={[
                    { label: 'Salvar quantidade', icon: 'save-outline', color: colors.primary, disabled: stock <= 0 || busy, onPress: () => saveItem(item) },
                    { label: 'Remover do carrinho', icon: 'trash-outline', destructive: true, disabled: busy, onPress: () => removeItem(item) },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      <Card>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total ({items.length} {items.length === 1 ? 'item' : 'itens'})
          </Text>
          <Text style={styles.total}>{formatPrice(total)}</Text>
        </View>
        <Field label="Motivo" value={reason} onChangeText={setReason} multiline placeholder="Informe o motivo da solicitação (obrigatório)" />
        {blocked ? <Muted>Ajuste as quantidades acima do estoque antes de confirmar.</Muted> : null}
        <ButtonRow>
          <Button title="Fechar" variant="outlineSecondary" onPress={() => navigation.goBack()} style={styles.flex} />
          <Button title="Confirmar" icon="checkmark" onPress={confirmRequest} loading={busy} disabled={!items.length || blocked} style={styles.flex} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingLeft: spacing.md, paddingRight: spacing.xs },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 12, color: colors.muted },
  subtotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  warning: { color: colors.danger, fontSize: 12 },
  quantity: { width: 56, height: 38, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, textAlign: 'center', fontSize: 15, color: colors.text, backgroundColor: colors.white },
  quantityOver: { borderColor: colors.danger },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: colors.muted },
  total: { fontSize: 18, fontWeight: '700', color: colors.text },
});
