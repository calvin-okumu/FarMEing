import { Model } from '@nozbe/watermelondb';
import { field, text, children, relation } from '@nozbe/watermelondb/decorators';

export default class ProjectBlock extends Model {
  static table = 'project_blocks';
  static associations = {
    farm_projects: { type: 'belongs_to', key: 'project_id' },
    budget_items: { type: 'has_many', foreignKey: 'block_id' },
    expenses: { type: 'has_many', foreignKey: 'block_id' },
    work_entries: { type: 'has_many', foreignKey: 'block_id' },
    harvests: { type: 'has_many', foreignKey: 'block_id' },
  };

  @text('project_id') projectId;
  @text('name')       name;
  @field('land_size') landSize;
  @text('land_unit')  landUnit;
  @text('crop')       crop;
  @text('crop_variety') cropVariety;
  @field('expected_yield') expectedYield;
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;

  @relation('farm_projects', 'project_id') project;
  @children('budget_items') budgetItems;
  @children('expenses') expenses;
  @children('work_entries') workEntries;
  @children('harvests') harvests;
}
