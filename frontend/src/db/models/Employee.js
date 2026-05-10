import { Model } from '@nozbe/watermelondb';
import { field, children, text } from '@nozbe/watermelondb/decorators';

export default class Employee extends Model {
  static table = 'employees';
  static associations = {
    employee_project_assignments: { type: 'has_many', foreignKey: 'employee_id' },
  };

  @text('user_id')    userId;
  @text('name')       name;
  @text('phone')      phone;
  @text('role')       role;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @children('employee_project_assignments') assignments;
}
