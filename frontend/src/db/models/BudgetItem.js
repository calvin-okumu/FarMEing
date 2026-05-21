import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation } from '@nozbe/watermelondb/decorators';

export default class BudgetItem extends Model {
  static table = 'budget_items';

  static associations = {
    project_blocks: { type: 'belongs_to', key: 'block_id' },
  };

  @text('project_id')  projectId;
  @text('block_id')    blockId;
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

  @immutableRelation('project_blocks', 'block_id') block;
}

