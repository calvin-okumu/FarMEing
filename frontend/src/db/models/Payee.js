import { Model } from '@nozbe/watermelondb';
import { text, field, children } from '@nozbe/watermelondb/decorators';

export default class Payee extends Model {
  static table = 'payees';

  static associations = {
    expenses: { type: 'has_many', foreignKey: 'payee_id' },
    inventory_items: { type: 'has_many', foreignKey: 'payee_id' },
  };

  get remoteId() {
    return this._raw.remote_id || null;
  }

  @text('user_id')    userId;
  @text('name')       name;
  @text('phone')      phone;
  @text('email')      email;
  @text('address')    address;
  @text('category')   category;
  @text('notes')      notes;
  @field('is_deleted') isDeleted;

  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @children('expenses')        expenses;
  @children('inventory_items') inventoryItems;
}
