import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class BudgetItem extends Model {
  static table = 'budget_items';

  @text('remote_id')   remoteId;
  @text('project_id')  projectId;
  @text('category')    category;
  @text('name')       name;
  @field('quantity')   quantity;
  @text('unit')       unit;
  @field('unit_price') unitPrice;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
  @text('sync_status') syncStatus;
  @field('last_synced_at') lastSyncedAt;
  @text('last_error') lastError;
}
