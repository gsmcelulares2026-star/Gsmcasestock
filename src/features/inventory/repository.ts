import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { seedSnapshot } from './data/seed';
import {
  AdjustmentInput,
  CreateModelInput,
  DashboardSummary,
  HookCellView,
  InventoryItem,
  InventorySnapshot,
  LogReason,
  Model,
  VariationType,
} from './types';

const STORAGE_KEY = 'hookstock.snapshot.v1';
const TOTAL_COLUMNS = 45;
const TOTAL_ROWS = 7;
const VARIATIONS: VariationType[] = ['silicone', 'colorida', 'carteira'];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readLocalSnapshot() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedSnapshot));
    return seedSnapshot;
  }

  return JSON.parse(raw) as InventorySnapshot;
}

async function writeLocalSnapshot(snapshot: InventorySnapshot) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

async function readSupabaseSnapshot(): Promise<InventorySnapshot> {
  const [brandsResponse, modelsResponse, inventoryResponse, logsResponse] = await Promise.all([
    supabase!.from('brands').select('*').order('name'),
    supabase!.from('models').select('*').order('column_index').order('row_index'),
    supabase!.from('inventory').select('*'),
    supabase!.from('logs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  return {
    brands: (brandsResponse.data ?? []).map((brand) => ({ id: brand.id, name: brand.name })),
    models: (modelsResponse.data ?? []).map((model) => ({
      id: model.id,
      brandId: model.brand_id,
      name: model.name,
      column: model.column_index,
      row: model.row_index,
      criticalThreshold: model.critical_threshold,
    })),
    inventory: (inventoryResponse.data ?? []).map((item) => ({
      id: item.id,
      modelId: item.model_id,
      variation: item.variation,
      quantity: item.quantity,
    })),
    logs: (logsResponse.data ?? []).map((log) => ({
      id: log.id,
      modelId: log.model_id,
      variation: log.variation,
      delta: log.delta,
      reason: log.reason as LogReason,
      note: log.note ?? undefined,
      createdAt: log.created_at,
    })),
  };
}

export async function getSnapshot() {
  if (isSupabaseConfigured) {
    try {
      return await readSupabaseSnapshot();
    } catch {
      return readLocalSnapshot();
    }
  }

  return readLocalSnapshot();
}

export function getModelInventory(snapshot: InventorySnapshot, modelId: string) {
  return VARIATIONS.reduce<Record<VariationType, number>>(
    (acc, variation) => {
      acc[variation] =
        snapshot.inventory.find((item) => item.modelId === modelId && item.variation === variation)?.quantity ?? 0;
      return acc;
    },
    { silicone: 0, colorida: 0, carteira: 0 },
  );
}

export function buildGrid(snapshot: InventorySnapshot, search = ''): HookCellView[][] {
  const normalizedSearch = search.trim().toLowerCase();

  return Array.from({ length: TOTAL_COLUMNS }, (_, columnIndex) =>
    Array.from({ length: TOTAL_ROWS }, (_, rowIndex) => {
      const column = columnIndex + 1;
      const row = rowIndex + 1;
      const model = snapshot.models.find((item) => item.column === column && item.row === row);

      if (!model) {
        return {
          key: `${column}-${row}`,
          column,
          row,
          isEmpty: true,
          highlight: false,
          totalStock: 0,
          critical: false,
          inventory: { silicone: 0, colorida: 0, carteira: 0 },
        };
      }

      const brandName = snapshot.brands.find((brand) => brand.id === model.brandId)?.name;
      const inventory = getModelInventory(snapshot, model.id);
      const totalStock = Object.values(inventory).reduce((sum, quantity) => sum + quantity, 0);
      const highlight =
        normalizedSearch.length > 0 &&
        `${brandName} ${model.name}`.toLowerCase().includes(normalizedSearch);
      const critical = Object.values(inventory).some((quantity) => quantity <= model.criticalThreshold);

      return {
        key: `${column}-${row}`,
        column,
        row,
        isEmpty: false,
        highlight,
        brandName,
        modelId: model.id,
        modelName: model.name,
        totalStock,
        critical,
        inventory,
      };
    }),
  );
}

export function buildDashboardSummary(snapshot: InventorySnapshot): DashboardSummary {
  const occupiedHooks = snapshot.models.length;
  const totalUnits = snapshot.inventory.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockItems: DashboardSummary['criticalItems'] = [];
  let zeroStockCount = 0;
  let lowStockCount = 0;

  snapshot.models.forEach((model) => {
    const inventory = getModelInventory(snapshot, model.id);
    const brand = snapshot.brands.find((item) => item.id === model.brandId)?.name ?? '';

    VARIATIONS.forEach((variation) => {
      const quantity = inventory[variation];
      if (quantity === 0) {
        zeroStockCount += 1;
      }
      if (quantity <= model.criticalThreshold) {
        lowStockCount += 1;
        lowStockItems.push({
          id: `${model.id}-${variation}`,
          label: `${brand} ${model.name}`,
          variation,
          quantity,
          position: `C${model.column}/L${model.row}`,
        });
      }
    });
  });

  const recentSalesCount = snapshot.logs
    .filter((log) => log.reason === 'venda' && log.delta < 0)
    .reduce((sum, log) => sum + Math.abs(log.delta), 0);

  return {
    totalUnits,
    occupiedHooks,
    totalHooks: TOTAL_COLUMNS * TOTAL_ROWS,
    lowStockCount,
    zeroStockCount,
    recentSalesCount,
    criticalItems: lowStockItems.slice(0, 8),
  };
}

function upsertInventoryEntry(inventory: InventoryItem[], modelId: string, variation: VariationType, quantity: number) {
  const existing = inventory.find((item) => item.modelId === modelId && item.variation === variation);

  if (existing) {
    existing.quantity = Math.max(0, quantity);
    return;
  }

  inventory.push({
    id: makeId('inv'),
    modelId,
    variation,
    quantity: Math.max(0, quantity),
  });
}

export async function createModel(input: CreateModelInput) {
  const snapshot = await readLocalSnapshot();
  const occupied = snapshot.models.some((model) => model.column === input.column && model.row === input.row);

  if (occupied) {
    throw new Error('Ja existe um modelo nessa posicao.');
  }

  let brand = snapshot.brands.find((item) => item.name.toLowerCase() === input.brandName.trim().toLowerCase());

  if (!brand) {
    brand = { id: makeId('brand'), name: input.brandName.trim() };
    snapshot.brands.push(brand);
  }

  const model: Model = {
    id: makeId('model'),
    brandId: brand.id,
    name: input.modelName.trim(),
    column: input.column,
    row: input.row,
    criticalThreshold: input.criticalThreshold,
  };

  snapshot.models.push(model);

  VARIATIONS.forEach((variation) => {
    upsertInventoryEntry(snapshot.inventory, model.id, variation, input.initialInventory?.[variation] ?? 0);
  });

  await writeLocalSnapshot(snapshot);
  return model;
}

export async function updateModel(modelId: string, input: CreateModelInput) {
  const snapshot = await readLocalSnapshot();
  const model = snapshot.models.find((item) => item.id === modelId);

  if (!model) {
    throw new Error('Modelo nao encontrado.');
  }

  const occupied = snapshot.models.some(
    (item) => item.id !== modelId && item.column === input.column && item.row === input.row,
  );

  if (occupied) {
    throw new Error('Ja existe outro modelo nessa posicao.');
  }

  let brand = snapshot.brands.find((item) => item.name.toLowerCase() === input.brandName.trim().toLowerCase());

  if (!brand) {
    brand = { id: makeId('brand'), name: input.brandName.trim() };
    snapshot.brands.push(brand);
  }

  model.brandId = brand.id;
  model.name = input.modelName.trim();
  model.column = input.column;
  model.row = input.row;
  model.criticalThreshold = input.criticalThreshold;

  await writeLocalSnapshot(snapshot);
  return model;
}

export async function deleteModel(modelId: string) {
  const snapshot = await readLocalSnapshot();

  snapshot.models = snapshot.models.filter((item) => item.id !== modelId);
  snapshot.inventory = snapshot.inventory.filter((item) => item.modelId !== modelId);
  snapshot.logs = snapshot.logs.filter((item) => item.modelId !== modelId);

  await writeLocalSnapshot(snapshot);
}

export async function adjustInventory(input: AdjustmentInput) {
  const snapshot = await readLocalSnapshot();
  const current = snapshot.inventory.find((item) => item.modelId === input.modelId && item.variation === input.variation);
  const nextQuantity = Math.max(0, (current?.quantity ?? 0) + input.delta);

  upsertInventoryEntry(snapshot.inventory, input.modelId, input.variation, nextQuantity);

  snapshot.logs.unshift({
    id: makeId('log'),
    modelId: input.modelId,
    variation: input.variation,
    delta: input.delta,
    reason: input.reason,
    note: input.note,
    createdAt: new Date().toISOString(),
  });

  await writeLocalSnapshot(snapshot);
}

export async function exportCsv(snapshot: InventorySnapshot) {
  const header = ['Marca', 'Modelo', 'Coluna', 'Linha', 'Variacao', 'Quantidade'];
  const rows = snapshot.models.flatMap((model) => {
    const brand = snapshot.brands.find((item) => item.id === model.brandId)?.name ?? '';
    const inventory = getModelInventory(snapshot, model.id);

    return VARIATIONS.map((variation) =>
      [brand, model.name, model.column, model.row, variation, inventory[variation]].join(','),
    );
  });

  return [header.join(','), ...rows].join('\n');
}
