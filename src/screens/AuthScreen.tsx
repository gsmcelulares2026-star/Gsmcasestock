import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../features/auth/AuthContext';
import { theme } from '../theme';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim() || (mode === 'signup' && !fullName.trim())) {
      Alert.alert('Campos obrigatorios', 'Preencha os dados para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, fullName.trim());
        Alert.alert('Conta criada', 'Se o projeto exigir confirmacao por email, valide sua caixa de entrada.');
        setMode('signin');
      }
    } catch (error) {
      Alert.alert('Nao foi possivel autenticar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>GSM Stock Case</Text>
          <Text style={styles.title}>Entre na operacao conectada do estoque</Text>
          <Text style={styles.subtitle}>
            Quando o Supabase estiver configurado, o app usa login real, permissao por perfil e movimentacao segura via banco.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Pressable
              onPress={() => setMode('signin')}
              style={[styles.switchButton, mode === 'signin' && styles.switchButtonActive]}
            >
              <Text style={styles.switchText}>Entrar</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('signup')}
              style={[styles.switchButton, mode === 'signup' && styles.switchButtonActive]}
            >
              <Text style={styles.switchText}>Criar conta</Text>
            </Pressable>
          </View>

          {mode === 'signup' ? (
            <Field label="Nome completo">
              <TextInput
                onChangeText={setFullName}
                placeholder="Ex: Joao da loja"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={fullName}
              />
            </Field>
          ) : null}

          <Field label="Email">
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="voce@empresa.com"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={email}
            />
          </Field>

          <Field label="Senha">
            <TextInput
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </Field>

          <Pressable disabled={isSubmitting} onPress={handleSubmit} style={styles.submitButton}>
            <Text style={styles.submitText}>
              {isSubmitting ? 'Processando...' : mode === 'signin' ? 'Entrar no painel' : 'Criar conta'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 18 },
  hero: { gap: 10 },
  eyebrow: { color: theme.colors.secondary, fontWeight: '800', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '900', lineHeight: 36 },
  subtitle: { color: theme.colors.textMuted, lineHeight: 22 },
  card: {
    padding: 18,
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  switchRow: { flexDirection: 'row', gap: 10 },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSoft,
  },
  switchButtonActive: { backgroundColor: theme.colors.primary },
  switchText: { color: theme.colors.text, fontWeight: '700' },
  field: { gap: 8 },
  fieldLabel: { color: theme.colors.textMuted, fontWeight: '600' },
  input: {
    color: theme.colors.text,
    backgroundColor: '#132746',
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submitButton: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  submitText: { color: '#072119', fontWeight: '900', fontSize: 16 },
});
