import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Employee extends Model {
  static table = 'employees';

  @text('remote_id')  remoteId;
  @text('user_id')    userId;
  @text('name')       name;
  @text('phone')      phone;
  @text('role')       role;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
  @text('sync_status') syncStatus;
  @field('last_synced_at') lastSyncedAt;
  @text('last_error') lastError;
}
