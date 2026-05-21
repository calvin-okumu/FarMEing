import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Equipment extends Model {
  static table = 'equipments';

  @field('project_id') projectId;
  @field('name') name;
  @field('type') type;
  @field('model') model;
  @field('serial_number') serialNumber;
  @field('purchase_date') purchaseDate;
  @field('purchase_price') purchasePrice;
  @field('status') status;
  @field('notes') notes;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
}
