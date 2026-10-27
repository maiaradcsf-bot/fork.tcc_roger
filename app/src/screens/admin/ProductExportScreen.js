import { useState } from 'react';
import { Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Button, ButtonRow, Card, CheckboxRow, Muted, Screen, Title } from '../../components/ui.js';
import { useAction } from '../../hooks/useApi.js';
import { EXPORT_FIELD_DEFS, buildProductsCsv } from '../../utils/products.js';

export default function ProductExportScreen({ navigation, route }) {
  const products = route.params?.products || [];
  const { busy, run } = useAction();
  const [selected, setSelected] = useState(EXPORT_FIELD_DEFS.map((field) => field.key));

  const toggle = (key) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  async function exportCsv() {
    if (!selected.length) {
      Alert.alert('Atenção', 'Selecione ao menos uma coluna para exportar.');
      return;
    }
    if (!products.length) {
      Alert.alert('Atenção', 'Não há produtos na listagem atual para exportar.');
      return;
    }
    await run(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `produtos_export_${today}_${Date.now()}.csv`);
      file.create();
      await file.write(buildProductsCsv(products, selected));
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Arquivo gerado', `O compartilhamento não está disponível neste aparelho. Arquivo: ${file.uri}`);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar produtos', UTI: 'public.comma-separated-values-text' });
      Alert.alert('Sucesso', `${products.length} produto(s) exportado(s) com sucesso.`);
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Title subtitle={`Selecione as colunas que deseja incluir no arquivo CSV. A exportação considera apenas os produtos atualmente exibidos na listagem (${products.length} produto(s)).`}>
        Exportar Produtos
      </Title>
      <Card>
        <ButtonRow>
          <Button title="Selecionar todas" variant="outlinePrimary" small onPress={() => setSelected(EXPORT_FIELD_DEFS.map((field) => field.key))} />
          <Button title="Limpar seleção" variant="outlineSecondary" small onPress={() => setSelected([])} />
        </ButtonRow>
        {EXPORT_FIELD_DEFS.map((field) => (
          <CheckboxRow key={field.key} label={field.label} checked={selected.includes(field.key)} onToggle={() => toggle(field.key)} />
        ))}
        <Muted>{selected.length} coluna(s) selecionada(s)</Muted>
      </Card>
      <ButtonRow>
        <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
        <Button title="Exportar CSV" variant="success" onPress={exportCsv} loading={busy} />
      </ButtonRow>
    </Screen>
  );
}
