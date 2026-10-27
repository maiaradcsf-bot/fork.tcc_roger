import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/index.js';
import { Button, ButtonRow, Field, styles as ui } from './ui.js';

export function QuantityModal({ visible, title, message, max, confirmLabel = 'Adicionar ao carrinho', onConfirm, onCancel }) {
  const [value, setValue] = useState('1');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setValue('1');
      setError('');
    }
  }, [visible]);

  function confirm() {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Informe uma quantidade válida (>=1).');
      return;
    }
    if (max !== undefined && quantity > max) {
      setError(`Quantidade máxima disponível: ${max}.`);
      return;
    }
    onConfirm(quantity);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={ui.title}>{title || 'Selecionar quantidade'}</Text>
          <Text style={ui.muted}>{message || 'Informe a quantidade desejada.'}</Text>
          <Field
            label="Quantidade"
            keyboardType="number-pad"
            value={value}
            onChangeText={(text) => {
              setValue(text.replace(/[^0-9]/g, ''));
              setError('');
            }}
            hint={max !== undefined ? `Máximo disponível: ${max}` : undefined}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ButtonRow style={styles.actions}>
            <Button title="Cancelar" variant="outlineSecondary" onPress={onCancel} />
            <Button title={confirmLabel} onPress={confirm} />
          </ButtonRow>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
  box: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  error: { color: colors.danger },
  actions: { justifyContent: 'flex-end' },
});
