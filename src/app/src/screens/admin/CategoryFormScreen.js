import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { SelectField } from '../../components/SelectField.js';
import { Button, ButtonRow, Card, Field, Screen } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';

export default function CategoryFormScreen({ navigation, route }) {
  const category = route.params?.category || null;
  const { busy, run } = useAction();
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [parentId, setParentId] = useState(category?.parent_id ?? null);
  const { data } = useLoader(() => api.admin.catalog.listCategories(), { reloadOnFocus: false });

  useEffect(() => {
    navigation.setOptions({ title: category ? 'Editar Categoria' : 'Nova Categoria' });
  }, [navigation, category]);

  const parents = (data || []).filter((item) => !item.parent_id && item.id !== category?.id);
  const options = [{ value: null, label: 'Nenhuma (Categoria Principal)' }, ...parents.map((item) => ({ value: item.id, label: item.name }))];

  async function save() {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome da categoria é obrigatório.');
      return;
    }
    const payload = { name: name.trim(), description: description.trim(), parent_id: parentId };
    await run(async () => {
      if (category) await api.admin.catalog.updateCategory(category.id, payload);
      else await api.admin.catalog.createCategory(payload);
      Alert.alert('Sucesso', category ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Card>
        <Field label="Nome" value={name} onChangeText={setName} />
        <Field label="Descrição" value={description} onChangeText={setDescription} multiline />
        <SelectField label="Categoria pai" options={options} value={parentId} onChange={setParentId} placeholder="Nenhuma (Categoria Principal)" />
        <ButtonRow>
          <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
          <Button title="Salvar categoria" onPress={save} loading={busy} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}
