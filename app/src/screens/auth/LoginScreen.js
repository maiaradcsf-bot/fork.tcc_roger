import { useState } from 'react';
import { Text } from 'react-native';

import { AuthLayout, authStyles } from '../../components/AuthLayout.js';
import { Button, Field } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction } from '../../hooks/useApi.js';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const { busy, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit() {
    if (!email.trim() || !password) {
      setMessage('Preencha e-mail e senha antes de continuar.');
      return;
    }
    setMessage('');
    await run(() => signIn(email.trim(), password), {
      onError: (error) => {
        setMessage(`Falha no login: ${error.message}`);
        return true;
      },
    });
  }

  return (
    <AuthLayout title={'Almoxarifado\nGestão Administrativa'}>
      {message ? <Text style={authStyles.alert}>{message}</Text> : null}
      <Field label="E-mail" placeholder="seu@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
      <Field label="Senha" placeholder="••••••••" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <Button title="Entrar" icon="log-in-outline" onPress={submit} loading={busy} />
      <Text style={authStyles.footer}>
        Não possui cadastro?{' '}
        <Text style={authStyles.link} onPress={() => navigation.navigate('Register')}>
          Cadastre-se
        </Text>
      </Text>
    </AuthLayout>
  );
}
