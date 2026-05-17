# Scoping & Security

The `pull` endpoint in `sync.controller.js` must ensure users only receive data they are authorized to see.

## Scoping Patterns

### 1. User-Level Scope
Models owned by the user (e.g., `User`, `Season`, `Employee`, `Payee`).
```javascript
where.userId = req.user.id;
```

### 2. Project-Level Scope
Most domain data is scoped via `projectId`. The user must have a record in `ProjectAccess` or be the project owner.
```javascript
const accessibleProjectIds = await getAccessibleProjectIdsForUser(req.user.id);
where.projectId = { in: accessibleProjectIds };
```

### 3. Indirect Scope
Models linked via another model (e.g., `SalePayment` linked via `Sale`).
```javascript
where.sale = { projectId: { in: accessibleProjectIds } };
```

## Security Implementation
Security is enforced in both `pull` (filtering outgoing data) and `push` (scoping deletions and verifying ownership).
- **Push Deletion**: Always verify user role before allowing a soft-delete update.
- **Push Upsert**: Ensure `userId` is injected for top-level models.
