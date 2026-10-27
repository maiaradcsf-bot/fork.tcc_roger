import { useState } from 'react';
import { Alert } from 'react-native';

import { SelectField } from '../../components/SelectField.js';
import { Button, ButtonRow, Card, Field, Loading, Screen } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';

const TYPES = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
];

export default function StockMoveFormScreen({ navigation, route }) {
  const { busy, run } = useAction();
  const [stockId, setStockId] = useState(route.params?.stockId ?? null);
  const [type, setType] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const { data, loading } = useLoader(() => api.admin.stock.listStock(), { reloadOnFocus: false });

  if (loading && !data) return <Loading />;
  const options = (data || []).map((item) => ({
    value: item.id,
    label: `${item.product_name || `Produto #${item.product_id}`} — ${item.quantity ?? 0} unidades`,
  }));

  async function save() {
    const amount = Number(quantity || 0);
    if (!stockId || !type || !amount) {
      Alert.alert('Atenção', 'Preencha todos os campos da movimentação.');
      return;
    }
    await run(async () => {
      const move = { stockId, quantity: amount, reason: reason.trim() || undefined };
      if (type === 'entrada') await api.admin.stock.registerEntry(move);
      else await api.admin.stock.registerExit(move);
      Alert.alert('Sucesso', 'Movimentação de estoque registrada com sucesso.');
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Card>
        <SelectField label="Item de estoque" options={options} value={stockId} onChange={setStockId} placeholder={options.length ? 'Selecione um item' : 'Nenhum item de estoque disponível'} />
        <SelectField label="Tipo de movimentação" options={TYPES} value={type} onChange={setType} placeholder="Selecione..." />
        <Field label="Quantidade" value={quantity} onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        <Field label="Motivo" value={reason} onChangeText={setReason} multiline />
        <ButtonRow>
          <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
          <Button title="Salvar movimentação" onPress={save} loading={busy} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}
