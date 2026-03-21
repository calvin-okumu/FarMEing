import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPayment, listEmployeePayments, listPayments } from '../../services/paymentService';
import { EMPLOYEE_KEYS } from './useEmployeesApi';

export const PAYMENT_KEYS = {
  all: ['payments'],
  employee: (employeeId) => ['payments', employeeId],
};

export function usePaymentsQuery() {
  return useQuery({
    queryKey: PAYMENT_KEYS.all,
    queryFn: async () => {
      const data = await listPayments();
      return data.payments || [];
    },
  });
}

export function useEmployeePaymentsQuery(employeeId) {
  return useQuery({
    queryKey: PAYMENT_KEYS.employee(employeeId),
    queryFn: async () => {
      const data = await listEmployeePayments(employeeId);
      return data.payments || [];
    },
    enabled: !!employeeId,
  });
}

export function useCreatePaymentMutation(employeeId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_KEYS.all });
      if (employeeId) {
        queryClient.invalidateQueries({ queryKey: PAYMENT_KEYS.employee(employeeId) });
        queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.balance(employeeId) });
      }
    },
  });
}
