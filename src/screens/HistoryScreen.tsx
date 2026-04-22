import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { useInventorySnapshot, useStockLogs } from '../features/inventory/hooks';
import { theme } from '../theme';

export function HistoryScreen() {
  const { data: logs } = useStockLogs();
  const { data: snapshot } = useInventorySnapshot();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historico de movimentacoes</Text>
        <Text style={styles.subtitle}>Saidas, entradas e ajustes ordenados do mais recente ao mais antigo.</Text>
      </View>

      <FlashList
        estimatedItemSize={80}
        contentContainerStyle={styles.content}
        data={logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const model = snapshot?.models.find((modelItem) => modelItem.id === item.modelId);
          const brand = snapshot?.brands.find((brandItem) => brandItem.id === model?.brandId)?.name;
          const tone = item.delta < 0 ? theme.colors.danger : theme.colors.success;

          return (
            <View style={styles.card}>
              <View style={styles.deltaPill}>
                <Text style={[styles.deltaText, { color: tone }]}>{item.delta > 0 ? `+${item.delta}` : item.delta}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.modelLabel}>
                  {brand} {model?.name}
                </Text>
                <Text style={styles.meta}>
                  {item.variation} | {item.reason}
                </Text>
              </View>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: theme.colors.textMuted, lineHeight: 20 },
  content: { padding: 16, paddingTop: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  deltaPill: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSoft,
  },
  deltaText: { fontSize: 16, fontWeight: '800' },
  modelLabel: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, textTransform: 'capitalize' },
  date: { color: theme.colors.textMuted, fontSize: 12 },
});
