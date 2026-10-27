import { useState } from 'react';
import { Text } from 'react-native';

import { AuthLayout, authStyles } from '../../components/AuthLayout.js';
import { Button, Field } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction } from '../../hooks/useApi.js';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { busy, run } = useAction();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState('');

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setMessage('Preencha nome, e-mail e senha para se cadastrar.');
      return;
    }
    setMessage('');
    await run(
      () => register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password }),
      {
        onError: (error) => {
          setMessage(`Falha no cadastro: ${error.message}`);
          return true;
        },
      },
    );
  }

  return (
    <AuthLayout title="Cadastro" icon="person-add-outline">
      {message ? <Text style={authStyles.alert}>{message}</Text> : null}
      <Field label="Nome completo" placeholder="Maria Silva" value={form.name} onChangeText={update('name')} />
      <Field label="E-mail" placeholder="maria@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={update('email')} />
      <Field label="Telefone" placeholder="(00) 90000-0000" keyboardType="phone-pad" value={form.phone} onChangeText={update('phone')} />
      <Field label="Senha" placeholder="••••••••" secureTextEntry value={form.password} onChangeText={update('password')} hint="Mínimo de 6 caracteres." />
      <Button title="Criar conta" icon="person-add-outline" onPress={submit} loading={busy} />
      <Text style={authStyles.footer}>
        Já tem conta?{' '}
        <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
          Entrar
        </Text>
      </Text>
    </AuthLayout>
  );
}
