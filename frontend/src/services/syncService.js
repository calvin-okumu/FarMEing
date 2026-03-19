/**
 * syncService.js
 *
 * Bi-directional sync:
 * 1. PUSH: Finds local records with "pending_" IDs and POSTs them to the server.
 * 2. PULL: Fetches latest from server and upserts into local WatermelonDB.
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import api from '../lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const toMs = (iso) => (iso ? new Date(iso).getTime() : null);

/** Upsert remote records into local DB */
async function upsertCollection(collection, remoteItems, mapFn) {
  if (!remoteItems?.length) return;

  const existing = await collection.query().fetch();
  const localMap = new Map(existing.map((r) => [r.remoteId, r]));

  await database.write(async () => {
    for (const item of remoteItems) {
      const local = localMap.get(item.id);

      if (local) {
        const remoteMs = toMs(item.updatedAt);
        if (remoteMs && remoteMs <= local.updatedAt) continue;
        await local.update((record) => mapFn(record, item));
      } else {
        await collection.create((record) => {
          record._raw.id = item.id;
          mapFn(record, item);
        });
      }
    }
  });
}

// ── Mappers ───────────────────────────────────────────────────────────────────

const mappers = {
  farm_projects: (record, r) => {
    record.remoteId = r.id;
    record.userId = r.userId ?? '';
    record.seasonId = r.seasonId ?? '';
    record.name = r.name ?? '';
    record.crop = r.crop ?? '';
    record.landSize = r.landSize ?? 0;
    record.landUnit = r.landUnit ?? 'acres';
    record.startDate = toMs(r.startDate);
    record.endDate = toMs(r.endDate) ?? null;
    record.expectedYield = r.expectedYield ?? 0;
    record.status = r.status ?? 'ACTIVE';
    record.notes = r.notes ?? '';
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  budget_items: (record, r) => {
    record.remoteId = r.id;
    record.projectId = r.projectId ?? '';
    record.category = r.category ?? '';
    record.name = r.name ?? '';
    record.quantity = r.quantity ?? 0;
    record.unit = r.unit ?? '';
    record.unitPrice = r.unitPrice ?? 0;
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  expenses: (record, r) => {
    record.remoteId = r.id;
    record.projectId = r.projectId ?? '';
    record.category = r.category ?? '';
    record.expenseType = r.expenseType ?? 'OPEX';
    record.amount = r.amount ?? 0;
    record.date = toMs(r.date);
    record.isRecurring = r.isRecurring ?? false;
    record.frequency = r.frequency ?? null;
    record.note = r.note ?? '';
    record.receiptUrl = r.receiptUrl ?? '';
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  work_entries: (record, r) => {
    record.remoteId = r.id;
    record.projectId = r.projectId ?? '';
    record.employeeId = r.employeeId ?? '';
    record.activity = r.activity ?? '';
    record.date = toMs(r.date);
    record.daysWorked = r.daysWorked ?? 0;
    record.ratePerDay = r.ratePerDay ?? 0;
    record.totalCost = r.totalCost ?? 0;
    record.hoursWorked = r.hoursWorked ?? 0;
    record.imageUrl = r.imageUrl ?? '';
    record.locationLat = r.locationLat ?? 0;
    record.locationLng = r.locationLng ?? 0;
    record.status = r.status ?? 'PENDING';
    record.isRecurring = r.isRecurring ?? false;
    record.frequency = r.frequency ?? null;
    record.notes = r.notes ?? '';
    record.isPaid = r.isPaid ?? false;
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  employees: (record, r) => {
    record.remoteId = r.id;
    record.userId = r.userId ?? '';
    record.name = r.name ?? '';
    record.phone = r.phone ?? '';
    record.role = r.role ?? '';
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  payments: (record, r) => {
    record.remoteId = r.id;
    record.employeeId = r.employeeId ?? '';
    record.amount = r.amount ?? 0;
    record.date = toMs(r.date);
    record.note = r.note ?? '';
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  harvests: (record, r) => {
    record.remoteId = r.id;
    record.projectId = r.projectId ?? '';
    record.crop = r.crop ?? '';
    record.date = toMs(r.date);
    record.weight = r.weight ?? 0;
    record.unit = r.unit ?? 'kg';
    record.quality = r.quality ?? '';
    record.notes = r.notes ?? '';
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
  sales: (record, r) => {
    record.remoteId = r.id;
    record.projectId = r.projectId ?? '';
    record.date = toMs(r.date);
    record.customer = r.customer ?? '';
    record.weightSold = r.weightSold ?? 0;
    record.unitPrice = r.unitPrice ?? 0;
    record.totalAmount = r.totalAmount ?? 0;
    record.notes = r.notes ?? '';
    record.isDeleted = r.isDeleted ?? false;
    record.updatedAt = toMs(r.updatedAt);
  },
};

// ── PUSH: Local -> Server ─────────────────────────────────────────────────────

async function pushChanges() {
  // Push Employees first (other things depend on them)
  await pushCollection('employees', '/employees', (r) => ({
    name: r.name,
    phone: r.phone,
    role: r.role,
  }));

  // Push Projects
  await pushCollection('farm_projects', '/projects', (r) => ({
    name: r.name,
    crop: r.crop,
    landSize: r.landSize,
    landUnit: r.landUnit,
    startDate: new Date(r.startDate).toISOString().split('T')[0],
    expectedYield: r.expectedYield,
    status: r.status,
    notes: r.notes,
  }));

  // Push Child Resources
  await Promise.all([
    pushCollection('expenses', '/expenses', (r) => ({
      projectId: r.projectId,
      category: r.category,
      expenseType: r.expenseType,
      amount: r.amount,
      date: new Date(r.date).toISOString().split('T')[0],
      isRecurring: r.isRecurring,
      frequency: r.frequency,
      note: r.note,
    })),
    pushCollection('budget_items', '/budget', (r) => ({
      projectId: r.projectId,
      category: r.category,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: r.unitPrice,
    })),
    pushCollection('work_entries', '/work-entries', (r) => ({
      projectId: r.projectId,
      employeeId: r.employeeId,
      activity: r.activity,
      date: new Date(r.date).toISOString().split('T')[0],
      daysWorked: r.daysWorked,
      ratePerDay: r.ratePerDay,
      hoursWorked: r.hoursWorked,
      imageUrl: r.imageUrl,
      locationLat: r.locationLat,
      locationLng: r.locationLng,
      status: r.status,
      isRecurring: r.isRecurring,
      frequency: r.frequency,
      notes: r.notes,
    })),
    pushCollection('payments', '/payments', (r) => ({
      employeeId: r.employeeId,
      amount: r.amount,
      date: new Date(r.date).toISOString().split('T')[0],
      note: r.note,
    })),
    pushCollection('harvests', '/harvests', (r) => ({
      projectId: r.projectId,
      crop: r.crop,
      date: new Date(r.date).toISOString().split('T')[0],
      weight: r.weight,
      unit: r.unit,
      quality: r.quality,
      notes: r.notes,
    })),
    pushCollection('sales', '/sales', (r) => ({
      projectId: r.projectId,
      date: new Date(r.date).toISOString().split('T')[0],
      customer: r.customer,
      weightSold: r.weightSold,
      unitPrice: r.unitPrice,
      totalAmount: r.totalAmount,
      notes: r.notes,
    })),
  ]);
}

async function pushCollection(table, endpoint, payloadFn) {
  const collection = database.get(table);
  // Find records with pending IDs (e.g. "pending_171...")
  const pending = await collection.query(Q.where('id', Q.like('pending_%'))).fetch();

  for (const record of pending) {
    try {
      const { data } = await api.post(endpoint, payloadFn(record));
      const remoteItem = data[Object.keys(data)[0]]; // get first key (e.g. project, expense)

      await database.write(async () => {
        // We delete the pending record and create a new one with the real remote ID
        // This is cleaner than updating ID in SQLite which is tricky in Watermelon
        await record.destroyPermanently();
        await collection.create((newRecord) => {
          newRecord._raw.id = remoteItem.id;
          mappers[table](newRecord, remoteItem);
        });
      });
    } catch (err) {
      console.warn(`[sync] Failed to push ${table} item:`, err.message);
    }
  }
}

// ── PULL: Server -> Local ─────────────────────────────────────────────────────

async function pullChanges() {
  const { data: { projects } } = await api.get('/projects');
  await upsertCollection(database.get('farm_projects'), projects, mappers.farm_projects);

  const activeIds = projects.filter(p => !p.isDeleted).map(p => p.id);

  await Promise.all([
    syncEmployees(),
    syncPayments(),
    ...activeIds.map(id => syncProjectChildren(id))
  ]);
}

async function syncEmployees() {
  const { data: { employees } } = await api.get('/employees');
  await upsertCollection(database.get('employees'), employees, mappers.employees);
}

async function syncPayments() {
  const { data: { payments } } = await api.get('/payments');
  await upsertCollection(database.get('payments'), payments, mappers.payments);
}

async function syncProjectChildren(projectId) {
  try {
    const [budgetRes, expenseRes, workRes, harvestRes, saleRes] = await Promise.all([
      api.get(`/budget/${projectId}`),
      api.get(`/expenses/${projectId}`),
      api.get(`/work-entries/${projectId}`),
      api.get(`/harvests/${projectId}`),
      api.get(`/sales/${projectId}`),
    ]);

    await Promise.all([
      upsertCollection(database.get('budget_items'), budgetRes.data.budgetItems, mappers.budget_items),
      upsertCollection(database.get('expenses'), expenseRes.data.expenses, mappers.expenses),
      upsertCollection(database.get('work_entries'), workRes.data.workEntries, mappers.work_entries),
      upsertCollection(database.get('harvests'), harvestRes.data.harvests, mappers.harvests),
      upsertCollection(database.get('sales'), saleRes.data.sales, mappers.sales),
    ]);
  } catch (err) {
    // skip deleted projects
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

let _syncing = false;

export async function syncAll() {
  if (_syncing) return;
  _syncing = true;
  console.log('[sync] starting...');
  try {
    // 1. Push local changes first
    await pushChanges();
    // 2. Pull remote changes
    await pullChanges();
    console.log('[sync] finished');
  } catch (err) {
    console.warn('[sync] failed:', err.message);
  } finally {
    _syncing = false;
  }
}
