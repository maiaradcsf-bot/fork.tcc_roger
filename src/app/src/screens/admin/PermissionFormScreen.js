import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, ButtonRow, Card, Field, Screen } from '../../components/ui.js';
import { useAction } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';

export default function PermissionFormScreen({ navigation, route }) {
  const permission = route.params?.permission || null;
  const { busy, run } = useAction();
  const [name, setName] = useState(permission?.name || '');
  const [description, setDescription] = useState(permission?.description || '');

  useEffect(() => {
    navigation.setOptions({ title: permission ? 'Editar Permissão' : 'Nova Permissão' });
  }, [navigation, permission]);

  async function save() {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome da permissão é obrigatório.');
      return;
    }
    await run(async () => {
      const payload = { name: name.trim(), description: description.trim() };
      if (permission) await api.admin.settings.updatePermission(permission.id, payload);
      else await api.admin.settings.createPermission(payload);
      Alert.alert('Sucesso', permission ? 'Permissão atualizada com sucesso.' : 'Permissão criada com sucesso.');
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Card>
        <Field label="Nome" value={name} onChangeText={setName} autoCapitalize="none" editable={!permission?.system} hint={permission?.system ? 'Permissões do sistema não podem ser renomeadas.' : undefined} />
        <Field label="Descrição" value={description} onChangeText={setDescription} multiline />
        <ButtonRow>
          <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
          <Button title="Salvar permissão" onPress={save} loading={busy} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}
