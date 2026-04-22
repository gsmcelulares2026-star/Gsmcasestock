export type VariationType = 'silicone' | 'colorida' | 'carteira';
export type LogReason = 'venda' | 'defeito' | 'brinde' | 'reposicao' | 'ajuste';

export interface Brand {
  id: string;
  name: string;
}

export interface Model {
  id: string;
  brandId: string;
  name: string;
  column: number;
  row: number;
  criticalThreshold: number;
}

export interface InventoryItem {
  id: string;
  modelId: string;
  variation: VariationType;
  quantity: number;
}

export interface StockLog {
  id: string;
  modelId: string;
  variation: VariationType;
  delta: number;
  reason: LogReason;
  note?: string;
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
  delta: number;
  reason: LogReason;
  note?: string;
}

export interface CreateModelInput {
  brandName: string;
  modelName: string;
  column: number;
  row: number;
  criticalThreshold: number;
  initialInventory?: Partial<Record<VariationType, number>>;
}
