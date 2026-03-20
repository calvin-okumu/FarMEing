import { useQuery } from '@tanstack/react-query';
import { listBudgetItems } from '../../services/budgetService';
import { listExpenses } from '../../services/expenseService';
import { listWorkEntries, workEntriesByActivity, workEntriesByEmployee } from '../../services/workEntryService';
import { listHarvests } from '../../services/harvestService';
import { listSales } from '../../services/saleService';

const projectResourceKey = (projectId, resource) => ['project', projectId, resource];

export function useBudgetItemsQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'budget'),
    queryFn: async () => {
      const data = await listBudgetItems(projectId);
      return data.budgetItems || [];
    },
    enabled: !!projectId,
  });
}

export function useExpensesQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'expenses'),
    queryFn: async () => {
      const data = await listExpenses(projectId);
      return data.expenses || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkEntriesQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'workEntries'),
    queryFn: async () => {
      const data = await listWorkEntries(projectId);
      return data.workEntries || [];
    },
    enabled: !!projectId,
  });
}

export function useHarvestsQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'harvests'),
    queryFn: async () => {
      const data = await listHarvests(projectId);
      return data.harvests || [];
    },
    enabled: !!projectId,
  });
}

export function useSalesQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'sales'),
    queryFn: async () => {
      const data = await listSales(projectId);
      return data.sales || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkEntryEmployeeAnalyticsQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'laborByEmployee'),
    queryFn: async () => {
      const data = await workEntriesByEmployee(projectId);
      return data.byEmployee || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkEntryActivityAnalyticsQuery(projectId) {
  return useQuery({
    queryKey: projectResourceKey(projectId, 'laborByActivity'),
    queryFn: async () => {
      const data = await workEntriesByActivity(projectId);
      return data.byActivity || [];
    },
    enabled: !!projectId,
  });
}
