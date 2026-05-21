import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation } from '@nozbe/watermelondb/decorators';

export default class Expense extends Model {
  static table = 'expenses';

  static associations = {
    payees: { type: 'belongs_to', key: 'payee_id' },
  };

  @text('project_id')  projectId;
  @text('category')    category;
  @text('expense_type') expenseType;
  @field('amount')     amount;
  @field('date')       date;
  @field('is_recurring') isRecurring;
  @text('frequency')    frequency;
  @text('note')       note;
  @text('receipt_url') receiptUrl;
  @text('payee')      payee;
  @text('payee_id')   payeeId;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @immutableRelation('payees', 'payee_id') payeeRecord;
}
