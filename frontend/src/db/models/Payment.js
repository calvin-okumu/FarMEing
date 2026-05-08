import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Payment extends Model {
  static table = 'payments';

  @text('employee_id')  employeeId;
  @field('amount')     amount;
  @field('date')       date;
  @text('note')        note;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
}
