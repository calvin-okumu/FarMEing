# Soft-Delete Implementation

## Principle: Never Hard Delete

The project mandate is to preserve all data for audit and synchronization purposes.

### Prisma Queries

#### 1. Listing / Finding
Always include `isDeleted: false` in the `where` clause.

```javascript
const records = await prisma.expense.findMany({
  where: { 
    projectId: id, 
    isDeleted: false 
  }
});
```

#### 2. Deleting
Update the `isDeleted` flag instead of using `delete()`.

```javascript
await prisma.expense.update({
  where: { id: req.params.id },
  data: { isDeleted: true }
});
```

### WatermelonDB (Frontend)

The frontend also respects the `is_deleted` column. 
- When a record is "deleted" locally, it is marked with `_status: 'deleted'` (Watermelon internal) AND `is_deleted: true`.
- The sync process uses `is_deleted` to communicate soft-deletes to the server.

### Global Audit Rule
If you find a query in the codebase that does NOT filter by `isDeleted`, it is considered a **security and data integrity bug** and must be fixed immediately.
- Exception: Sync `pull` logic, which needs to see deleted records to notify clients.
- Exception: "Admin" or "Trash" views where deleted items are explicitly listed.
