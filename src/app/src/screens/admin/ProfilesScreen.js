import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { matchesSearch } from '../../utils/format.js';

export default function ProfilesScreen({ navigation }) {
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.settings.listRules());

  if (loading && !data) return <Loading message="Carregando perfis..." />;
  const profiles = (data || []).filter((profile) => matchesSearch(term, profile.name, profile.description));

  function confirmDelete(profile) {
    Alert.alert('Excluir perfil', 'Deseja excluir este perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await api.admin.settings.deleteRule(profile.id);
            Alert.alert('Sucesso', 'Perfil excluído com sucesso.');
            await reload();
          }),
      },
    ]);
  }

  const openEdit = (profile) => navigation.navigate('ProfileForm', { profile });

  return (
    <ListScreen
      data={profiles}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhum perfil encontrado."
      header={
        <ListToolbar search={term} onSearch={setTerm} placeholder="Buscar perfil" primary={{ label: 'Novo perfil', onPress: () => navigation.navigate('ProfileForm') }} count={profiles.length} />
      }
      renderItem={({ item: profile }) => (
        <ListItem
          title={profile.name}
          subtitle={profile.description || null}
          badge={<Pill label={`${(profile.permissions || []).length} permissões`} />}
          onPress={() => openEdit(profile)}
          actions={[
            { label: 'Editar', icon: 'create-outline', onPress: () => openEdit(profile) },
            { label: 'Excluir', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(profile) },
          ]}
        />
      )}
    />
  );
}
