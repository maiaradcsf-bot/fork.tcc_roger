import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { SelectField } from '../../components/SelectField.js';
import { Badge, Button, ButtonRow, Card, InfoRow, Muted, Screen, Title } from '../../components/ui.js';
import { useAction } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, spacing } from '../../theme/index.js';
import { formatPrice } from '../../utils/format.js';
import { pickedFile } from '../../utils/media.js';
import { IMPORT_FIELD_DEFS, guessColumnForField } from '../../utils/products.js';

const ACTION_BADGES = {
  create: { label: 'Novo', background: colors.success, color: colors.white },
  update: { label: 'Atualizar', background: colors.info, color: colors.text },
  invalid: { label: 'Inválido', background: colors.danger, color: colors.white },
};

function rowDetails(row) {
  if (row.action === 'invalid') return (row.errors || []).join('; ');
  if (row.action === 'update' && row.current) {
    const diffs = [];
    if (Number(row.current.price ?? 0) !== Number(row.data.price ?? 0)) {
      diffs.push(`Preço: ${formatPrice(row.current.price)} → ${formatPrice(row.data.price)}`);
    }
    if (row.data.stock_quantity !== null && row.data.stock_quantity !== undefined && row.current.stock_quantity !== row.data.stock_quantity) {
      diffs.push(`Estoque: ${row.current.stock_quantity ?? 0} → ${row.data.stock_quantity}`);
    }
    return diffs.length ? diffs.join('\n') : 'Sem alterações relevantes';
  }
  return '—';
}

export default function ProductImportScreen({ navigation }) {
  const { busy, run } = useAction();
  const [upload, setUpload] = useState(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const importRef = useRef({ id: null, completed: false });

  useEffect(
    () => () => {
      const { id, completed } = importRef.current;
      if (id && !completed) api.admin.catalog.cancelImport(id).catch(() => {});
    },
    [],
  );

  async function pickFile() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    if (!asset.name.toLowerCase().endsWith('.csv')) {
      Alert.alert('Atenção', 'Selecione um arquivo no formato .csv.');
      return;
    }
    await run(async () => {
      const previous = importRef.current;
      if (previous.id && !previous.completed) await api.admin.catalog.cancelImport(previous.id).catch(() => {});
      const data = await api.admin.catalog.uploadImportFile(pickedFile(asset, 'produtos.csv', 'text/csv'));
      importRef.current = { id: data.import_id, completed: false };
      const headers = data.headers || [];
      setUpload(data);
      setFileName(asset.name);
      setMapping(Object.fromEntries(IMPORT_FIELD_DEFS.map((field) => [field.key, guessColumnForField(field.key, headers)])));
      setPreview(null);
      setResult(null);
      setStep(1);
    });
  }

  async function loadPreview() {
    const missing = IMPORT_FIELD_DEFS.filter((field) => field.required && !mapping[field.key]);
    if (missing.length) {
      Alert.alert('Atenção', `Mapeie as colunas obrigatórias: ${missing.map((field) => field.label).join(', ')}.`);
      return;
    }
    await run(async () => {
      setPreview(await api.admin.catalog.previewImport(upload.import_id, mapping));
      setStep(2);
    });
  }

  async function commit() {
    await run(async () => {
      const response = await api.admin.catalog.commitImport(upload.import_id, mapping);
      importRef.current.completed = true;
      setResult(response);
      setStep(3);
      Alert.alert('Sucesso', 'Importação de produtos concluída com sucesso.');
    });
  }

  const headerOptions = [{ value: '', label: '— não importar —' }, ...(upload?.headers || []).map((header) => ({ value: header, label: header }))];

  return (
    <Screen>
      <Title subtitle="1 Mapear colunas · 2 Revisar · 3 Concluído">Importar Produtos via CSV</Title>
      {step === 0 ? (
        <Card>
          <Muted>Selecione um arquivo .csv com os produtos. O Código de Barras é usado como referência: produtos cujo código já existe serão atualizados; os demais serão criados.</Muted>
          <Button title="Selecionar arquivo CSV" onPress={pickFile} loading={busy} />
        </Card>
      ) : null}
      {step === 1 && upload ? (
        <>
          <Card>
            <Muted>
              Arquivo <Text style={styles.bold}>{fileName}</Text> ({upload.row_count ?? 0} linha(s) de produtos encontradas). Para cada campo do sistema, escolha a coluna correspondente no CSV enviado.
            </Muted>
            {IMPORT_FIELD_DEFS.map((field) => (
              <SelectField
                key={field.key}
                label={`${field.label}${field.required ? ' *' : ''}`}
                options={headerOptions}
                value={mapping[field.key] || ''}
                onChange={(value) => setMapping((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
          </Card>
          <Card>
            <Text style={styles.section}>Prévia do arquivo</Text>
            {(upload.sample_rows || []).length ? (
              upload.sample_rows.map((row, index) => (
                <View key={index} style={styles.sample}>
                  {(upload.headers || []).map((header) => (
                    <Text key={header} style={styles.sampleText}>
                      <Text style={styles.bold}>{header}: </Text>
                      {row[header] ?? ''}
                    </Text>
                  ))}
                </View>
              ))
            ) : (
              <Muted>Sem linhas de exemplo</Muted>
            )}
          </Card>
          <ButtonRow>
            <Button title="Trocar arquivo" variant="outlineSecondary" onPress={pickFile} />
            <Button title="Avançar" onPress={loadPreview} loading={busy} />
          </ButtonRow>
        </>
      ) : null}
      {step === 2 && preview ? (
        <>
          <View style={styles.summary}>
            {[
              ['Linhas no arquivo', preview.summary.total, colors.text],
              ['Novos produtos', preview.summary.to_create, colors.success],
              ['Serão atualizados', preview.summary.to_update, colors.info],
              ['Inválidos (ignorados)', preview.summary.invalid, colors.danger],
            ].map(([label, value, color]) => (
              <Card key={label} style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color }]}>{value}</Text>
                <Muted>{label}</Muted>
              </Card>
            ))}
          </View>
          {preview.rows.map((row) => {
            const badge = ACTION_BADGES[row.action] || ACTION_BADGES.invalid;
            return (
              <Card key={row.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.bold}>Linha {row.row}</Text>
                  <Badge label={badge.label} background={badge.background} color={badge.color} />
                </View>
                <InfoRow label="Nome" value={row.data.name || '—'} />
                <InfoRow label="Código de Barras" value={row.data.barcode || '—'} />
                <InfoRow label="Preço" value={row.data.price !== null && row.data.price !== undefined ? formatPrice(row.data.price) : '—'} />
                <InfoRow label="Estoque" value={String(row.data.stock_quantity ?? '—')} />
                <InfoRow label="Detalhes" value={rowDetails(row)} />
              </Card>
            );
          })}
          <ButtonRow>
            <Button title="Voltar" variant="outlineSecondary" onPress={() => setStep(1)} />
            <Button title="Concluir importação" variant="success" onPress={commit} loading={busy} />
          </ButtonRow>
        </>
      ) : null}
      {step === 3 && result ? (
        <Card>
          <Text style={styles.done}>Importação concluída!</Text>
          <Text style={styles.resultText}>
            <Text style={styles.bold}>{result.created}</Text> produto(s) criado(s) e <Text style={styles.bold}>{result.updated}</Text> atualizado(s).
          </Text>
          {result.skipped ? <Text style={styles.warning}>{result.skipped} linha(s) ignorada(s) por erro de validação.</Text> : null}
          <Button title="Fechar" onPress={() => navigation.goBack()} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700', color: colors.text },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  sample: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 2 },
  sampleText: { fontSize: 13, color: colors.text },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryCard: { flexBasis: '47%', flexGrow: 1, alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  done: { fontSize: 20, fontWeight: '700', color: colors.success, textAlign: 'center' },
  resultText: { fontSize: 15, color: colors.text, textAlign: 'center' },
  warning: { color: '#997404', textAlign: 'center' },
});
