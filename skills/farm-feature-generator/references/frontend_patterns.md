# Frontend Patterns for Domain Entities

## WatermelonDB Schema Template

```javascript
tableSchema({
  name: '{{tableName}}',
  columns: [
    { name: 'project_id', type: 'string' },
    {{columns}}
    { name: 'is_deleted', type: 'boolean' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
}),
```

## WatermelonDB Model Template

```javascript
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class {{Entity}} extends Model {
  static table = '{{tableName}}';

  @field('project_id') projectId;
  {{modelFields}}
  @field('is_deleted') isDeleted;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
```

## Screen Template (Add/Edit)

```javascript
import { StitchSurface, StitchInput, StitchPrimaryButton } from '../components/ui/StitchPrimitives';
// ... standard imports

export default function Add{{Entity}}Screen({ route, navigation }) {
  // ... state for each field
  
  const handleSave = async () => {
    // ... validation
    await database.write(async () => {
      if (itemId) {
        // ... update
      } else {
        await database.get('{{tableName}}').create(record => {
          initializeLocalRecord(record);
          record.projectId = projectId;
          {{setFields}}
        });
      }
    });
    navigation.goBack();
  };

  return (
    <StitchDashboardShell hero={...}>
      <StitchSurface>
        {{inputs}}
      </StitchSurface>
      <StitchPrimaryButton label="Save" onPress={handleSave} />
    </StitchDashboardShell>
  );
}
```
