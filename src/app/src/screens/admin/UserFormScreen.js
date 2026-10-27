import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, ButtonRow, Card, CheckboxRow, Field, Label, Loading, Muted, Screen } from '../../components/ui.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';

export default function UserFormScreen({ navigation, route }) {
  const user = route.params?.user || null;
  const { busy, run } = useAction();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [ruleIds, setRuleIds] = useState((user?.rules || []).map((rule) => rule.id));
  const { data, loading } = useLoader(() => api.admin.settings.listRules(), { reloadOnFocus: false });

  useEffect(() => {
    navigation.setOptions({ title: user ? 'Editar Usuário' : 'Novo Usuário' });
  }, [navigation, user]);

  if (loading && !data) return <Loading />;
  const toggle = (id) => setRuleIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  async function save() {
    if (!username.trim() || !email.trim()) {
      Alert.alert('Atenção', 'Preencha usuário e e-mail.');
      return;
    }
    if (!user && !password) {
      Alert.alert('Atenção', 'Senha é obrigatória para novo usuário.');
      return;
    }
    await run(async () => {
      const payload = { username: username.trim(), email: email.trim(), ruleIds };
      if (password) payload.password = password;
      if (user) await api.admin.settings.updateUser(user.id, payload);
      else await api.admin.settings.createUser(payload);
      Alert.alert('Sucesso', user ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.');
      navigation.goBack();
    });
  }

  return (
    <Screen>
      <Card>
        <Field label="Usuário" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          hint={user ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 6 caracteres.'}
        />
        <Label>Perfis</Label>
        {(data || []).length ? (
          data.map((rule) => <CheckboxRow key={rule.id} label={rule.name} checked={ruleIds.includes(rule.id)} onToggle={() => toggle(rule.id)} />)
        ) : (
          <Muted>Nenhum perfil cadastrado.</Muted>
        )}
        <ButtonRow>
          <Button title="Cancelar" variant="outlineSecondary" onPress={() => navigation.goBack()} />
          <Button title="Salvar usuário" onPress={save} loading={busy} />
        </ButtonRow>
      </Card>
    </Screen>
  );
}
