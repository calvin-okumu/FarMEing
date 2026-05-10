import { Model } from '@nozbe/watermelondb';
import { text, date, immutableRelation, readonly } from '@nozbe/watermelondb/decorators';

export default class EmployeeProjectAssignment extends Model {
  static table = 'employee_project_assignments';

  static associations = {
    employees: { type: 'belongs_to', key: 'employee_id' },
    farm_projects: { type: 'belongs_to', key: 'project_id' },
  };

  @text('employee_id') employeeId;
  @text('project_id')  projectId;
  @readonly @date('created_at') createdAt;

  @immutableRelation('employees', 'employee_id')     employee;
  @immutableRelation('farm_projects', 'project_id') project;
}
