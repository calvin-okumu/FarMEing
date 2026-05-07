export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING_CREATE: 'pending_create',
  PENDING_UPDATE: 'pending_update',
  PENDING_DELETE: 'pending_delete',
  FAILED: 'failed',
};

export function initializeLocalRecord(record) {
  const now = Date.now();
  record.remoteId = '';
  record.syncStatus = SYNC_STATUS.PENDING_CREATE;
  record.lastSyncedAt = null;
  record.lastError = '';
  record.createdAt = now;
  record.updatedAt = now;
}

export function markRecordUpdated(record) {
  record.updatedAt = Date.now();
  record.lastError = '';

  if (record.syncStatus !== SYNC_STATUS.PENDING_CREATE) {
    record.syncStatus = SYNC_STATUS.PENDING_UPDATE;
  }
}

export function markRecordDeleted(record) {
  record.isDeleted = true;
  record.updatedAt = Date.now();
  record.lastError = '';

  if (record.syncStatus === SYNC_STATUS.PENDING_CREATE) {
    record.syncStatus = SYNC_STATUS.PENDING_DELETE;
    return;
  }

  record.syncStatus = SYNC_STATUS.PENDING_DELETE;
}

export function markRecordSynced(record, remoteId) {
  const now = Date.now();
  if (remoteId) {
    record.remoteId = remoteId;
  }
  record.syncStatus = SYNC_STATUS.SYNCED;
  record.lastSyncedAt = now;
  record.lastError = '';
  record.updatedAt = now;
}

export function markRecordFailed(record, message, fallbackStatus) {
  record.syncStatus = fallbackStatus || record.syncStatus || SYNC_STATUS.FAILED;
  record.lastError = message || 'Sync failed';
  record.updatedAt = Date.now();
}

export function needsSync(record) {
  return [
    SYNC_STATUS.PENDING_CREATE,
    SYNC_STATUS.PENDING_UPDATE,
    SYNC_STATUS.PENDING_DELETE,
    SYNC_STATUS.FAILED,
  ].includes(record.syncStatus);
}
