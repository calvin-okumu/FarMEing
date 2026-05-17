import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation } from '@nozbe/watermelondb/decorators';

export default class WorkEntry extends Model {
  static table = 'work_entries';

  static associations = {
    project_blocks: { type: 'belongs_to', key: 'block_id' },
  };

  @text('project_id')   projectId;
  @text('block_id')     blockId;
  @text('employee_id')  employeeId;
  @text('activity')     activity;
  @field('date')        date;
  @field('days_worked') daysWorked;
  @field('rate_per_day') ratePerDay;
  @field('total_cost')  totalCost;
  @field('hours_worked') hoursWorked;
  @text('image_url')    imageUrl;
  @field('location_lat') locationLat;
  @field('location_lng') locationLng;
  @text('status')       status;
  @field('is_recurring') isRecurring;
  @text('frequency')    frequency;
  @text('notes')        notes;
  @field('is_paid')     isPaid;
  @field('is_deleted')  isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @immutableRelation('project_blocks', 'block_id') block;
}

