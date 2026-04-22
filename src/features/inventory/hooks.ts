import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
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
  const { session, isConfigured, isLoading } = useAuth();

  return useQuery({
    queryKey: [...inventoryKeys.snapshot(), isConfigured ? session?.user.id ?? 'guest' : 'demo'],
    queryFn: getSnapshot,
    enabled: !isLoading,
  });
}

export function useHookGrid(search: string) {
  const { session, isConfigured, isLoading } = useAuth();

  return useQuery({
    queryKey: [...inventoryKeys.grid(search), isConfigured ? session?.user.id ?? 'guest' : 'demo'],
    queryFn: async () => buildGrid(await getSnapshot(), search),
    enabled: !isLoading,
  });
}

export function useDashboardSummary() {
  const { session, isConfigured, isLoading } = useAuth();

  return useQuery({
    queryKey: [...inventoryKeys.dashboard(), isConfigured ? session?.user.id ?? 'guest' : 'demo'],
    queryFn: async () => buildDashboardSummary(await getSnapshot()),
    enabled: !isLoading,
  });
}

export function useStockLogs() {
  const { session, isConfigured, isLoading } = useAuth();

  return useQuery({
    queryKey: [...inventoryKeys.logs(), isConfigured ? session?.user.id ?? 'guest' : 'demo'],
    queryFn: async () => (await getSnapshot()).logs,
    enabled: !isLoading,
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
