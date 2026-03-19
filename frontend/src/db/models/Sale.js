import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Sale extends Model {
  static table = 'sales';

  @text('remote_id') remoteId;
  @text('project_id') projectId;
  @date('date') date;
  @text('customer') customer;
  @field('weight_sold') weightSold;
  @field('unit_price') unitPrice;
  @field('total_amount') totalAmount;
  @text('notes') notes;
  @field('is_deleted') isDeleted;
  @readonly('created_at') createdAt;
  @readonly('updated_at') updatedAt;
}
