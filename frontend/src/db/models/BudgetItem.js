import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class BudgetItem extends Model {
  static table = 'budget_items';

  @text('project_id')  projectId;
  @text('category')    category;
  @text('name')       name;
  @field('quantity')   quantity;
  @text('unit')       unit;
  @field('unit_price') unitPrice;
  @field('total')      total;
  @text('notes')       notes;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
}
