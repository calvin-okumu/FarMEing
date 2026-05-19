import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class ProjectAccess extends Model {
  static table = 'project_access';

  @field('user_id') userId;
  @field('project_id') projectId;
  @field('role') role;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
