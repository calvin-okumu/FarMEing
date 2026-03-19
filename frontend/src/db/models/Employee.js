import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, nochange } from '@nozbe/watermelondb/decorators';

export default class Employee extends Model {
  static table = 'employees';

  @nochange @text('remote_id')  remoteId;
  @text('user_id')    userId;
  @text('name')       name;
  @text('phone')      phone;
  @text('role')       role;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @date('updated_at') updatedAt;
}
