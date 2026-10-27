import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { SelectField } from '../../components/SelectField.js';
import { Button, ButtonRow, Card, Field, Label, Loading, ProductImage, Screen } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { spacing } from '../../theme/index.js';
import { pickedFile } from '../../utils/media.js';

const EMPTY = { name: '', price: '0', description: '', barcode: '', min_stock: '0', max_stock: '', stock: '0', photo_path: '', category_ids: [] };

const toText = (value) => (value === null || value === undefined ? '' : String(value));

async function loadForm(productId) {
  const [categories, product] = await Promise.all([
    api.admin.catalog.listCategories(),
    productId ? api.admin.catalog.getProduct(productId) : Promise.resolve(null),
  ]);
  return { categories, product };
}

export default function ProductFormScreen({ navigation, route }) {
  const productId = route.params?.productId || null;
  const { busy, run } = useAction();
  const upload = useAction();
  const [form, setForm] = useState(EMPTY);
  const { data, loading } = useLoader(() => loadForm(productId), { reloadOnFocus: false });

  useEffect(() => {
    navigation.setOptions({ title: productId ? 'Editar Produto' : 'Novo Produto' });
  }, [navigation, productId]);

  useEffect(() => {
    const product = data?.product;
    if (!product) return;
    setForm({
      name: product.name || '',
      price: toText(product.price ?? 0),
      description: product.description || '',
      barcode: product.barcode || '',
      min_stock: toText(product.min_stock ?? 0),
      max_stock: toText(product.max_stock),
      stock: toText(product.stock ?? 0),
      photo_path: product.photo_path || '',
      category_ids: Array.isArray(product.category_ids) ? product.category_ids : [],
    });
  }, [data]);

  if (loading && !data) return <Loading />;

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const categoryOptions = (data?.categories || [])
    .map((category) => ({ value: category.id, label: category.parent_name ? `${category.parent_name} / ${category.name}` : category.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    await upload.run(async () => {
      const response = await api.admin.catalog.uploadProductImage(pickedFile(result.assets[0], 'produto.jpg', 'image/jpeg'));
      setForm((current) => ({ ...current, photo_path: response.url }));
    });
  }

  async function save() {
    if (!form.name.trim()) {
      Alert.alert('Atenção', 'O nome do produto é obrigatório.');
      return;
    }
    const maxStock = form.max_stock.trim() !== '' ? Number(form.max_stock) : null;
    const minStock = Number(form.min_stock || 0);
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      min_stock: Number.isFinite(minStock) ? minStock : null,
      max_stock: maxStock,
      description: form.description.trim(),
      price: Number(String(form.price).replace(',', '.') || 0),
      photo_path: form.photo_path || null,
      category_ids: form.category_ids,
    };
    const initialStock = Number(form.stock || 0);
    if (!productId && maxStock !== null && initialStock > maxStock) {
      Alert.alert('Atenção', 'Estoque inicial não pode ser maior que o estoque máximo.');
      return;
    }
    await run(async () => {
      if (productId) {
        await api.admin.catalog.updateProduct(productId, payload);
        Alert.alert('Sucesso', 'Produto atualizado com sucesso.');
      } else {
        const created = await api.admin.catalog.createProduct(payload);
        await api.admin.stock.createStock(created.id, Number.isFinite(initialStock) ? initialStock : 0);
        Alert.alert('Sucesso', 'Produto criado com sucesso.');
      }
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Card>
        <Field label="Nome" value={form.name} onChangeText={update('name')} />
        <Field label="Preço" value={form.price} onChangeText={update('price')} keyboardType="decimal-pad" />
        <Field label="Descrição" value={form.description} onChangeText={update('description')} multiline />
        <SelectField
          label="Categorias"
          options={categoryOptions}
          value={form.category_ids}
          onChange={update('category_ids')}
          multiple
          placeholder="Nenhuma categoria"
          hint="Selecione uma ou mais categorias para este produto."
        />
        <Label>Imagem do produto</Label>
        <View style={styles.photo}>
          <ProductImage path={form.photo_path} size={80} />
          <Button title={form.photo_path ? 'Trocar imagem' : 'Escolher imagem'} variant="outlinePrimary" small onPress={pickPhoto} loading={upload.busy} />
        </View>
        <Field label="Código de Barras" value={form.barcode} onChangeText={update('barcode')} autoCapitalize="characters" />
        <Field label="Estoque mínimo" value={form.min_stock} onChangeText={update('min_stock')} keyboardType="number-pad" />
        <Field label="Estoque máximo" value={form.max_stock} onChangeText={update('max_stock')} keyboardType="number-pad" />
        {!productId ? (
          <Field label="Estoque inicial" value={form.stock} onChangeText={update('stock')} keyboardType="number-pad" hint="Quantidade inicial para o produto." />
        ) : null}
        <ButtonRow>
          <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
          <Button title="Salvar produto" onPress={save} loading={busy} disabled={upload.busy} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
