import { deleteJson, getJson, patchJson, postJson, putJson, toDateOnly, toNumber } from './http';

const compact = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const normalizeWorkEntry = (values) => compact({
  projectId: values.projectId,
  employeeId: values.employeeId,
  activity: values.activity,
  date: values.date !== undefined ? toDateOnly(values.date) : undefined,
  daysWorked: values.daysWorked !== undefined ? toNumber(values.daysWorked) : undefined,
  ratePerDay: values.ratePerDay !== undefined ? toNumber(values.ratePerDay) : undefined,
  hoursWorked: values.hoursWorked !== undefined ? toNumber(values.hoursWorked) : undefined,
  imageUrl: values.imageUrl !== undefined ? values.imageUrl || null : undefined,
  locationLat: values.locationLat !== undefined ? values.locationLat ?? null : undefined,
  locationLng: values.locationLng !== undefined ? values.locationLng ?? null : undefined,
  status: values.status,
  isRecurring: values.isRecurring !== undefined ? !!values.isRecurring : undefined,
  frequency: values.frequency !== undefined ? values.frequency || null : undefined,
  notes: values.notes !== undefined ? values.notes?.trim() || null : undefined,
});

export function listWorkEntries(projectId) { return getJson(`/work-entries/${projectId}`); }
export function workEntriesByEmployee(projectId) { return getJson(`/work-entries/${projectId}/by-employee`); }
export function workEntriesByActivity(projectId) { return getJson(`/work-entries/${projectId}/by-activity`); }
export function createWorkEntry(values) { return postJson('/work-entries', normalizeWorkEntry(values)); }
export function updateWorkEntry(id, values) { return putJson(`/work-entries/${id}`, normalizeWorkEntry(values)); }
export function updateWorkEntryStatus(id, status) { return patchJson(`/work-entries/${id}/approve`, { status }); }
export function deleteWorkEntry(id) { return deleteJson(`/work-entries/${id}`); }
