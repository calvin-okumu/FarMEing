import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, nochange } from '@nozbe/watermelondb/decorators';

export default class FarmProject extends Model {
  static table = 'farm_projects';

  @nochange @text('remote_id')  remoteId;
  @text('user_id')    userId;
  @text('season_id')  seasonId;
  @text('name')       name;
  @text('crop')       crop;
  @field('land_size') landSize;
  @text('land_unit')  landUnit;
  @field('start_date') startDate;
  @field('end_date')   endDate;
  @text('notes')      notes;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @date('updated_at') updatedAt;
}
