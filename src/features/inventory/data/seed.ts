import { InventorySnapshot, VariationType } from '../types';

const variationOrder: VariationType[] = ['silicone', 'colorida', 'carteira'];

const brands = [
  { id: 'brand-apple', name: 'Apple' },
  { id: 'brand-samsung', name: 'Samsung' },
  { id: 'brand-xiaomi', name: 'Xiaomi' },
  { id: 'brand-motorola', name: 'Motorola' },
];

const modelSeed = [
  { id: 'model-1', brandId: 'brand-apple', name: 'iPhone 15', column: 1, row: 1, criticalThresholds: { silicone: 3, colorida: 2, carteira: 1 } },
  { id: 'model-2', brandId: 'brand-apple', name: 'iPhone 14 Pro', column: 2, row: 1, criticalThresholds: { silicone: 2, colorida: 1, carteira: null } },
  { id: 'model-3', brandId: 'brand-samsung', name: 'S24 Ultra', column: 4, row: 2, criticalThresholds: { silicone: 3, colorida: 2, carteira: 1 } },
  { id: 'model-4', brandId: 'brand-samsung', name: 'A55', column: 5, row: 4, criticalThresholds: { silicone: 1, colorida: 1, carteira: 1 } },
  { id: 'model-5', brandId: 'brand-xiaomi', name: 'Redmi Note 13', column: 11, row: 2, criticalThresholds: { silicone: 2, colorida: null, carteira: 1 } },
  { id: 'model-6', brandId: 'brand-motorola', name: 'Moto G84', column: 14, row: 5, criticalThresholds: { silicone: 1, colorida: 1, carteira: 1 } },
  { id: 'model-7', brandId: 'brand-xiaomi', name: 'Poco X6', column: 18, row: 1, criticalThresholds: { silicone: 2, colorida: 1, carteira: null } },
  { id: 'model-8', brandId: 'brand-apple', name: 'iPhone 13', column: 21, row: 3, criticalThresholds: { silicone: 2, colorida: 2, carteira: 1 } },
];

const quantities = [
  [8, 5, 3],
  [4, 1, 0],
  [6, 4, 2],
  [2, 0, 1],
  [5, 2, 1],
  [3, 2, 2],
  [2, 1, 1],
  [7, 3, 2],
];

export const seedSnapshot: InventorySnapshot = {
  brands,
  models: modelSeed,
  inventory: modelSeed.flatMap((model, index) =>
    variationOrder.map((variation, variationIndex) => ({
      id: `${model.id}-${variation}`,
      modelId: model.id,
      variation,
      quantity: quantities[index]?.[variationIndex] ?? 0,
    })),
  ),
  logs: [
    {
      id: 'log-1',
      modelId: 'model-1',
      variation: 'silicone',
      delta: -1,
      reason: 'venda',
      createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    },
    {
      id: 'log-2',
      modelId: 'model-3',
      variation: 'colorida',
      delta: 4,
      reason: 'reposicao',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: 'log-3',
      modelId: 'model-4',
      variation: 'colorida',
      delta: -1,
      reason: 'brinde',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    },
  ],
};
