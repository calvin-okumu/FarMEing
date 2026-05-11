import { Model } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';

export default class FarmProject extends Model {
  static table = 'farm_projects';
  static associations = {
    employee_project_assignments: { type: 'has_many', foreignKey: 'project_id' },
  };

  get remoteId() {
    return this._raw.remote_id || null;
  }

  @text('user_id')    userId;
  @text('season_id')  seasonId;
  @text('name')       name;
  @text('crop')       crop;
  @field('land_size') landSize;
  @text('land_unit')  landUnit;
  @field('start_date') startDate;
  @field('end_date')   endDate;
  @field('expected_yield') expectedYield;
  @text('status')     status;
  @text('notes')      notes;
  @text('contract_url') contractUrl;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @children('employee_project_assignments') assignments;
}
