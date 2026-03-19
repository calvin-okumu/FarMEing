import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, nochange } from '@nozbe/watermelondb/decorators';

export default class Expense extends Model {
  static table = 'expenses';

  @nochange @text('remote_id')   remoteId;
  @text('project_id')  projectId;
  @text('category')    category;
  @text('expense_type') expenseType;
  @field('amount')     amount;
  @field('date')       date;
  @field('is_recurring') isRecurring;
  @text('frequency')    frequency;
  @text('note')        note;
  @text('receipt_url') receiptUrl;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @date('updated_at')  updatedAt;
}
