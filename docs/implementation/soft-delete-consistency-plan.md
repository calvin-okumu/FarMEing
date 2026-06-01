# FarmTrack Soft Delete Consistency Plan

This plan defines how FarmTrack should make soft delete behavior consistent across the backend, mobile app, sync layer, and derived reporting. The goal is to ensure deleted records never disappear permanently by mistake, never reappear unexpectedly, and never continue affecting totals after deletion.

## Goal

- Use one soft delete rule for all business records
- Keep deleted records recoverable at the database level
- Hide deleted records from normal app flows
- Ensure offline deletes sync safely
- Prevent deleted records from affecting summaries, totals, and dashboards

## Current Findings

FarmTrack uses `isDeleted` uniformly across all business models.

- Backend schema uses `isDeleted` for all business models (including `Payment`).
- Frontend local models store `is_deleted` and expose it as `isDeleted`.
- Sync fully supports tombstones and pending deletes.
- All delete endpoints perform soft delete via a comprehensive cascading transaction.
- Project access verification strictly filters out soft-deleted records.

## Standard Rule

For every business entity in scope:

- Delete means setting `isDeleted = true`
- Normal reads must exclude deleted records (`where: { isDeleted: false }`)
- Updates to deleted records are rejected
- Sync preserves deletion state until the server confirms it
- Hard delete is strictly forbidden in user workflows

## Scope

The rule is applied consistently to:

- `FarmProject`
- `BudgetItem`
- `Expense`
- `Employee`
- `WorkEntry`
- `Payment`
- `Harvest`
- `Sale`
- `InventoryItem`
- `Equipment`
- `ProjectAccess`
- `ProjectInvitation`
- `EmployeeProject`

---

## Implementation Status: COMPLETED

### Backend Standardized
- All controllers (`Sale`, `Harvest`, `Expense`, etc.) use `verifyProjectAccess` and filter by `isDeleted: false`.
- `deleteProject` in `project.controller.js` implements a **comprehensive cascading soft-delete** of all 12+ related entities within a single database transaction.
- `checkProjectAccess` helper filters out soft-deleted access rows to prevent unauthorized data access after a member is removed.

### Frontend Standardized
- Deletions are routed through `markRecordDeleted` in `localRecord.js`.
- All forms (`AddSaleScreen`, `AddExpenseScreen`) correctly update `updatedAt` and `isDeleted` flags.

### Sync Standardized
- `sync.controller.js` implements the same cascading soft-delete logic for projects initiated from the mobile app.
- `fieldMapping` includes all synchronization-critical fields.
- `fromWatermelon` correctly handles all date-type fields (including `dueDate`).

## Phase 1: Close Schema Gaps

### Backend

- Add `isDeleted Boolean @default(false)` to `Payment` in `backend/prisma/schema.prisma`
- Create and apply a Prisma migration for the new column
- Confirm no other business model used by the app is missing `isDeleted`

### Frontend

- Confirm every WatermelonDB table in `frontend/src/db/schema.js` has `is_deleted`
- Confirm every model in `frontend/src/db/models/` exposes `isDeleted`

## Phase 2: Standardize Backend Behavior

For every in-scope controller:

- `GET` list endpoints must filter with `isDeleted: false`
- `GET by id` endpoints must treat deleted records as not found unless there is an explicit admin path
- `PUT/PATCH` endpoints must reject deleted records
- `DELETE` endpoints must update `isDeleted: true`

### Payment-specific work

- Add a delete controller for payments
- Add `DELETE /payments/:id`
- Update payment listing to exclude deleted rows
- Ensure payment totals ignore deleted rows

## Phase 3: Standardize Frontend Delete Flows

All user-triggered deletes should follow the same local behavior.

- Use `markRecordDeleted(...)` from `frontend/src/utils/localRecord.js`
- Avoid direct ad hoc `record.isDeleted = true` patterns in screen components
- Ensure newly created local records always set `isDeleted = false`
- Keep deleted local records hidden from normal lists immediately

Priority screens to audit:

- `frontend/src/screens/ProjectsScreen.js`
- `frontend/src/screens/EmployeeDetailScreen.js`
- `frontend/src/screens/ProjectDetailScreen.js`
- Any screen that removes expenses, budget items, sales, harvests, work entries, inventory, or payments

## Phase 4: Standardize Sync Semantics

The sync layer should use one deletion contract for all models.

- Local delete sets `isDeleted = true`
- Local delete sets `syncStatus = pending_delete`
- Sync sends `DELETE` to the backend when `remoteId` exists
- Local record is only purged after the backend confirms deletion
- Remote `isDeleted` must be pulled back into local storage consistently

### Conflict rule

Recommended default:

- Server delete wins over stale local updates

That means if one device deletes a record and another device later syncs an outdated edit, the deleted state should remain authoritative unless an intentional restore flow exists.

### Parent-child behavior

When parent records are soft-deleted:

- Child records must not keep appearing in normal UI flows
- Sync must not recreate orphaned active children unintentionally
- Summary endpoints must treat deleted parents and deleted children consistently

## Phase 5: Audit Query and Reporting Behavior

Soft delete is not complete unless every derived view respects it.

Audit these areas:

- Backend summaries and aggregate queries
- Dashboard totals
- Project detail rollups
- Employee payment totals
- Frontend local analytics in `frontend/src/utils/localAnalytics.js`
- Any list, search, filter, or count displayed in the UI

Expected rule:

- Deleted records never contribute to totals, counts, or summary cards unless the screen is explicitly a recycle-bin or admin recovery view

## Phase 6: Testing and Verification

### Backend tests

For each in-scope entity:

1. Create a record
2. Delete it
3. Confirm list endpoints no longer show it
4. Confirm fetch-by-id returns not found or equivalent
5. Confirm updates are blocked
6. Confirm related totals exclude it

### Frontend and sync tests

Verify these cases:

- Delete a local-only unsynced record
- Delete a synced record while online
- Delete a synced record while offline, then sync later
- Receive a remotely deleted record during pull sync
- Delete a payment and verify it disappears from totals

### Regression checklist

- Deleted records do not reappear after refresh
- Deleted records do not reappear after full sync
- Deleted records do not contribute to dashboard metrics
- Deleted records do not break relationships or screens

## Implementation Order

1. Add backend `Payment.isDeleted` and migration
2. Add backend payment delete support and filtered payment queries
3. Audit frontend delete handlers and route them through `markRecordDeleted(...)`
4. Audit sync coverage for all tables, especially payments
5. Audit analytics and summary calculations
6. Add tests and release checklist

## Recommended Defaults

- Soft delete all business records, including payments
- Hide deleted records from all normal reads
- Keep local tombstones until the backend confirms deletion
- Do not hard-delete in normal app flows
- Do not build restore UI yet
- Consider adding `deletedAt` later for audit and recovery

## Definition of Done

Soft delete is consistent across the app when all of the following are true:

- Every in-scope business model has `isDeleted` locally and remotely
- Every delete endpoint performs soft delete only
- Every normal query excludes deleted records
- Every update path rejects deleted records
- Every sync path preserves and respects deleted state
- Every total, metric, and summary excludes deleted data
- `Payment` follows the same behavior as the rest of the app
