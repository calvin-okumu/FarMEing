import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation } from '@nozbe/watermelondb/decorators';

export default class SaleHarvest extends Model {
  static table = 'sale_harvests';

  static associations = {
    sales: { type: 'belongs_to', key: 'sale_id' },
    harvests: { type: 'belongs_to', key: 'harvest_id' },
  };

  @text('sale_id')    saleId;
  @text('harvest_id') harvestId;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @immutableRelation('sales', 'sale_id') sale;
  @immutableRelation('harvests', 'harvest_id') harvest;
}
