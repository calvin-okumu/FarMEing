import { markRecordDeleted, markRecordUpdated, markRecordSynced, SYNC_STATUS } from './localRecord';

export async function updateLocalModel(record, applyChanges, remoteId) {
  await record.update((draft) => {
    applyChanges(draft);
    if (remoteId) {
      markRecordSynced(draft, remoteId);
    } else if (draft.remoteId) {
      markRecordUpdated(draft);
    } else {
      markRecordUpdated(draft);
      draft.syncStatus = SYNC_STATUS.PENDING_CREATE;
    }
  });
}

export async function deleteLocalModel(record) {
  await record.update((draft) => {
    markRecordDeleted(draft);
  });
}
