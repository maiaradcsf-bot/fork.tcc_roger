import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { matchesSearch } from '../../utils/format.js';

export default function PermissionsScreen({ navigation }) {
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.settings.listPermissions());

  if (loading && !data) return <Loading message="Carregando permissões..." />;
  const permissions = (data || []).filter((permission) => matchesSearch(term, permission.name, permission.description));

  function confirmDelete(permission) {
    Alert.alert('Excluir permissão', 'Deseja excluir esta permissão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await api.admin.settings.deletePermission(permission.id);
            Alert.alert('Sucesso', 'Permissão excluída com sucesso.');
            await reload();
          }),
      },
    ]);
  }

  const openEdit = (permission) => navigation.navigate('PermissionForm', { permission });

  return (
    <ListScreen
      data={permissions}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhuma permissão encontrada."
      header={
        <ListToolbar search={term} onSearch={setTerm} placeholder="Buscar permissão" primary={{ label: 'Nova permissão', onPress: () => navigation.navigate('PermissionForm') }} count={permissions.length} />
      }
      renderItem={({ item: permission }) => (
        <ListItem
          title={permission.name}
          subtitle={permission.description || null}
          badge={permission.system ? <Pill label="Sistema" background="#e2e3e5" color="#41464b" /> : null}
          onPress={() => openEdit(permission)}
          actions={[
            { label: 'Editar', icon: 'create-outline', onPress: () => openEdit(permission) },
            { label: 'Excluir', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(permission) },
          ]}
        />
      )}
    />
  );
}
