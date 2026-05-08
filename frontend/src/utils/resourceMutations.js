import { Q } from '@nozbe/watermelondb';
import { markRecordDeleted, markRecordUpdated } from './localRecord';
import { syncAll } from '../services/syncService';

const PROJECT_BOUND_TABLES = [
  'budget_items',
  'expenses',
  'work_entries',
  'harvests',
  'sales',
  'inventory_items',
];

export async function updateLocalModel(record, applyChanges) {
  await record.update((draft) => {
    applyChanges(draft);
    markRecordUpdated(draft);
  });
  // Trigger sync in background
  syncAll();
}

export async function deleteLocalModel(record) {
  await record.update((draft) => {
    markRecordDeleted(draft);
  });
  // Trigger sync in background
  syncAll();
}

export async function deleteProjectCascade(database, projectId) {
  await database.write(async () => {
    const projectRecord = await database.get('farm_projects').find(projectId);
    await deleteLocalModel(projectRecord);

    for (const table of PROJECT_BOUND_TABLES) {
      const related = await database.get(table).query(
        Q.where('project_id', projectId),
        Q.where('is_deleted', false)
      ).fetch();

      for (const record of related) {
        await deleteLocalModel(record);
      }
    }
  });
}
