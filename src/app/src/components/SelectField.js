import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme/index.js';
import { Button, CheckboxRow, SearchBar, styles as ui } from './ui.js';

export function SelectField({ label, options, value, onChange, multiple = false, placeholder = 'Selecione...', hint }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const selected = multiple ? (Array.isArray(value) ? value : []) : value;

  const selectedLabels = multiple
    ? options.filter((option) => selected.includes(option.value)).map((option) => option.label)
    : [options.find((option) => option.value === selected)?.label].filter(Boolean);
  const summary = selectedLabels.length ? selectedLabels.join(', ') : placeholder;

  const filtered = options.filter((option) => option.label.toLowerCase().includes(term.trim().toLowerCase()));

  function choose(option) {
    if (multiple) {
      const next = selected.includes(option.value) ? selected.filter((item) => item !== option.value) : [...selected, option.value];
      onChange(next);
      return;
    }
    onChange(option.value);
    setOpen(false);
  }

  return (
    <View style={ui.field}>
      {label ? <Text style={ui.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={[ui.input, styles.trigger]} accessibilityRole="button">
        <Text style={[styles.triggerText, summary === placeholder && styles.placeholder]} numberOfLines={2}>
          {summary}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>
      {hint ? <Text style={ui.hint}>{hint}</Text> : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={ui.title}>{label || 'Selecionar'}</Text>
            <Button title={multiple ? 'Concluir' : 'Fechar'} small onPress={() => setOpen(false)} />
          </View>
          {options.length > 8 ? <SearchBar value={term} onChangeText={setTerm} /> : null}
          <FlatList
            data={filtered}
            keyExtractor={(option) => String(option.value)}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) =>
              multiple ? (
                <CheckboxRow label={item.label} checked={selected.includes(item.value)} onToggle={() => choose(item)} />
              ) : (
                <Pressable onPress={() => choose(item)} style={styles.option}>
                  <Text style={[styles.optionText, item.value === selected && styles.optionSelected]}>{item.label}</Text>
                </Pressable>
              )
            }
            ListEmptyComponent={<Text style={ui.empty}>Nenhuma opção disponível.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  triggerText: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.muted },
  caret: { fontSize: 16, color: colors.muted, marginLeft: spacing.sm },
  modal: { flex: 1, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { height: 1, backgroundColor: colors.border },
  option: { paddingVertical: spacing.md, borderRadius: radius.sm },
  optionText: { fontSize: 15, color: colors.text },
  optionSelected: { color: colors.primary, fontWeight: '700' },
});
