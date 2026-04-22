import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { shareHistoryPdf, shareInventoryCsv } from '../features/inventory/export';
import { useDashboardSummary, useInventorySnapshot } from '../features/inventory/hooks';
import { RootStackParamList } from '../navigation/AppNavigator';
import { theme } from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const { data: summary } = useDashboardSummary();
  const { data: snapshot } = useInventorySnapshot();

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>HookStock</Text>
        <Text style={styles.title}>Painel rapido do estoque em tempo real</Text>
        <Text style={styles.subtitle}>
          Acompanhe ruptura, volume total e parta para a acao sem sair do celular.
        </Text>

        <View style={styles.heroActions}>
          <Pressable onPress={() => navigation.navigate('NewModel')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Cadastrar modelo</Text>
          </Pressable>

          <Pressable
            disabled={!snapshot}
            onPress={() => snapshot && shareInventoryCsv(snapshot)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Exportar CSV</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Itens em estoque" value={summary?.totalUnits ?? 0} />
        <StatCard label="Ganchos ocupados" value={`${summary?.occupiedHooks ?? 0}/${summary?.totalHooks ?? 315}`} />
        <StatCard label="Alertas criticos" tone="warning" value={summary?.lowStockCount ?? 0} />
        <StatCard label="Saidas recentes" tone="success" value={summary?.recentSalesCount ?? 0} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Ruptura e estoque baixo</Text>
          <Text style={styles.panelCaption}>{summary?.zeroStockCount ?? 0} variacoes zeradas</Text>
        </View>

        <View style={styles.alertList}>
          {summary?.criticalItems.map((item) => (
            <View key={item.id} style={styles.alertCard}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.alertLabel}>{item.label}</Text>
                <Text style={styles.alertMeta}>
                  {item.position} · {item.variation}
                </Text>
              </View>
              <Text style={styles.alertQty}>{item.quantity}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Relatorios</Text>
          <Text style={styles.panelCaption}>Saidas e reposicao</Text>
        </View>

        <Pressable
          disabled={!snapshot}
          onPress={() => snapshot && shareHistoryPdf(snapshot)}
          style={styles.exportCard}
        >
          <Text style={styles.exportTitle}>Gerar PDF de movimentacoes</Text>
          <Text style={styles.exportText}>Compartilhe um resumo pronto para auditoria ou fechamento diario.</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning' | 'success';
}) {
  const toneColor =
    tone === 'warning' ? theme.colors.warning : tone === 'success' ? theme.colors.success : theme.colors.primary;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: toneColor }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 16 },
  hero: {
    padding: 20,
    gap: 12,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  eyebrow: { color: theme.colors.secondary, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  subtitle: { color: theme.colors.textMuted, fontSize: 15, lineHeight: 22 },
  heroActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  secondaryButtonText: { color: theme.colors.text, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    minWidth: 150,
    padding: 16,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statAccent: { width: 38, height: 5, borderRadius: 999 },
  statValue: { color: theme.colors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: theme.colors.textMuted, fontSize: 13 },
  panel: {
    padding: 18,
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  panelHeader: { gap: 4 },
  panelTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  panelCaption: { color: theme.colors.textMuted, fontSize: 13 },
  alertList: { gap: 10 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 14,
  },
  alertLabel: { color: theme.colors.text, fontWeight: '700' },
  alertMeta: { color: theme.colors.textMuted, textTransform: 'capitalize' },
  alertQty: { color: theme.colors.warning, fontSize: 24, fontWeight: '800' },
  exportCard: {
    padding: 16,
    gap: 8,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#12294b',
  },
  exportTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  exportText: { color: theme.colors.textMuted, lineHeight: 20 },
});
