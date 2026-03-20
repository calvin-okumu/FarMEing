import { getJson, postJson, toDateOnly, toNumber } from './http';

const normalizePayment = (values) => ({
  employeeId: values.employeeId,
  amount: toNumber(values.amount),
  date: toDateOnly(values.date),
  note: values.note?.trim() || '',
});

export function listPayments() { return getJson('/payments'); }
export function listEmployeePayments(employeeId) { return getJson(`/payments/${employeeId}`); }
export function createPayment(values) { return postJson('/payments', normalizePayment(values)); }
