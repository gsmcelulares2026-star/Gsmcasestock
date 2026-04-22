import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../features/auth/AuthContext';
import { useAdjustInventory, useHookGrid } from '../features/inventory/hooks';
import { HookCellView, LogReason, VariationType } from '../features/inventory/types';
import { RootStackParamList } from '../navigation/AppNavigator';
import { theme } from '../theme';

const exitReasonOptions: LogReason[] = ['venda', 'defeito', 'brinde'];
const allReasonOptions: LogReason[] = ['venda', 'defeito', 'brinde', 'reposicao', 'ajuste'];
const variationLabels: Record<VariationType, string> = {
  silicone: 'Silicone',
  colorida: 'Colorida',
  carteira: 'Carteira',
};

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function HookMapScreen() {
  const navigation = useNavigation<Navigation>();
  const { isConfigured, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState<HookCellView | null>(null);
  const [selectedReason, setSelectedReason] = useState<LogReason>('venda');
  const { data: columns } = useHookGrid(search);
  const adjustMutation = useAdjustInventory();
  const canManageCatalog = profile?.role === 'owner' || profile?.role === 'manager' || !isConfigured;

  const highlightedCount = useMemo(
    () => columns?.flat().filter((cell) => cell.highlight).length ?? 0,
    [columns],
  );

  const refreshSelectedCell = useCallback(
    (modelId: string) => {
      if (!columns) return;
      for (const col of columns) {
        for (const cell of col) {
          if (cell.modelId === modelId) {
            setSelectedCell(cell);
            return;
          }
        }
      }
    },
    [columns],
  );

  // Keep selectedCell in sync when grid data refreshes
  useEffect(() => {
    if (selectedCell?.modelId && columns) {
      refreshSelectedCell(selectedCell.modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  async function handleAdjust(variation: VariationType, delta: number) {
    if (!selectedCell?.modelId) {
      return;
    }

    try {
      await adjustMutation.mutateAsync({
        modelId: selectedCell.modelId,
        variation,
        delta,
        reason: delta > 0 ? 'reposicao' : selectedReason,
      });

      if (delta < 0) {
        await Haptics.selectionAsync();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Erro', 'Nao foi possivel atualizar o estoque.');
    }
  }

  function handleEditModel() {
    if (!selectedCell?.modelId) {
      return;
    }

    setSelectedCell(null);
    navigation.navigate('NewModel', { modelId: selectedCell.modelId });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title}>Mapa de ganchos</Text>
          <Text style={styles.subtitle}>
            45 colunas x 7 linhas com scroll horizontal, ajuste rapido e edicao visivel no modal.
          </Text>
        </View>

        {canManageCatalog ? (
          <Pressable onPress={() => navigation.navigate('NewModel')} style={styles.addButton}>
            <Text style={styles.addButtonText}>Novo</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchCard}>
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar por marca ou modelo"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
          value={search}
        />
        <Text style={styles.searchMeta}>
          {search.trim() ? `${highlightedCount} resultados destacados` : 'Sem filtro aplicado'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {(columns ?? []).map((item, index) => (
          <View key={`column-${index + 1}`} style={styles.column}>
            <Text style={styles.columnTitle}>Col {index + 1}</Text>
            <View style={styles.columnCells}>
              {item.map((cell) => (
                <Pressable
                  key={cell.key}
                  onLongPress={() =>
                    !cell.isEmpty && canManageCatalog && navigation.navigate('NewModel', { modelId: cell.modelId })
                  }
                  onPress={() => (cell.isEmpty ? undefined : setSelectedCell(cell))}
                  style={[
                    styles.cell,
                    cell.isEmpty && styles.cellEmpty,
                    cell.critical && styles.cellCritical,
                    cell.highlight && styles.cellHighlight,
                  ]}
                >
                  <Text numberOfLines={2} style={styles.cellTitle}>
                    {cell.isEmpty ? `L${cell.row}` : cell.modelName}
                  </Text>
                  {!cell.isEmpty ? (
                    <View style={styles.cellStockRow}>
                      <Text style={styles.cellStock}>S {cell.inventory.silicone}</Text>
                      <Text style={styles.cellStock}>C {cell.inventory.colorida}</Text>
                      <Text style={styles.cellStock}>W {cell.inventory.carteira}</Text>
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>Vazio</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <QuickActionModal
        cell={selectedCell}
        onAdjust={handleAdjust}
        onClose={() => setSelectedCell(null)}
        canManageCatalog={canManageCatalog}
        onEditModel={handleEditModel}
        onSelectReason={setSelectedReason}
        reason={selectedReason}
        visible={Boolean(selectedCell)}
      />
    </View>
  );
}

function QuickActionModal({
  visible,
  cell,
  reason,
  onSelectReason,
  onAdjust,
  canManageCatalog,
  onEditModel,
  onClose,
}: {
  visible: boolean;
  cell: HookCellView | null;
  reason: LogReason;
  onSelectReason: (reason: LogReason) => void;
  onAdjust: (variation: VariationType, delta: number) => Promise<void>;
  canManageCatalog: boolean;
  onEditModel: () => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.modalTitle}>{cell?.brandName}</Text>
              <Text style={styles.modalSubtitle}>{cell?.modelName}</Text>
              <Text style={styles.modalPosition}>
                Gancho C{cell?.column}/L{cell?.row}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </View>

          {canManageCatalog ? (
            <View style={styles.managementCard}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.managementTitle}>Cadastro do modelo</Text>
                <Text style={styles.managementText}>Edite nome, marca, limite critico ou mova para outro gancho.</Text>
              </View>
              <Pressable onPress={onEditModel} style={styles.editButton}>
                <Text style={styles.editButtonText}>Editar modelo</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Motivo da saida</Text>
          <View style={styles.reasonWrap}>
            {exitReasonOptions.map((option) => (
              <Pressable
                key={option}
                onPress={() => onSelectReason(option)}
                style={[styles.reasonChip, reason === option && styles.reasonChipActive]}
              >
                <Text style={styles.reasonChipText}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Ajuste rapido de estoque</Text>
          <View style={styles.actionsList}>
            {cell &&
              (Object.keys(variationLabels) as VariationType[]).map((variation) => (
                <View key={variation} style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionLabel}>{variationLabels[variation]}</Text>
                    <Text style={styles.actionQty}>Atual: {cell.inventory[variation]}</Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <Pressable onPress={() => void onAdjust(variation, -1)} style={styles.minusButton}>
                      <Text style={styles.actionButtonText}>-</Text>
                    </Pressable>
                    <Pressable onPress={() => void onAdjust(variation, 1)} style={styles.plusButton}>
                      <Text style={styles.actionButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: theme.colors.textMuted, lineHeight: 20 },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  searchCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: { color: theme.colors.text, fontSize: 15 },
  searchMeta: { color: theme.colors.textMuted, fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  column: { width: 126, marginRight: 12, gap: 8 },
  columnTitle: { color: theme.colors.text, fontWeight: '700', paddingLeft: 4 },
  columnCells: { gap: 8 },
  cell: {
    minHeight: 86,
    padding: 10,
    gap: 8,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cellEmpty: { opacity: 0.65 },
  cellCritical: { borderColor: theme.colors.danger },
  cellHighlight: { backgroundColor: '#18355f' },
  cellTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 13, minHeight: 32 },
  cellStockRow: { gap: 3 },
  cellStock: { color: theme.colors.textMuted, fontSize: 11 },
  emptyText: { color: theme.colors.textMuted, fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  modalCard: {
    padding: 20,
    gap: 16,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
  },
  modalHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  modalTitle: { color: theme.colors.textMuted, fontWeight: '600' },
  modalSubtitle: { color: theme.colors.text, fontSize: 22, fontWeight: '800' },
  modalPosition: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  closeText: { color: theme.colors.primary, fontWeight: '700' },
  managementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSoft,
  },
  managementTitle: { color: theme.colors.text, fontWeight: '700' },
  managementText: { color: theme.colors.textMuted, lineHeight: 18, maxWidth: '92%' },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  editButtonText: { color: '#fff', fontWeight: '800' },
  sectionTitle: { color: theme.colors.textMuted, fontWeight: '600' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSoft,
  },
  reasonChipActive: { backgroundColor: theme.colors.secondary },
  reasonChipText: { color: theme.colors.text, textTransform: 'capitalize', fontWeight: '600' },
  actionsList: { gap: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#12294b',
  },
  actionLabel: { color: theme.colors.text, fontWeight: '700' },
  actionQty: { color: theme.colors.textMuted },
  actionButtons: { flexDirection: 'row', gap: 8 },
  minusButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#4a2130',
  },
  plusButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#1e4a3c',
  },
  actionButtonText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
