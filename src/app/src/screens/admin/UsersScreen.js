import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { formatDate, matchesSearch } from '../../utils/format.js';

export default function UsersScreen({ navigation }) {
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.settings.listUsers());

  if (loading && !data) return <Loading message="Carregando usuários..." />;
  const users = (data || []).filter((user) => matchesSearch(term, user.username, user.email, (user.rules || []).map((rule) => rule.name).join(' ')));

  function confirmDelete(user) {
    Alert.alert('Excluir usuário', 'Deseja excluir este usuário?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await api.admin.settings.deleteUser(user.id);
            Alert.alert('Sucesso', 'Usuário excluído com sucesso.');
            await reload();
          }),
      },
    ]);
  }

  const openEdit = (user) => navigation.navigate('UserForm', { user });

  return (
    <ListScreen
      data={users}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhum usuário encontrado."
      header={
        <ListToolbar search={term} onSearch={setTerm} placeholder="Nome, e-mail ou perfil" primary={{ label: 'Novo usuário', onPress: () => navigation.navigate('UserForm') }} count={users.length} />
      }
      renderItem={({ item: user }) => (
        <ListItem
          title={user.username}
          subtitle={user.email || null}
          details={[user.created_at ? `Cadastro ${formatDate(user.created_at)}` : null]}
          badge={(user.rules || []).length ? (user.rules || []).map((rule) => <Pill key={rule.id ?? rule.name} label={rule.name} />) : <Pill label="Sem perfil" />}
          onPress={() => openEdit(user)}
          actions={[
            { label: 'Editar', icon: 'create-outline', onPress: () => openEdit(user) },
            { label: 'Excluir', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(user) },
          ]}
        />
      )}
    />
  );
}
