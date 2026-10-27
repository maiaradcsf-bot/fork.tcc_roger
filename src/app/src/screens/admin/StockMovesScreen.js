import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, radius, spacing } from '../../theme/index.js';
import { formatDate, isoDateDaysAgo } from '../../utils/format.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function StockMovesScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const { run } = useAction();
  const [startDate, setStartDate] = useState(isoDateDaysAgo(30));
  const [endDate, setEndDate] = useState(isoDateDaysAgo(0));
  const filtersRef = useRef({ startDate: isoDateDaysAgo(30), endDate: isoDateDaysAgo(0) });
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.stock.listStockMoves(filtersRef.current));

  function applyFilter(start = startDate, end = endDate) {
    if ((start && !DATE_PATTERN.test(start)) || (end && !DATE_PATTERN.test(end))) {
      Alert.alert('Atenção', 'Informe as datas no formato AAAA-MM-DD.');
      return;
    }
    filtersRef.current = { startDate: start, endDate: end };
    reload();
  }

  function quickRange(days) {
    const start = isoDateDaysAgo(days);
    const end = isoDateDaysAgo(0);
    setStartDate(start);
    setEndDate(end);
    applyFilter(start, end);
  }

  function confirmRevert(move) {
    Alert.alert(
      'Voltar ao estoque',
      'Tem certeza que deseja voltar esta movimentação ao estoque? Uma movimentação de estorno será criada com a quantidade inversa.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Voltar ao estoque',
          onPress: () =>
            run(async () => {
              await api.admin.stock.revertStockMove(move.id);
              Alert.alert('Sucesso', 'Movimentação revertida e estoque devolvido com sucesso.');
              await reload();
            }),
        },
      ],
    );
  }

  if (loading && !data) return <Loading message="Carregando movimentações..." />;
  const moves = data || [];

  const canRevert = hasPermission('admin.stock.moves.delete');

  return (
    <ListScreen
      data={moves}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhuma movimentação de estoque encontrada."
      header={
        <ListToolbar
          primary={hasPermission('admin.stock.moves.create') ? { label: 'Nova movimentação', onPress: () => navigation.navigate('StockMoveForm') } : null}
          menuTitle="Período"
          actions={[
            { label: 'Últimos 7 dias', icon: 'calendar-outline', onPress: () => quickRange(7) },
            { label: 'Últimos 30 dias', icon: 'calendar-outline', onPress: () => quickRange(30) },
            { label: 'Últimos 90 dias', icon: 'calendar-outline', onPress: () => quickRange(90) },
            { label: 'Atualizar', icon: 'refresh-outline', onPress: reload },
          ]}
          count={moves.length}
        >
          <View style={styles.dates}>
            <DateInput value={startDate} onChangeText={setStartDate} label="Data inicial" />
            <Ionicons name="arrow-forward" size={16} color={colors.muted} />
            <DateInput value={endDate} onChangeText={setEndDate} label="Data final" />
            <Pressable onPress={() => applyFilter()} style={({ pressed }) => [styles.filter, pressed && styles.pressed]} accessibilityLabel="Filtrar">
              <Ionicons name="funnel-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </ListToolbar>
      }
      renderItem={({ item: move }) => {
        const positive = Number(move.quantity_change) > 0;
        const revertible = !move.is_reversal && !move.reverted_at && !move.order_id && canRevert;
        return (
          <ListItem
            leading={<Ionicons name={positive ? 'arrow-down-circle' : 'arrow-up-circle'} size={30} color={positive ? colors.success : colors.danger} />}
            title={move.product_name || move.product_id || move.stock_id}
            meta={`${positive ? '+' : ''}${move.quantity_change || '—'}`}
            metaColor={positive ? colors.success : colors.danger}
            subtitle={move.reason || '—'}
            details={[formatDate(move.created_at)]}
            badge={
              move.is_reversal ? (
                <Pill label="Estorno" background="#e2e3e5" color="#41464b" />
              ) : move.reverted_at ? (
                <Pill label="Revertida" background="#e2e3e5" color="#41464b" />
              ) : move.order_id ? (
                <Pill label={`Pedido #${move.order_id}`} />
              ) : null
            }
            actions={[revertible && { label: 'Voltar ao estoque', icon: 'return-up-back-outline', color: '#997404', onPress: () => confirmRevert(move) }]}
          />
        );
      }}
    />
  );
}

function DateInput({ value, onChangeText, label }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={colors.muted}
      keyboardType="numbers-and-punctuation"
      maxLength={10}
      style={styles.date}
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  filter: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  pressed: { opacity: 0.7 },
});
