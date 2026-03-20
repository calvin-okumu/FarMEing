import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Harvest extends Model {
  static table = 'harvests';

  @text('remote_id') remoteId;
  @text('project_id') projectId;
  @text('crop') crop;
  @field('date') date;
  @field('weight') weight;
  @text('unit') unit;
  @text('quality') quality;
  @text('notes') notes;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
  @text('sync_status') syncStatus;
  @field('last_synced_at') lastSyncedAt;
  @text('last_error') lastError;
}
