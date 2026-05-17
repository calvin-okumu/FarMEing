# Sync Integration Guide

When adding a new entity, you must update `backend/src/controllers/sync.controller.js` to ensure it is correctly synchronized between the server and the mobile app.

## 1. Update `tableMap`

Add the mapping from WatermelonDB table name (snake_case) to Prisma model name (camelCase).

```javascript
const tableMap = {
  // ...
  {{tableName}}: '{{entity}}',
};
```

## 2. Update `SYNC_ORDER`

Add the table name to `SYNC_ORDER`. If the entity depends on another (e.g., via foreign key), place it AFTER its dependencies.

```javascript
const SYNC_ORDER = [
  // ...
  '{{tableName}}',
];
```

## 3. Update `fieldMapping`

If your new entity has fields that differ between camelCase (Prisma) and snake_case (Watermelon), add them to `fieldMapping`.

```javascript
const fieldMapping = {
  // ...
  {{fieldMapping}}
};
```

## 4. Scoping Logic in `pull`

Ensure the entity is correctly scoped to the user's accessible projects in the `pull` export. If it has a `projectId` field, it should usually be included in the project-based filter:

```javascript
} else if (['budgetItem', 'expense', ..., '{{entity}}'].includes(prismaModel)) {
  where.projectId = { in: accessibleProjectIds };
}
```
