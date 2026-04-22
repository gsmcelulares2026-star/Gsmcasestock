import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../features/auth/AuthContext';
import { useCreateModel, useDeleteModel, useInventorySnapshot, useUpdateModel } from '../features/inventory/hooks';
import { RootStackParamList } from '../navigation/AppNavigator';
import { theme } from '../theme';

const variationLabels = {
  silicone: 'Silicone',
  colorida: 'Colorida',
  carteira: 'Carteira',
} as const;

export function NewModelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'NewModel'>>();
  const { isConfigured, profile } = useAuth();
  const modelId = route.params?.modelId;
  const createMutation = useCreateModel();
  const updateMutation = useUpdateModel();
  const deleteMutation = useDeleteModel();
  const { data: snapshot } = useInventorySnapshot();

  const existingModel = snapshot?.models.find((item) => item.id === modelId);
  const existingBrand = snapshot?.brands.find((item) => item.id === existingModel?.brandId)?.name ?? '';
  const canManageCatalog = profile?.role === 'owner' || profile?.role === 'manager' || !isConfigured;

  const [brandName, setBrandName] = useState(existingBrand);
  const [modelName, setModelName] = useState(existingModel?.name ?? '');
  const [column, setColumn] = useState(existingModel?.column ?? 1);
  const [row, setRow] = useState(existingModel?.row ?? 1);
  const [criticalThresholds, setCriticalThresholds] = useState({
    silicone: existingModel?.criticalThresholds.silicone ?? null,
    colorida: existingModel?.criticalThresholds.colorida ?? null,
    carteira: existingModel?.criticalThresholds.carteira ?? null,
  });

  useEffect(() => {
    navigation.setOptions({ title: modelId ? 'Editar modelo' : 'Novo modelo' });
  }, [modelId, navigation]);

  useEffect(() => {
    if (!existingModel) {
      return;
    }

    setBrandName(existingBrand);
    setModelName(existingModel.name);
    setColumn(existingModel.column);
    setRow(existingModel.row);
    setCriticalThresholds({
      silicone: existingModel.criticalThresholds.silicone ?? null,
      colorida: existingModel.criticalThresholds.colorida ?? null,
      carteira: existingModel.criticalThresholds.carteira ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingModel?.id]);

  async function handleSubmit() {
    if (!canManageCatalog) {
      Alert.alert('Sem permissao', 'Seu perfil nao pode cadastrar ou editar modelos.');
      return;
    }

    if (!brandName.trim() || !modelName.trim()) {
      Alert.alert('Campos obrigatorios', 'Informe a marca e o modelo.');
      return;
    }

    try {
      const input = {
        brandName,
        modelName,
        column,
        row,
        criticalThresholds,
        initialInventory: { silicone: 0, colorida: 0, carteira: 0 },
      };

      if (modelId) {
        await updateMutation.mutateAsync({ modelId, input });
      } else {
        await createMutation.mutateAsync(input);
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Nao foi possivel cadastrar', error instanceof Error ? error.message : 'Tente novamente.');
    }
  }

  async function handleDelete() {
    if (!modelId) {
      return;
    }

    if (!canManageCatalog) {
      Alert.alert('Sem permissao', 'Seu perfil nao pode excluir modelos.');
      return;
    }

    Alert.alert('Remover modelo', 'Isso apaga o modelo e seu historico local.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteMutation.mutateAsync(modelId);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados do modelo</Text>

        <Field label="Marca">
          <TextInput
            onChangeText={setBrandName}
            placeholder="Ex: Apple"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={brandName}
          />
        </Field>

        <Field label="Modelo">
          <TextInput
            onChangeText={setModelName}
            placeholder="Ex: iPhone 15"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={modelName}
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posicionamento no painel</Text>
        <Stepper label="Coluna" max={45} min={1} onChange={setColumn} value={column} />
        <Stepper label="Linha" max={7} min={1} onChange={setRow} value={row} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Limite critico por categoria</Text>
        <Text style={styles.helperText}>Deixe como vazio para nao considerar alerta nessa variacao.</Text>
        {(
          Object.keys(variationLabels) as Array<keyof typeof variationLabels>
        ).map((variation) => (
          <ThresholdField
            key={variation}
            label={variationLabels[variation]}
            value={criticalThresholds[variation]}
            onChange={(value) =>
              setCriticalThresholds((current) => ({
                ...current,
                [variation]: value,
              }))
            }
          />
        ))}
      </View>

      <Pressable
        disabled={!canManageCatalog || createMutation.isPending || updateMutation.isPending}
        onPress={handleSubmit}
        style={styles.submitButton}
      >
        <Text style={styles.submitText}>
          {createMutation.isPending || updateMutation.isPending
            ? 'Salvando...'
            : modelId
              ? 'Salvar alteracoes'
              : 'Salvar modelo'}
        </Text>
      </Pressable>

      {modelId ? (
        <Pressable disabled={!canManageCatalog || deleteMutation.isPending} onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>{deleteMutation.isPending ? 'Removendo...' : 'Excluir modelo'}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepperButton}>
          <Text style={styles.stepperText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepperButton}>
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ThresholdField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const displayValue = value === null ? '' : String(value);

  return (
    <View style={styles.thresholdRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.thresholdControls}>
        <Pressable onPress={() => onChange(null)} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Sem alerta</Text>
        </Pressable>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(text) => {
            const normalized = text.trim();
            if (!normalized) {
              onChange(null);
              return;
            }

            const parsed = Number(normalized);
            onChange(Number.isNaN(parsed) ? null : Math.max(0, parsed));
          }}
          placeholder="Ex: 1"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.thresholdInput}
          value={displayValue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 16 },
  section: {
    padding: 18,
    gap: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  fieldLabel: { color: theme.colors.textMuted, fontWeight: '600' },
  input: {
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  helperText: { color: theme.colors.textMuted, lineHeight: 20 },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  thresholdControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  clearButtonText: { color: theme.colors.text, fontWeight: '700', fontSize: 12 },
  thresholdInput: {
    width: 78,
    textAlign: 'center',
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  stepperText: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  stepperValue: { width: 36, textAlign: 'center', color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  submitButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  deleteButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b1c27',
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  deleteText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
