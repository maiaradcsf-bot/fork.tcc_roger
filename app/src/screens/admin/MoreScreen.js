import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { Button, Card, InfoRow, Screen, Title } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { colors } from '../../theme/index.js';

export const ADMIN_MODULES = [
  { route: 'Categories', title: 'Categorias', permission: 'admin.categories.list' },
  { route: 'StockMoves', title: 'Mov. Estoque', permission: 'admin.stock.moves.list' },
  { route: 'Clients', title: 'Clientes', permission: 'admin.clients.list' },
  { route: 'Settings', title: 'Configurações', permission: 'admin.settings.permissions.manage|admin.settings.profiles.manage|admin.settings.users.manage' },
];

export default function MoreScreen({ navigation }) {
  const { session, hasPermission, signOut } = useAuth();
  const profile = session?.profile || {};
  const modules = ADMIN_MODULES.filter((module) => hasPermission(module.permission));

  function confirmSignOut() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen>
      <Title>Almoxarifado</Title>
      <Card>
        <InfoRow label="Usuário" value={profile.username || '—'} />
        <InfoRow label="E-mail" value={profile.email || '—'} />
        <InfoRow label="Perfis" value={(profile.rules || []).map((rule) => rule.name).join(', ') || '—'} />
      </Card>
      {modules.map((module) => (
        <Pressable key={module.route} onPress={() => navigation.navigate(module.route)}>
          <Card>
            <Text style={styles.module}>{module.title}</Text>
          </Card>
        </Pressable>
      ))}
      <Button title="Sair" variant="outlineDanger" onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  module: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
