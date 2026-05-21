export function initializeLocalRecord(record) {
  const now = Date.now();
  record.createdAt = now;
  record.updatedAt = now;
}

export function markRecordUpdated(record) {
  record.updatedAt = Date.now();
}

export function markRecordDeleted(record) {
  record.isDeleted = true;
  record.updatedAt = Date.now();
}
