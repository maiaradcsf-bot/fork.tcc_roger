import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../services/index.js';
import { colors, radius, spacing } from '../theme/index.js';
import { formatPrice } from '../utils/format.js';

const MAX_HISTORY = 12;
const MAX_LENGTH = 1000;

const plainText = (text) => String(text || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[-*]\s+/gm, '• ');

export function AssistantChat({ role, greeting, quickQuestions = [], onAddSuggestion }) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const historyRef = useRef([]);
  const [messages, setMessages] = useState([{ id: 'greeting', role: 'assistant', text: greeting }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [added, setAdded] = useState({});

  function push(message) {
    setMessages((current) => [...current, { id: `${Date.now()}-${Math.random()}`, ...message }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  async function send(raw) {
    const text = String(raw || '').trim().slice(0, MAX_LENGTH);
    if (!text || sending) return;
    setInput('');
    push({ role: 'user', text });
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];
    setSending(true);
    try {
      const data = await api.ai.chat(role, historyRef.current.slice(-MAX_HISTORY));
      const reply = data?.reply || '';
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
      push({ role: 'assistant', text: reply, suggestions: data?.suggestions || [] });
    } catch (error) {
      historyRef.current = historyRef.current.slice(0, -1);
      push({ role: 'assistant', text: `Não foi possível responder: ${error.message}`, failed: true });
    } finally {
      setSending(false);
    }
  }

  async function addSuggestion(item) {
    if (!onAddSuggestion) return;
    setAdded((current) => ({ ...current, [item.product_id]: 'busy' }));
    const ok = await onAddSuggestion(item);
    setAdded((current) => ({ ...current, [item.product_id]: ok ? 'done' : undefined }));
  }

  function renderMessage({ item }) {
    const mine = item.role === 'user';
    return (
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, item.failed && styles.failed]}>
        <Text style={[styles.text, mine && styles.mineText]}>{mine ? item.text : plainText(item.text)}</Text>
        {(item.suggestions || []).map((suggestion) => {
          const state = added[suggestion.product_id];
          return (
            <View key={suggestion.product_id} style={styles.suggestion}>
              <View style={styles.flex}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {suggestion.name}
                </Text>
                <Text style={styles.suggestionMeta}>
                  {suggestion.quantity} un. · {formatPrice(suggestion.price)} · estoque {suggestion.stock}
                </Text>
              </View>
              {onAddSuggestion ? (
                <Pressable
                  onPress={() => addSuggestion(suggestion)}
                  disabled={Boolean(state)}
                  style={({ pressed }) => [styles.add, state === 'done' && styles.addDone, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar ${suggestion.name} ao carrinho`}
                >
                  {state === 'busy' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name={state === 'done' ? 'checkmark' : 'cart-outline'} size={18} color={state === 'done' ? colors.white : colors.primary} />
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          sending ? (
            <View style={[styles.bubble, styles.theirs, styles.typing]}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.typingText}>Pensando...</Text>
            </View>
          ) : null
        }
      />
      {messages.length <= 1 && quickQuestions.length ? (
        <View style={styles.quick}>
          {quickQuestions.map((question) => (
            <Pressable key={question} onPress={() => send(question)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={styles.chipText}>{question}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Digite sua pergunta..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={MAX_LENGTH}
          multiline
          onSubmitEditing={() => send(input)}
          blurOnSubmit
          returnKeyType="send"
        />
        <Pressable
          onPress={() => send(input)}
          disabled={sending || !input.trim()}
          style={({ pressed }) => [styles.send, (sending || !input.trim()) && styles.sendDisabled, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { paddingBottom: insets.bottom + spacing.xs }]}>As respostas são geradas por IA e podem conter erros.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  failed: { borderColor: colors.danger },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  mineText: { color: colors.white },
  typing: { flexDirection: 'row', alignItems: 'center' },
  typingText: { color: colors.muted, fontStyle: 'italic' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.light, borderRadius: radius.md, padding: spacing.sm },
  suggestionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggestionMeta: { fontSize: 12, color: colors.muted },
  add: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  addDone: { backgroundColor: colors.success, borderColor: colors.success },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  chipText: { fontSize: 13, color: colors.text },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.white },
  input: { flex: 1, maxHeight: 110, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  disclaimer: { fontSize: 11, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xs, backgroundColor: colors.white },
});
