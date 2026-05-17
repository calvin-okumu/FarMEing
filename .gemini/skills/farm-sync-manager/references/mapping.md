# Field Mapping Rules

The sync system maps between Prisma's `camelCase` and WatermelonDB's `snake_case`.

## Automatic Mapping
Standard fields like `id`, `name`, `status`, `notes` are mapped automatically if they match exactly.

## Explicit Mapping
All other fields MUST be added to the `fieldMapping` object in `backend/src/controllers/sync.controller.js`.

### Conventions:
- **Foreign Keys**: `projectId` -> `project_id`, `payeeId` -> `payee_id`.
- **Booleans**: `isDeleted` -> `is_deleted`, `isRecurring` -> `is_recurring`.
- **Numbers/Dates**: `landSize` -> `land_size`, `startDate` -> `start_date`.

## Date Handling
- **Server (Prisma)**: Uses standard JS `Date` objects.
- **Client (Watermelon)**: Uses Unix milliseconds (number).
- **Conversion**:
  - `toWatermelon`: `value.getTime()`
  - `fromWatermelon`: `new Date(value)`

The `sync.controller.js` helpers `toWatermelon` and `fromWatermelon` handle this automatically based on the `dateFields` list in `fromWatermelon`.
