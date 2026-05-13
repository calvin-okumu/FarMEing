import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class SalePayment extends Model {
  static table = 'sale_payments';

  static associations = {
    sales: { type: 'belongs_to', foreignKey: 'sale_id' },
  };

  @text('sale_id') saleId;
  @field('amount') amount;
  @field('date') date;
  @text('note') note;
  @field('is_deleted') isDeleted;
  @text('sync_status') syncStatus;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
}