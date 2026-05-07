import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBudgetItem,
  deleteBudgetItem,
  listBudgetItems,
  updateBudgetItem,
} from '../../services/budgetService';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from '../../services/expenseService';
import {
  createHarvest,
  deleteHarvest,
  listHarvests,
  updateHarvest,
} from '../../services/harvestService';
import {
  createSale,
  deleteSale,
  listSales,
  updateSale,
} from '../../services/saleService';
import {
  createWorkEntry,
  deleteWorkEntry,
  listWorkEntries,
  updateWorkEntry,
  updateWorkEntryStatus,
  workEntriesByActivity,
  workEntriesByEmployee,
} from '../../services/workEntryService';

export const projectResourceKey = (projectId, resource) => ['project', projectId, resource];

export const PROJECT_RESOURCE_KEYS = {
  budget: (projectId) => projectResourceKey(projectId, 'budget'),
  expenses: (projectId) => projectResourceKey(projectId, 'expenses'),
  workEntries: (projectId) => projectResourceKey(projectId, 'workEntries'),
  harvests: (projectId) => projectResourceKey(projectId, 'harvests'),
  sales: (projectId) => projectResourceKey(projectId, 'sales'),
  laborByEmployee: (projectId) => projectResourceKey(projectId, 'laborByEmployee'),
  laborByActivity: (projectId) => projectResourceKey(projectId, 'laborByActivity'),
};

export function invalidateProjectResourceQueries(queryClient, projectId, options = {}) {
  if (!projectId) return;

  const includeLaborAnalytics = options.includeLaborAnalytics !== false;
  const keys = [
    PROJECT_RESOURCE_KEYS.budget(projectId),
    PROJECT_RESOURCE_KEYS.expenses(projectId),
    PROJECT_RESOURCE_KEYS.workEntries(projectId),
    PROJECT_RESOURCE_KEYS.harvests(projectId),
    PROJECT_RESOURCE_KEYS.sales(projectId),
  ];

  if (includeLaborAnalytics) {
    keys.push(PROJECT_RESOURCE_KEYS.laborByEmployee(projectId));
    keys.push(PROJECT_RESOURCE_KEYS.laborByActivity(projectId));
  }

  keys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}

function createProjectResourceMutation({ mutationFn, projectId, includeLaborAnalytics = false }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => invalidateProjectResourceQueries(queryClient, projectId, { includeLaborAnalytics }),
  });
}

export function useBudgetItemsQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.budget(projectId),
    queryFn: async () => {
      const data = await listBudgetItems(projectId);
      return data.budgetItems || [];
    },
    enabled: !!projectId,
  });
}

export function useExpensesQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.expenses(projectId),
    queryFn: async () => {
      const data = await listExpenses(projectId);
      return data.expenses || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkEntriesQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.workEntries(projectId),
    queryFn: async () => {
      const data = await listWorkEntries(projectId);
      return data.workEntries || [];
    },
    enabled: !!projectId,
  });
}

export function useHarvestsQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.harvests(projectId),
    queryFn: async () => {
      const data = await listHarvests(projectId);
      return data.harvests || [];
    },
    enabled: !!projectId,
  });
}

export function useSalesQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.sales(projectId),
    queryFn: async () => {
      const data = await listSales(projectId);
      return data.sales || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkEntryEmployeeAnalyticsQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.laborByEmployee(projectId),
    queryFn: async () => {
      const data = await workEntriesByEmployee(projectId);
      return data.byEmployee || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkEntryActivityAnalyticsQuery(projectId) {
  return useQuery({
    queryKey: PROJECT_RESOURCE_KEYS.laborByActivity(projectId),
    queryFn: async () => {
      const data = await workEntriesByActivity(projectId);
      return data.byActivity || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateBudgetItemMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: createBudgetItem, projectId });
}

export function useUpdateBudgetItemMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: ({ id, values }) => updateBudgetItem(id, values), projectId });
}

export function useDeleteBudgetItemMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: deleteBudgetItem, projectId });
}

export function useCreateExpenseMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: createExpense, projectId });
}

export function useUpdateExpenseMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: ({ id, values }) => updateExpense(id, values), projectId });
}

export function useDeleteExpenseMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: deleteExpense, projectId });
}

export function useCreateWorkEntryMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: createWorkEntry, projectId, includeLaborAnalytics: true });
}

export function useUpdateWorkEntryMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: ({ id, values }) => updateWorkEntry(id, values), projectId, includeLaborAnalytics: true });
}

export function useDeleteWorkEntryMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: deleteWorkEntry, projectId, includeLaborAnalytics: true });
}

export function useUpdateWorkEntryStatusMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: ({ id, status }) => updateWorkEntryStatus(id, status), projectId, includeLaborAnalytics: true });
}

export function useCreateHarvestMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: createHarvest, projectId });
}

export function useUpdateHarvestMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: ({ id, values }) => updateHarvest(id, values), projectId });
}

export function useDeleteHarvestMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: deleteHarvest, projectId });
}

export function useCreateSaleMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: createSale, projectId });
}

export function useUpdateSaleMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: ({ id, values }) => updateSale(id, values), projectId });
}

export function useDeleteSaleMutation(projectId) {
  return createProjectResourceMutation({ mutationFn: deleteSale, projectId });
}
