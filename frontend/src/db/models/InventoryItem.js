import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation } from '@nozbe/watermelondb/decorators';

export default class InventoryItem extends Model {
  static table = 'inventory_items';

  static associations = {
    payees: { type: 'belongs_to', key: 'payee_id' },
  };

  @text('project_id') projectId;
  @text('name') name;
  @text('category') category;
  @field('quantity') quantity;
  @text('unit') unit;
  @field('unit_cost') unitCost;
  @field('total_cost') totalCost;
  @field('used_qty')   usedQty;
  @text('notes')       notes;
  @text('payee')       payee;
  @text('payee_id')    payeeId;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @immutableRelation('payees', 'payee_id') payeeRecord;
}
