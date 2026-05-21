import { Model } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation } from '@nozbe/watermelondb/decorators';

export default class Sale extends Model {
  static table = 'sales';

  static associations = {
    sale_payments: { type: 'has_many', foreignKey: 'sale_id' },
    sale_harvests: { type: 'has_many', foreignKey: 'sale_id' },
  };

  @text('project_id') projectId;
  @text('block_id') blockId;
  @field('date') date;
  @text('customer') customer;
  @field('weight_sold') weightSold;
  @field('unit_price') unitPrice;
  @field('total_amount') totalAmount;
  @text('payment_status') paymentStatus;
  @field('balance_due') balanceDue;
  @text('receipt_url') receiptUrl;
  @text('notes') notes;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @children('sale_payments') salePayments;
  @children('sale_harvests') saleHarvests;
  @immutableRelation('project_blocks', 'block_id') block;
}
