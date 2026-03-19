import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, nochange } from '@nozbe/watermelondb/decorators';

export default class BudgetItem extends Model {
  static table = 'budget_items';

  @nochange @text('remote_id')   remoteId;
  @text('project_id')  projectId;
  @text('category')    category;
  @text('name')       name;
  @field('quantity')   quantity;
  @text('unit')       unit;
  @field('unit_price') unitPrice;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @date('updated_at')  updatedAt;
}
