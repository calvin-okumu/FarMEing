import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Sale extends Model {
  static table = 'sales';

  @text('project_id') projectId;
  @field('date') date;
  @text('customer') customer;
  @field('weight_sold') weightSold;
  @field('unit_price') unitPrice;
  @field('total_amount') totalAmount;
  @text('notes') notes;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
}
