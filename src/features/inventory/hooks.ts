import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adjustInventory,
  buildDashboardSummary,
  buildGrid,
  createModel,
  deleteModel,
  getSnapshot,
  updateModel,
} from './repository';
import { AdjustmentInput, CreateModelInput } from './types';

export const inventoryKeys = {
  all: ['inventory'] as const,
  snapshot: () => [...inventoryKeys.all, 'snapshot'] as const,
  grid: (search: string) => [...inventoryKeys.all, 'grid', search] as const,
  dashboard: () => [...inventoryKeys.all, 'dashboard'] as const,
  logs: () => [...inventoryKeys.all, 'logs'] as const,
};

export function useInventorySnapshot() {
  return useQuery({
    queryKey: inventoryKeys.snapshot(),
    queryFn: getSnapshot,
  });
}

export function useHookGrid(search: string) {
  return useQuery({
    queryKey: inventoryKeys.grid(search),
    queryFn: async () => buildGrid(await getSnapshot(), search),
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: inventoryKeys.dashboard(),
    queryFn: async () => buildDashboardSummary(await getSnapshot()),
  });
}

export function useStockLogs() {
  return useQuery({
    queryKey: inventoryKeys.logs(),
    queryFn: async () => (await getSnapshot()).logs,
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateModelInput) => createModel(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdjustmentInput) => adjustInventory(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modelId, input }: { modelId: string; input: CreateModelInput }) => updateModel(modelId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: string) => deleteModel(modelId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}
