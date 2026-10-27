import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme/index.js';
import { ErrorCard } from './ui.js';

export function ActionMenu({ actions, title = 'Ações', icon = 'ellipsis-vertical', bordered = false }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const visible = (actions || []).filter(Boolean);
  if (!visible.length) return null;

  function choose(action) {
    setOpen(false);
    setTimeout(action.onPress, 250);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.menuButton, bordered && styles.menuButtonBordered, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Ionicons name={icon} size={20} color={colors.secondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {title}
            </Text>
            {visible.map((action) => {
              const tint = action.destructive ? colors.danger : action.color || colors.text;
              return (
                <Pressable
                  key={action.label}
                  onPress={() => choose(action)}
                  disabled={action.disabled}
                  style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed, action.disabled && styles.disabled]}
                  accessibilityRole="button"
                >
                  <Ionicons name={action.icon || 'chevron-forward'} size={20} color={tint} />
                  <Text style={[styles.sheetLabel, { color: tint }]}>{action.label}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setOpen(false)} style={({ pressed }) => [styles.cancel, pressed && styles.sheetItemPressed]}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function ListToolbar({ search, onSearch, placeholder = 'Buscar...', primary, actions, menuTitle = 'Mais ações', count, children }) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarRow}>
        {onSearch ? (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={onSearch}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={() => onSearch('')} hitSlop={8} accessibilityLabel="Limpar busca">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.flex} />
        )}
        {primary ? (
          <Pressable
            onPress={primary.onPress}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={primary.label}
          >
            <Ionicons name={primary.icon || 'add'} size={22} color={colors.white} />
          </Pressable>
        ) : null}
        <ActionMenu actions={actions} title={menuTitle} bordered />
      </View>
      {children}
      {count !== undefined ? <Text style={styles.count}>{count === 1 ? '1 registro' : `${count} registros`}</Text> : null}
    </View>
  );
}

export function ListItem({ leading, title, subtitle, details, meta, metaColor, badge, onPress, actions, actionsTitle, children }) {
  const lines = (details || []).filter(Boolean);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.item, pressed && onPress && styles.itemPressed]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title || '—'}
          </Text>
          {meta ? <Text style={[styles.meta, metaColor && { color: metaColor }]}>{meta}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {lines.length ? (
          <Text style={styles.details} numberOfLines={1}>
            {lines.join('  ·  ')}
          </Text>
        ) : null}
        {badge ? <View style={styles.badgeRow}>{badge}</View> : null}
        {children}
      </View>
      <ActionMenu actions={actions} title={actionsTitle || title} />
    </Pressable>
  );
}

export function Pill({ label, background = colors.light, color = colors.text }) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ListScreen({ data, renderItem, keyExtractor, header, footer, emptyMessage = 'Nenhum registro encontrado.', refreshing = false, onRefresh, error, onRetry }) {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={keyExtractor || ((item) => String(item.id))}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          <ErrorCard error={error} onRetry={onRetry} />
        </View>
      }
      ListFooterComponent={footer}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  separator: { height: spacing.sm },
  toolbar: { gap: spacing.sm },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  primary: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12, color: colors.muted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  itemPressed: { backgroundColor: colors.light },
  leading: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 14, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text },
  details: { fontSize: 12, color: colors.muted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, maxWidth: '100%' },
  pillText: { fontSize: 11, fontWeight: '600' },
  menuButton: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  menuButtonBordered: { width: 42, height: 42, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, paddingTop: spacing.sm, paddingHorizontal: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetTitle: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  sheetItemPressed: { backgroundColor: colors.light },
  sheetLabel: { fontSize: 16 },
  disabled: { opacity: 0.4 },
  cancel: { marginTop: spacing.sm, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.background },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.text },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl * 2 },
  emptyText: { color: colors.muted, textAlign: 'center' },
});
