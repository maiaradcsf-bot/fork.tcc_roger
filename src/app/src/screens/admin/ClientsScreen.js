import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors } from '../../theme/index.js';
import { matchesSearch } from '../../utils/format.js';

export default function ClientsScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.orders.listClients());

  if (loading && !data) return <Loading message="Carregando clientes..." />;
  const clients = (data || []).filter((client) => matchesSearch(term, client.name, client.email, client.phone));

  function confirmStatus(client) {
    const action = client.active ? 'inativar' : 'reativar';
    Alert.alert(
      client.active ? 'Inativar Cliente' : 'Reativar Cliente',
      `Deseja ${action} o cliente ${client.name || 'Cliente'}?\n\nA ativação/desativação será aplicada imediatamente no cadastro.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: client.active ? 'Confirmar inativação' : 'Confirmar reativação',
          style: client.active ? 'destructive' : 'default',
          onPress: () =>
            run(async () => {
              await api.admin.orders.setClientActive(client.id, !client.active);
              Alert.alert('Sucesso', `Cliente ${client.active ? 'inativado' : 'reativado'} com sucesso.`);
              await reload();
            }),
        },
      ],
    );
  }

  const canView = hasPermission('admin.clients.view');
  const canEdit = hasPermission('admin.clients.edit');
  const openDetail = (client) => navigation.navigate('ClientDetail', { clientId: client.id });

  return (
    <ListScreen
      data={clients}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhum cliente encontrado."
      header={<ListToolbar search={term} onSearch={setTerm} placeholder="Nome, e-mail ou telefone" count={clients.length} />}
      renderItem={({ item: client }) => (
        <ListItem
          leading={<Avatar name={client.name} active={client.active} />}
          title={client.name}
          subtitle={client.email || '—'}
          details={[client.phone]}
          badge={<Pill label={client.active ? 'Ativo' : 'Inativo'} background={client.active ? '#d1e7dd' : '#e2e3e5'} color={client.active ? '#0f5132' : '#41464b'} />}
          onPress={canView ? () => openDetail(client) : undefined}
          actions={[
            canView && { label: 'Ver detalhes', icon: 'eye-outline', onPress: () => openDetail(client) },
            canEdit && {
              label: client.active ? 'Inativar' : 'Reativar',
              icon: client.active ? 'person-remove-outline' : 'person-add-outline',
              destructive: client.active,
              color: client.active ? undefined : colors.success,
              onPress: () => confirmStatus(client),
            },
          ]}
        />
      )}
    />
  );
}

function Avatar({ name, active }) {
  const initials = String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, !active && styles.avatarInactive]}>
      <Text style={styles.avatarText}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInactive: { backgroundColor: colors.secondary },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
