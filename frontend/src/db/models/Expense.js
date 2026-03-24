import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Expense extends Model {
  static table = 'expenses';

  @text('remote_id')   remoteId;
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
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
  @text('sync_status') syncStatus;
  @field('last_synced_at') lastSyncedAt;
  @text('last_error') lastError;
}
