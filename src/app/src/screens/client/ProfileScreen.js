import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button, Card, Field, Label, Loading, ProductImage, Screen, Title } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { spacing } from '../../theme/index.js';
import { pickedFile } from '../../utils/media.js';

const EMPTY = { name: '', email: '', phone: '', photoPath: '', password: '', passwordConfirm: '', currentPassword: '' };

export default function ClientProfileScreen() {
  const { hasPermission, refreshProfile, signOut } = useAuth();
  const { busy, run } = useAction();
  const upload = useAction();
  const [form, setForm] = useState(EMPTY);
  const { data, loading, refreshing, refresh } = useLoader(() => api.client.getProfile(), { reloadOnFocus: false });
  const canEdit = hasPermission('clients.profile.edit');

  useEffect(() => {
    if (!data) return;
    setForm({ ...EMPTY, name: data.name || '', email: data.email || '', phone: data.phone || '', photoPath: data.photo_path || '' });
  }, [data]);

  if (loading && !data) return <Loading />;
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    await upload.run(async () => {
      const response = await api.client.uploadProfilePhoto(pickedFile(result.assets[0], 'perfil.jpg', 'image/jpeg'));
      setForm((current) => ({ ...current, photoPath: response.url || '' }));
      Alert.alert('Sucesso', 'Foto de perfil enviada com sucesso.');
    });
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) {
      Alert.alert('Atenção', 'Nome e e-mail são obrigatórios.');
      return;
    }
    if (form.password && form.password !== form.passwordConfirm) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }
    if (form.password && !form.currentPassword) {
      Alert.alert('Atenção', 'Informe a senha atual para trocar a senha.');
      return;
    }
    await run(async () => {
      const response = await api.client.updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        photoPath: form.photoPath || undefined,
        password: form.password || undefined,
        currentPassword: form.currentPassword || undefined,
      });
      setForm((current) => ({ ...current, password: '', passwordConfirm: '', currentPassword: '' }));
      await refreshProfile();
      Alert.alert('Sucesso', response?.message || 'Perfil atualizado com sucesso.');
    });
  }

  function confirmSignOut() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title subtitle="Atualize seus dados de contato, senha e foto de perfil.">Perfil</Title>
      <Card>
        <Label>Foto de perfil</Label>
        <View style={styles.photo}>
          <ProductImage path={form.photoPath} size={96} />
          {canEdit ? <Button title="Escolher foto" variant="outlinePrimary" small onPress={pickPhoto} loading={upload.busy} /> : null}
        </View>
        <Field label="Nome" value={form.name} onChangeText={update('name')} editable={canEdit} />
        <Field label="E-mail" value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" editable={canEdit} />
        <Field label="Telefone" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" editable={canEdit} />
        {canEdit ? (
          <>
            <Field label="Nova senha" value={form.password} onChangeText={update('password')} secureTextEntry placeholder="Deixe em branco para manter a senha atual" />
            <Field label="Confirmar senha" value={form.passwordConfirm} onChangeText={update('passwordConfirm')} secureTextEntry placeholder="Repita a nova senha" />
            <Field label="Senha atual" value={form.currentPassword} onChangeText={update('currentPassword')} secureTextEntry placeholder="Obrigatória apenas para trocar a senha" />
            <Button title="Salvar alterações" onPress={save} loading={busy} disabled={upload.busy} />
          </>
        ) : null}
      </Card>
      <Button title="Sair" variant="outlineDanger" onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
