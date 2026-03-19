import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, nochange } from '@nozbe/watermelondb/decorators';

export default class Payment extends Model {
  static table = 'payments';

  @nochange @text('remote_id')   remoteId;
  @text('employee_id')  employeeId;
  @field('amount')     amount;
  @field('date')       date;
  @text('note')        note;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @date('updated_at')  updatedAt;
}
