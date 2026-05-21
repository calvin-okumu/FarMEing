import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation, children } from '@nozbe/watermelondb/decorators';

export default class Harvest extends Model {
  static table = 'harvests';

  static associations = {
    project_blocks: { type: 'belongs_to', key: 'block_id' },
    sale_harvests: { type: 'has_many', foreignKey: 'harvest_id' },
  };

  @text('project_id') projectId;
  @text('block_id')   blockId;
  @text('crop') crop;
  @field('date') date;
  @field('weight') weight;
  @field('rejected_weight') rejectedWeight;
  @text('rejected_reason') rejectedReason;
  @text('unit') unit;
  @text('quality') quality;
  @text('notes') notes;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @immutableRelation('project_blocks', 'block_id') block;
  @children('sale_harvests') saleHarvests;

  get approvedWeight() {
    return Math.max(0, this.weight - (this.rejectedWeight || 0));
  }
}

