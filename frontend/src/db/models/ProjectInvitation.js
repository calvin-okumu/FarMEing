import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class ProjectInvitation extends Model {
  static table = 'project_invitations';

  @field('project_id') projectId;
  @field('role') role;
  @field('invite_code') inviteCode;
  @date('expires_at') expiresAt;
  @field('is_used') isUsed;
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
