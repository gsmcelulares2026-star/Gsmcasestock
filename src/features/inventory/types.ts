export type VariationType = 'silicone' | 'colorida' | 'carteira';
export type LogReason = 'venda' | 'defeito' | 'brinde' | 'reposicao' | 'ajuste';

export interface Brand {
  id: string;
  name: string;
  updatedAt?: string;
}

export interface Model {
  id: string;
  brandId: string;
  name: string;
  column: number;
  row: number;
  criticalThresholds: Partial<Record<VariationType, number | null>>;
  createdBy?: string | null;
}

export interface InventoryItem {
  id: string;
  modelId: string;
  variation: VariationType;
  color: string;
  quantity: number;
}

export interface StockLog {
  id: string;
  modelId: string;
  variation: VariationType;
  color: string;
  delta: number;
  reason: LogReason;
  note?: string;
  actorId?: string | null;
  createdAt: string;
}

export interface InventorySnapshot {
  brands: Brand[];
  models: Model[];
  inventory: InventoryItem[];
  logs: StockLog[];
}

export interface HookCellView {
  key: string;
  column: number;
  row: number;
  isEmpty: boolean;
  highlight: boolean;
  brandName?: string;
  modelId?: string;
  modelName?: string;
  totalStock: number;
  critical: boolean;
  inventory: Record<VariationType, number>;
  colorInventory?: Record<VariationType, Array<{ color: string; quantity: number }>>;
}

export interface DashboardSummary {
  totalUnits: number;
  occupiedHooks: number;
  totalHooks: number;
  lowStockCount: number;
  zeroStockCount: number;
  recentSalesCount: number;
  criticalItems: Array<{
    id: string;
    label: string;
    variation: VariationType;
    quantity: number;
    position: string;
  }>;
}

export interface AdjustmentInput {
  modelId: string;
  variation: VariationType;
  color: string;
  delta: number;
  reason: LogReason;
  note?: string;
}

export interface CreateModelInput {
  brandName: string;
  modelName: string;
  column: number;
  row: number;
  criticalThresholds: Partial<Record<VariationType, number | null>>;
  initialInventory?: Partial<Record<VariationType, number>>;
}
