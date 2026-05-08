import { Model } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';

export default class Employee extends Model {
  static table = 'employees';
  static associations = {
    farm_projects: { type: 'belongs_to', key: 'project_id' },
  };

  @text('user_id')    userId;
  @text('project_id') projectId;
  @text('name')       name;
  @text('phone')      phone;
  @text('role')       role;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @relation('farm_projects', 'project_id') project;
}
