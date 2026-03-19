import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Harvest extends Model {
  static table = 'harvests';

  @text('remote_id') remoteId;
  @text('project_id') projectId;
  @text('crop') crop;
  @date('date') date;
  @field('weight') weight;
  @text('unit') unit;
  @text('quality') quality;
  @text('notes') notes;
  @field('is_deleted') isDeleted;
  @readonly('created_at') createdAt;
  @readonly('updated_at') updatedAt;
}
