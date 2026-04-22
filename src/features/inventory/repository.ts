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

function normalizeThresholds(
  thresholds?: Partial<Record<VariationType, number | null>>,
): Partial<Record<VariationType, number | null>> {
  return {
    silicone: thresholds?.silicone ?? null,
    colorida: thresholds?.colorida ?? null,
    carteira: thresholds?.carteira ?? null,
  };
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  return supabase;
}

async function getSessionUserId() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user.id ?? null;
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

export async function shouldUseSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return Boolean(session);
}

async function mapSupabaseSnapshot(): Promise<InventorySnapshot> {
  const client = requireSupabase();
  const [brandsResponse, modelsResponse, inventoryResponse, logsResponse] = await Promise.all([
    client.from('brands').select('id, name, updated_at').order('name'),
    client
      .from('models')
      .select(
        'id, brand_id, name, column_index, row_index, critical_silicone_threshold, critical_colorida_threshold, critical_carteira_threshold, created_by',
      )
      .order('column_index')
      .order('row_index'),
    client.from('inventory').select('id, model_id, variation, quantity'),
    client
      .from('logs')
      .select('id, model_id, variation, delta, reason, note, actor_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const errors = [brandsResponse.error, modelsResponse.error, inventoryResponse.error, logsResponse.error].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0]!;
  }

  return {
    brands: (brandsResponse.data ?? []).map((brand) => ({
      id: brand.id,
      name: brand.name,
      updatedAt: brand.updated_at,
    })),
    models: (modelsResponse.data ?? []).map((model) => ({
      id: model.id,
      brandId: model.brand_id,
      name: model.name,
      column: model.column_index,
      row: model.row_index,
      criticalThresholds: normalizeThresholds({
        silicone: model.critical_silicone_threshold,
        colorida: model.critical_colorida_threshold,
        carteira: model.critical_carteira_threshold,
      }),
      createdBy: model.created_by,
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
      actorId: log.actor_id ?? undefined,
      createdAt: log.created_at,
    })),
  };
}

export async function getSnapshot() {
  if (await shouldUseSupabase()) {
    try {
      return await mapSupabaseSnapshot();
    } catch (error) {
      console.warn('[HookStock] Supabase query failed, falling back to local data:', error);
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
      const critical = VARIATIONS.some((variation) => {
        const threshold = model.criticalThresholds[variation];
        return threshold !== null && threshold !== undefined && inventory[variation] <= threshold;
      });

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
      const threshold = model.criticalThresholds[variation];
      if (threshold !== null && threshold !== undefined && quantity <= threshold) {
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

  const oneDayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const recentSalesCount = snapshot.logs
    .filter((log) => log.reason === 'venda' && log.delta < 0 && log.createdAt >= oneDayAgo)
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

async function getOrCreateBrandId(brandName: string) {
  const client = requireSupabase();
  const normalizedName = brandName.trim();
  const { data: existing, error: existingError } = await client
    .from('brands')
    .select('id, name')
    .ilike('name', normalizedName)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing.id;
  }

  const { data, error } = await client.from('brands').insert({ name: normalizedName }).select('id').single();
  if (error) {
    throw error;
  }

  return data.id;
}

export async function createModel(input: CreateModelInput) {
  if (await shouldUseSupabase()) {
    try {
      const client = requireSupabase();
      const brandId = await getOrCreateBrandId(input.brandName);
      const userId = await getSessionUserId();

      const { data: model, error: modelError } = await client
        .from('models')
        .insert({
          brand_id: brandId,
          name: input.modelName.trim(),
          column_index: input.column,
          row_index: input.row,
          critical_silicone_threshold: input.criticalThresholds.silicone ?? null,
          critical_colorida_threshold: input.criticalThresholds.colorida ?? null,
          critical_carteira_threshold: input.criticalThresholds.carteira ?? null,
          created_by: userId,
        })
        .select('id')
        .single();

      if (modelError) {
        throw modelError;
      }

      const inventoryRows = VARIATIONS.map((variation) => ({
        model_id: model.id,
        variation,
        quantity: input.initialInventory?.[variation] ?? 0,
      }));

      const { error: inventoryError } = await client.from('inventory').insert(inventoryRows);
      if (inventoryError) {
        throw inventoryError;
      }

      return model;
    } catch (error) {
      console.warn('[HookStock] Supabase createModel failed, falling back to local:', error);
    }
  }

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
    criticalThresholds: normalizeThresholds(input.criticalThresholds),
  };

  snapshot.models.push(model);

  VARIATIONS.forEach((variation) => {
    upsertInventoryEntry(snapshot.inventory, model.id, variation, input.initialInventory?.[variation] ?? 0);
  });

  await writeLocalSnapshot(snapshot);
  return model;
}

export async function updateModel(modelId: string, input: CreateModelInput) {
  if (await shouldUseSupabase()) {
    try {
      const client = requireSupabase();
      const brandId = await getOrCreateBrandId(input.brandName);
      const { error } = await client
        .from('models')
        .update({
          brand_id: brandId,
          name: input.modelName.trim(),
          column_index: input.column,
          row_index: input.row,
          critical_silicone_threshold: input.criticalThresholds.silicone ?? null,
          critical_colorida_threshold: input.criticalThresholds.colorida ?? null,
          critical_carteira_threshold: input.criticalThresholds.carteira ?? null,
        })
        .eq('id', modelId);

      if (error) {
        throw error;
      }

      return { id: modelId };
    } catch (error) {
      console.warn('[HookStock] Supabase updateModel failed, falling back to local:', error);
    }
  }

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
  model.criticalThresholds = normalizeThresholds(input.criticalThresholds);

  await writeLocalSnapshot(snapshot);
  return model;
}

export async function deleteModel(modelId: string) {
  if (await shouldUseSupabase()) {
    try {
      const client = requireSupabase();
      const { error } = await client.from('models').delete().eq('id', modelId);
      if (error) {
        throw error;
      }

      return;
    } catch (error) {
      console.warn('[HookStock] Supabase deleteModel failed, falling back to local:', error);
    }
  }

  const snapshot = await readLocalSnapshot();
  snapshot.models = snapshot.models.filter((item) => item.id !== modelId);
  snapshot.inventory = snapshot.inventory.filter((item) => item.modelId !== modelId);
  snapshot.logs = snapshot.logs.filter((item) => item.modelId !== modelId);
  await writeLocalSnapshot(snapshot);
}

export async function adjustInventory(input: AdjustmentInput) {
  if (await shouldUseSupabase()) {
    try {
      const client = requireSupabase();
      const { error } = await client.rpc('apply_inventory_log', {
        p_model_id: input.modelId,
        p_variation: input.variation,
        p_delta: input.delta,
        p_reason: input.reason,
        p_note: input.note ?? null,
      });

      if (error) {
        if (error.message.includes('INSUFFICIENT_STOCK')) {
          throw new Error('Estoque insuficiente para essa saida.');
        }

        if (error.message.includes('INSUFFICIENT_PERMISSIONS')) {
          throw new Error('Seu perfil nao tem permissao para movimentar estoque.');
        }

        throw error;
      }

      return;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Estoque insuficiente') || error.message.includes('permissao'))) {
        throw error;
      }
      console.warn('[HookStock] Supabase RPC failed, falling back to local adjustment:', error);
    }
  }

  const snapshot = await readLocalSnapshot();
  const current = snapshot.inventory.find((item) => item.modelId === input.modelId && item.variation === input.variation);
  const currentQty = current?.quantity ?? 0;

  if (input.delta < 0 && currentQty + input.delta < 0) {
    throw new Error('Estoque insuficiente para essa saida.');
  }

  const nextQuantity = currentQty + input.delta;

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

function escapeCsvField(value: string | number) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportCsv(snapshot: InventorySnapshot) {
  const header = ['Marca', 'Modelo', 'Coluna', 'Linha', 'Variacao', 'Quantidade'];
  const rows = snapshot.models.flatMap((model) => {
    const brand = snapshot.brands.find((item) => item.id === model.brandId)?.name ?? '';
    const inventory = getModelInventory(snapshot, model.id);

    return VARIATIONS.map((variation) =>
      [brand, model.name, model.column, model.row, variation, inventory[variation]]
        .map(escapeCsvField)
        .join(','),
    );
  });

  return [header.join(','), ...rows].join('\n');
}
