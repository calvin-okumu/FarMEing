import { Model } from '@nozbe/watermelondb';
import { text, field, date, children, readonly } from '@nozbe/watermelondb/decorators';

export default class Payee extends Model {
  static table = 'payees';

  static associations = {
    expenses: { type: 'has_many', foreignKey: 'payee_id' },
    inventory_items: { type: 'has_many', foreignKey: 'payee_id' },
  };

  @text('user_id')    userId;
  @text('name')       name;
  @text('phone')      phone;
  @text('email')      email;
  @text('address')    address;
  @text('category')   category;
  @text('notes')      notes;
  @field('is_deleted') isDeleted;

  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;

  @children('expenses')        expenses;
  @children('inventory_items') inventoryItems;
}
