import { useQuery } from '@tanstack/react-query';
import { listBudgetItems } from '../../services/budgetService';
import { listExpenses } from '../../services/expenseService';
import { listWorkEntries, workEntriesByActivity, workEntriesByEmployee } from '../../services/workEntryService';
import { listHarvests } from '../../services/harvestService';
import { listSales } from '../../services/saleService';

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
