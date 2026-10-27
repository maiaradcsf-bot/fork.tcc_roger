import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../theme/index.js';
import { mediaUrl } from '../utils/media.js';

const BUTTON_VARIANTS = {
  primary: { background: colors.primary, border: colors.primary, text: colors.white },
  success: { background: colors.success, border: colors.success, text: colors.white },
  danger: { background: colors.danger, border: colors.danger, text: colors.white },
  warning: { background: colors.warning, border: colors.warning, text: colors.text },
  info: { background: colors.info, border: colors.info, text: colors.text },
  secondary: { background: colors.secondary, border: colors.secondary, text: colors.white },
  outlinePrimary: { background: colors.white, border: colors.primary, text: colors.primary },
  outlineDanger: { background: colors.white, border: colors.danger, text: colors.danger },
  outlineSecondary: { background: colors.white, border: colors.secondary, text: colors.secondary },
  outlineWarning: { background: colors.white, border: colors.warning, text: '#997404' },
  outlineSuccess: { background: colors.white, border: colors.success, text: colors.success },
};

export function Screen({ children, refreshing = false, onRefresh, scroll = true, contentStyle }) {
  if (!scroll) return <View style={[styles.screen, styles.content, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, subtitle }) {
  return (
    <View style={styles.titleBox}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, small = false, icon, style }) {
  const palette = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.background, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={palette.text} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ButtonRow({ children, style }) {
  return <View style={[styles.buttonRow, style]}>{children}</View>;
}

export function Field({ label, hint, multiline = false, style, ...inputProps }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Badge({ label, background = colors.secondary, color = colors.white }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function InfoRow({ label, value, children }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {children || <Text style={styles.infoValue}>{value ?? '—'}</Text>}
    </View>
  );
}

export function Muted({ children, style }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function EmptyState({ message }) {
  return (
    <Card>
      <Text style={styles.empty}>{message}</Text>
    </Card>
  );
}

export function Loading({ message = 'Carregando...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

export function ErrorCard({ error, onRetry }) {
  if (!error) return null;
  return (
    <Card style={styles.errorCard}>
      <Text style={styles.errorText}>{error.message || 'Falha ao carregar dados.'}</Text>
      {onRetry ? <Button title="Tentar novamente" variant="outlineDanger" small onPress={onRetry} /> : null}
    </Card>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar...' }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={[styles.input, styles.search]}
      autoCapitalize="none"
      clearButtonMode="while-editing"
    />
  );
}

export function CheckboxRow({ label, checked, onToggle, disabled = false }) {
  return (
    <Pressable onPress={onToggle} disabled={disabled} style={styles.checkboxRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function ProductImage({ path, size = 48 }) {
  const uri = mediaUrl(path);
  if (!uri) {
    return (
      <View style={[styles.imagePlaceholder, { width: size, height: size }]}>
        <Ionicons name="image-outline" size={Math.round(size * 0.45)} color={colors.muted} />
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.sm }} resizeMode="cover" />;
}

export function StatCard({ title, subtitle, value, onPress, actionLabel }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      {onPress ? <Button title={actionLabel || 'Ver'} variant="outlinePrimary" small onPress={onPress} /> : null}
    </Card>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  titleBox: { gap: spacing.xs },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted },
  button: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 34, paddingHorizontal: spacing.md },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonText: { fontSize: 15, fontWeight: '600' },
  buttonTextSmall: { fontSize: 13 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text, backgroundColor: colors.white, minHeight: 44 },
  inputMultiline: { minHeight: 90 },
  search: { marginBottom: spacing.xs },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 12, fontWeight: '600' },
  infoRow: { gap: 2 },
  infoLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  infoValue: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorCard: { borderColor: colors.danger },
  errorText: { color: colors.danger },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: colors.text, flexShrink: 1 },
  imagePlaceholder: { backgroundColor: colors.light, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  statTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.primary },
});
