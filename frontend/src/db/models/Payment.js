import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Payment extends Model {
  static table = 'payments';

  @text('remote_id')   remoteId;
  @text('employee_id')  employeeId;
  @field('amount')     amount;
  @field('date')       date;
  @text('note')        note;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
  @text('sync_status') syncStatus;
  @field('last_synced_at') lastSyncedAt;
  @text('last_error') lastError;
}
