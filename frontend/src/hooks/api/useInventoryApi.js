import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
} from '../../services/inventoryService';

const INVENTORY_KEYS = {
  list: (projectId) => ['inventory', projectId],
};

export function useInventoryQuery(projectId) {
  return useQuery({
    queryKey: INVENTORY_KEYS.list(projectId),
    queryFn: async () => listInventory(projectId),
    enabled: !!projectId,
  });
}

export function useCreateInventoryMutation(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.list(projectId) }),
  });
}

export function useUpdateInventoryMutation(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }) => updateInventoryItem(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.list(projectId) }),
  });
}

export function useDeleteInventoryMutation(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.list(projectId) }),
  });
}
