import { Ionicons } from '@expo/vector-icons';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme/index.js';

const BACKGROUND = require('../../assets/background.jpg');
const LOGO_SESI = require('../../assets/logo-sesi.png');
const LOGO_SENAI = require('../../assets/logo-senai.png');

export function AuthLayout({ title, icon, children }) {
  return (
    <View style={styles.flex}>
      <Image source={BACKGROUND} style={styles.background} resizeMode="cover" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <View style={styles.header}>
                {icon ? (
                  <View style={styles.iconCircle}>
                    <Ionicons name={icon} size={26} color={colors.white} />
                  </View>
                ) : (
                  <Image source={LOGO_SESI} style={styles.logo} resizeMode="contain" accessibilityLabel="Logo SESI" />
                )}
                <Text style={styles.title}>{title}</Text>
              </View>
              {children}
            </View>
            <View style={styles.brands}>
              {icon ? <Image source={LOGO_SESI} style={styles.brand} resizeMode="contain" accessibilityLabel="SESI" /> : null}
              <Image source={LOGO_SENAI} style={styles.brand} resizeMode="contain" accessibilityLabel="SENAI" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  alert: { color: '#842029', backgroundColor: '#f8d7da', borderColor: '#f5c2c7', borderWidth: 1, padding: spacing.md, borderRadius: radius.sm },
  footer: { textAlign: 'center', color: colors.muted, marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: '600' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  logo: { width: 180, height: 58, borderRadius: radius.sm },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', color: colors.text, lineHeight: 26 },
  brands: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  brand: { width: 96, height: 30, borderRadius: 4 },
});
