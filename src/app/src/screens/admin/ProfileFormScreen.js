import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, ButtonRow, Card, CheckboxRow, Field, Label, Loading, Muted, Screen, SearchBar } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { matchesSearch } from '../../utils/format.js';

export default function ProfileFormScreen({ navigation, route }) {
  const profile = route.params?.profile || null;
  const { busy, run } = useAction();
  const [name, setName] = useState(profile?.name || '');
  const [description, setDescription] = useState(profile?.description || '');
  const [permissionIds, setPermissionIds] = useState(profile?.permission_ids || []);
  const [term, setTerm] = useState('');
  const { data, loading } = useLoader(() => api.admin.settings.listPermissions(), { reloadOnFocus: false });

  useEffect(() => {
    navigation.setOptions({ title: profile ? 'Editar Perfil' : 'Novo Perfil' });
  }, [navigation, profile]);

  if (loading && !data) return <Loading />;
  const toggle = (id) => setPermissionIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const permissions = (data || []).filter((permission) => matchesSearch(term, permission.name, permission.description));

  async function save() {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome do perfil é obrigatório.');
      return;
    }
    await run(async () => {
      const payload = { name: name.trim(), description: description.trim(), permissionIds };
      if (profile) await api.admin.settings.updateRule(profile.id, payload);
      else await api.admin.settings.createRule(payload);
      Alert.alert('Sucesso', profile ? 'Perfil atualizado com sucesso.' : 'Perfil criado com sucesso.');
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Card>
        <Field label="Nome do perfil" value={name} onChangeText={setName} />
        <Field label="Descrição" value={description} onChangeText={setDescription} multiline />
        <Label>Permissões</Label>
        <Muted>Marque cada permissão individualmente. Clicar em uma não afeta as demais.</Muted>
        <SearchBar value={term} onChangeText={setTerm} placeholder="Filtrar permissões" />
        {permissions.length ? (
          permissions.map((permission) => (
            <CheckboxRow key={permission.id} label={permission.name} checked={permissionIds.includes(permission.id)} onToggle={() => toggle(permission.id)} />
          ))
        ) : (
          <Muted>Nenhuma permissão cadastrada.</Muted>
        )}
        <ButtonRow>
          <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
          <Button title="Salvar perfil" onPress={save} loading={busy} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}
