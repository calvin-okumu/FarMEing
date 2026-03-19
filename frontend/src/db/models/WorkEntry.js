import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, nochange } from '@nozbe/watermelondb/decorators';

export default class WorkEntry extends Model {
  static table = 'work_entries';

  @nochange @text('remote_id')    remoteId;
  @text('project_id')   projectId;
  @text('employee_id')  employeeId;
  @text('activity')     activity;
  @field('date')        date;
  @field('days_worked') daysWorked;
  @field('rate_per_day') ratePerDay;
  @field('total_cost')  totalCost;
  @text('notes')        notes;
  @field('is_paid')     isPaid;
  @field('is_deleted')  isDeleted;
  @readonly @date('created_at') createdAt;
  @date('updated_at')   updatedAt;
}
