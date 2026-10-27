import { Pressable, StyleSheet, Text } from 'react-native';

import { Card, EmptyState, Screen, Title } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { colors } from '../../theme/index.js';

const SECTIONS = [
  { route: 'Permissions', title: 'Permissões', text: 'Organize permissões por área e atribua a grupos de usuários.', permission: 'admin.settings.permissions.manage' },
  { route: 'Profiles', title: 'Perfis', text: 'Gerencie perfis de usuário com direitos de acesso padronizados.', permission: 'admin.settings.profiles.manage' },
  { route: 'Users', title: 'Usuários', text: 'Adicione usuários, atualize perfis e controle acessos.', permission: 'admin.settings.users.manage' },
];

export default function SettingsScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const sections = SECTIONS.filter((section) => hasPermission(section.permission));

  return (
    <Screen>
      <Title subtitle="Gerencie permissões, perfis e usuários administrativos.">Configurações</Title>
      {!sections.length ? <EmptyState message="Você não possui acesso às configurações." /> : null}
      {sections.map((section) => (
        <Pressable key={section.route} onPress={() => navigation.navigate(section.route)}>
          <Card>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.text}>{section.text}</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.primary },
  text: { fontSize: 14, color: colors.muted },
});
