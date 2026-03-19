/**
 * syncService.js
 *
 * Pull-only sync: fetches each resource from the backend API and upserts
 * records into the local WatermelonDB. No push (writes go directly to API).
 *
 * Strategy: for each table, compare remote `updatedAt` against the locally
 * stored `updated_at`. Upsert if remote is newer or record doesn't exist locally.
 * Soft-deleted records are marked is_deleted=true locally and excluded from queries.
 */

import { database } from '../db';
import api          from '../lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Convert an ISO string or null to a Unix ms timestamp (WatermelonDB stores numbers) */
const toMs = (iso) => (iso ? new Date(iso).getTime() : null);

/**
 * Upsert a collection from an array of remote records.
 *
 * @param {Collection} collection   - WatermelonDB collection
 * @param {object[]}   remoteItems  - Array of records from the API
 * @param {Function}   mapFn        - (record, remoteItem) => void  — sets fields
 * @param {Function}   createMapFn  - (record) => void              — sets fields on new record
 */
async function upsertCollection(collection, remoteItems, mapFn, createMapFn) {
  if (!remoteItems?.length) return;

  // Fetch all existing local records as a Map keyed by remoteId
  const existing = await collection.query().fetch();
  const localMap  = new Map(existing.map((r) => [r.remoteId, r]));

  await database.write(async () => {
    for (const item of remoteItems) {
      const local = localMap.get(item.id);

      if (local) {
        // Only update if remote is strictly newer
        const remoteMs = toMs(item.updatedAt);
        if (remoteMs && remoteMs <= local.updatedAt) continue;

        await local.update((record) => mapFn(record, item));
      } else {
        await collection.create((record) => {
          record._raw.id = item.id;   // use remote UUID as local WatermelonDB id
          createMapFn(record, item);
        });
      }
    }
  });
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapProject(record, r) {
  record.remoteId  = r.id;
  record.userId    = r.userId    ?? '';
  record.seasonId  = r.seasonId  ?? '';
  record.name      = r.name      ?? '';
  record.crop      = r.crop      ?? '';
  record.landSize  = r.landSize  ?? 0;
  record.landUnit  = r.landUnit  ?? 'acres';
  record.startDate = toMs(r.startDate);
  record.endDate   = toMs(r.endDate)   ?? null;
  record.notes     = r.notes     ?? '';
  record.isDeleted = r.isDeleted ?? false;
  record.updatedAt = toMs(r.updatedAt);
}

function mapBudgetItem(record, r) {
  record.remoteId   = r.id;
  record.projectId  = r.projectId  ?? '';
  record.category   = r.category   ?? '';
  record.name       = r.name       ?? '';
  record.quantity   = r.quantity   ?? 0;
  record.unit       = r.unit       ?? '';
  record.unitPrice  = r.unitPrice  ?? 0;
  record.isDeleted  = r.isDeleted  ?? false;
  record.updatedAt  = toMs(r.updatedAt);
}

function mapExpense(record, r) {
  record.remoteId   = r.id;
  record.projectId  = r.projectId  ?? '';
  record.category   = r.category   ?? '';
  record.amount     = r.amount     ?? 0;
  record.date       = toMs(r.date);
  record.note       = r.note       ?? '';
  record.receiptUrl = r.receiptUrl ?? '';
  record.isDeleted  = r.isDeleted  ?? false;
  record.updatedAt  = toMs(r.updatedAt);
}

function mapWorkEntry(record, r) {
  record.remoteId   = r.id;
  record.projectId  = r.projectId  ?? '';
  record.employeeId = r.employeeId ?? '';
  record.activity   = r.activity   ?? '';
  record.date       = toMs(r.date);
  record.daysWorked = r.daysWorked ?? 0;
  record.ratePerDay = r.ratePerDay ?? 0;
  record.totalCost  = r.totalCost  ?? 0;
  record.notes      = r.notes      ?? '';
  record.isPaid     = r.isPaid     ?? false;
  record.isDeleted  = r.isDeleted  ?? false;
  record.updatedAt  = toMs(r.updatedAt);
}

function mapEmployee(record, r) {
  record.remoteId  = r.id;
  record.userId    = r.userId   ?? '';
  record.name      = r.name     ?? '';
  record.phone     = r.phone    ?? '';
  record.role      = r.role     ?? '';
  record.isDeleted = r.isDeleted ?? false;
  record.updatedAt = toMs(r.updatedAt);
}

function mapPayment(record, r) {
  record.remoteId   = r.id;
  record.employeeId = r.employeeId ?? '';
  record.amount     = r.amount     ?? 0;
  record.date       = toMs(r.date);
  record.note       = r.note       ?? '';
  record.isDeleted  = r.isDeleted  ?? false;
  record.updatedAt  = toMs(r.updatedAt);
}

// ── Sync runners ──────────────────────────────────────────────────────────────

async function syncProjects() {
  const { data } = await api.get('/projects');
  const projects = data.projects ?? [];

  const col = database.get('farm_projects');
  await upsertCollection(col, projects, mapProject, mapProject);

  return projects;
}

async function syncExpenses(projectIds) {
  const col = database.get('expenses');
  for (const pid of projectIds) {
    try {
      const { data } = await api.get(`/expenses/${pid}`);
      await upsertCollection(col, data.expenses ?? [], mapExpense, mapExpense);
    } catch {
      // project may have been deleted remotely — skip
    }
  }
}

async function syncBudgetItems(projectIds) {
  const col = database.get('budget_items');
  for (const pid of projectIds) {
    try {
      const { data } = await api.get(`/budget/${pid}`);
      await upsertCollection(col, data.budgetItems ?? [], mapBudgetItem, mapBudgetItem);
    } catch {
      // project may have been deleted remotely — skip
    }
  }
}

async function syncWorkEntries(projectIds) {
  const col = database.get('work_entries');
  for (const pid of projectIds) {
    try {
      const { data } = await api.get(`/work-entries/${pid}`);
      await upsertCollection(col, data.workEntries ?? [], mapWorkEntry, mapWorkEntry);
    } catch {
      // project may have been deleted remotely — skip
    }
  }
}

async function syncEmployees() {
  const { data } = await api.get('/employees');
  const col = database.get('employees');
  await upsertCollection(col, data.employees ?? [], mapEmployee, mapEmployee);
}

async function syncPayments() {
  const { data } = await api.get('/payments');
  const col = database.get('payments');
  await upsertCollection(col, data.payments ?? [], mapPayment, mapPayment);
}

// ── Public sync entry point ───────────────────────────────────────────────────

let _syncing = false;

export async function syncAll() {
  if (_syncing) return;   // prevent overlapping syncs
  _syncing = true;
  try {
    // 1. Sync projects first so we have IDs for child syncs
    const projects = await syncProjects();

    const activeIds = projects
      .filter((p) => !p.isDeleted)
      .map((p) => p.id);

    // 2. Sync child resources in parallel
    await Promise.all([
      syncExpenses(activeIds),
      syncBudgetItems(activeIds),
      syncEmployees(),
      syncPayments(),
    ]);

    // 3. Work entries — deferred until dedicated API endpoint added
    await syncWorkEntries(activeIds);

    console.log('[sync] completed at', new Date().toISOString());
  } catch (err) {
    console.warn('[sync] failed:', err.message);
  } finally {
    _syncing = false;
  }
}
