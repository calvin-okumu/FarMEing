import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEmployee,
  deleteEmployee,
  getEmployeeBalance,
  listEmployees,
  updateEmployee,
} from '../../services/employeeService';

export const EMPLOYEE_KEYS = {
  all: ['employees'],
  balance: (id) => ['employees', id, 'balance'],
};

export function useEmployeesQuery() {
  return useQuery({
    queryKey: EMPLOYEE_KEYS.all,
    queryFn: async () => {
      const data = await listEmployees();
      return data.employees || [];
    },
  });
}

export function useEmployeeBalanceQuery(employeeId) {
  return useQuery({
    queryKey: EMPLOYEE_KEYS.balance(employeeId),
    queryFn: async () => getEmployeeBalance(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.all }),
  });
}

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }) => updateEmployee(id, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.balance(variables.id) });
    },
  });
}

export function useDeleteEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.all });
      queryClient.removeQueries({ queryKey: EMPLOYEE_KEYS.balance(id) });
    },
  });
}
