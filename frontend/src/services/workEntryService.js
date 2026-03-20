import { deleteJson, getJson, patchJson, postJson, putJson, toDateOnly, toNumber } from './http';

const normalizeWorkEntry = (values) => ({
  projectId: values.projectId,
  employeeId: values.employeeId,
  activity: values.activity,
  date: toDateOnly(values.date),
  daysWorked: toNumber(values.daysWorked),
  ratePerDay: toNumber(values.ratePerDay),
  hoursWorked: toNumber(values.hoursWorked),
  imageUrl: values.imageUrl || null,
  locationLat: values.locationLat ?? null,
  locationLng: values.locationLng ?? null,
  status: values.status || 'PENDING',
  isRecurring: !!values.isRecurring,
  frequency: values.frequency || null,
  notes: values.notes?.trim() || null,
});

export function listWorkEntries(projectId) { return getJson(`/work-entries/${projectId}`); }
export function workEntriesByEmployee(projectId) { return getJson(`/work-entries/${projectId}/by-employee`); }
export function workEntriesByActivity(projectId) { return getJson(`/work-entries/${projectId}/by-activity`); }
export function createWorkEntry(values) { return postJson('/work-entries', normalizeWorkEntry(values)); }
export function updateWorkEntry(id, values) { return putJson(`/work-entries/${id}`, normalizeWorkEntry(values)); }
export function updateWorkEntryStatus(id, status) { return patchJson(`/work-entries/${id}/approve`, { status }); }
export function deleteWorkEntry(id) { return deleteJson(`/work-entries/${id}`); }
