import { Model } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';

export default class Season extends Model {
  static table = 'seasons';
  static associations = {
    farm_projects: { type: 'has_many', foreignKey: 'season_id' },
  };

  @text('user_id') userId;
  @text('name') name;
  @field('start_date') startDate;
  @field('end_date') endDate;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @children('farm_projects') projects;
}
