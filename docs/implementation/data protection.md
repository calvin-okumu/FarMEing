# FarmTrack Data Protection Plan

This plan defines how FarmTrack should protect user data as the application evolves beyond v1. The goal is to prevent data loss during app updates, backend changes, sync conflicts, server failures, and operator mistakes.

## Goals

- Never rely on a mobile device as the only copy of important data
- Make PostgreSQL the permanent source of truth
- Ensure backups exist, are stored off-server, and can be restored
- Avoid destructive schema changes during normal feature development
- Preserve recoverability for deleted or overwritten records
- Make sync behavior predictable when offline edits and server updates collide

## Current State

FarmTrack already has several good foundations:

- PostgreSQL + Prisma on the backend
- Offline-first mobile app with local persistence
- Sync metadata linking local records to backend records
- `createdAt` and `updatedAt` timestamps on backend models
- `isDeleted` soft-delete flags on most business records

These are strong starting points, but they must be backed by operational safeguards.

## Core Principles

### 1. Backend is the source of truth

The backend PostgreSQL database should be treated as the permanent record of business data.

Why:
- Phones can be lost, wiped, damaged, or reinstalled
- Local app storage can be corrupted
- Multiple devices may edit overlapping records

Rule:
- The mobile database is a cache plus offline work queue, not the final system of record

### 2. Backups must be automatic and off-server

A backup strategy must exist before the application is trusted with production data.

Minimum standard:
- Daily automated PostgreSQL backups
- At least 7 to 30 days of retention
- At least one copy stored off the application server
- Backup job failures must be visible and reviewed

Recommended standard:
- Daily full backups using `pg_dump`
- Encrypted storage in cloud object storage or another machine
- Weekly verification that backups are still being produced

### 3. Restores must be tested

A backup is only useful if it can be restored successfully.

Rule:
- Perform regular test restores into a separate database
- Confirm the restored database is readable by the app/backend
- Document the exact restore steps

Recommended cadence:
- At least one restore test after initial production launch
- Then monthly or before major releases

### 4. Prefer soft delete over hard delete

Business records should not be physically removed during normal app operation.

Current pattern:
- Many models already use `isDeleted`

Recommended evolution:
- Continue using soft deletes for all business entities
- Add `deletedAt` later for better recovery and auditability
- Avoid hard deletion except for true cleanup or non-business temp data

Why:
- Prevents accidental loss from UI mistakes
- Makes rollback and investigation easier
- Works better with offline sync

### 5. Use additive schema migrations

Schema changes are one of the biggest sources of accidental production data loss.

Rules:
- Prefer adding columns/tables over renaming or dropping them
- Backfill new fields before switching app logic
- Remove old fields only after a safe transition period
- Test migrations on a copy of production data before applying them live

Safe migration pattern:
1. Add new field
2. Deploy code that writes both old and new shapes if needed
3. Backfill existing data
4. Update reads to use the new field
5. Remove old field much later

### 6. Sync must be conflict-aware

Offline-first systems are vulnerable to silent overwrites.

Rules:
- Every synced record should keep reliable `updatedAt` metadata
- Sync should avoid blindly overwriting newer server data
- Conflict behavior should be defined per record type

Recommended conflict strategy:
- Simple editable records: last-write-wins, but only with timestamp comparison
- Financial/activity logs: prefer append-only behavior where possible
- Deletions: soft delete and sync tombstones instead of physical removal

High-risk record types:
- `Expense`
- `Payment`
- `Sale`
- `WorkEntry`
- `Harvest`

### 7. Critical actions should be auditable

Important changes should leave a trace.

Priority targets:
- Financial data
- Labor/payments
- Deletions
- Record edits that affect totals or status

Recommended future enhancement:
- Add an audit log table for create/update/delete events on critical models

Example fields:
- `id`
- `entityType`
- `entityId`
- `action`
- `actorUserId`
- `beforeJson`
- `afterJson`
- `createdAt`

## Recommended v1 Protection Plan

### Phase 1: Immediate safeguards

These should be implemented first.

- Set PostgreSQL as the official source of truth
- Automate daily backups
- Store backups off-server
- Keep soft delete behavior
- Avoid destructive Prisma migrations
- Document restore steps
- Verify backups by doing a test restore

### Phase 2: Sync hardening

These should follow once production usage begins.

- Review sync conflict handling for all business models
- Ensure server `updatedAt` is always respected
- Prevent older clients from silently overwriting newer backend changes
- Add better visibility for failed sync records
- Add recovery tooling for unsynced local records

### Phase 3: Audit and recovery improvements

These strengthen long-term trustworthiness.

- Add `deletedAt` to soft-deleted models
- Add audit logs for financial and labor records
- Add admin recovery tools for deleted items
- Add backup monitoring and alerting
- Add point-in-time recovery if production usage grows

## Backup Strategy

### Daily backup

Run a daily PostgreSQL backup job on the server.

Recommended contents:
- Full database dump
- Timestamped filename
- Compression enabled
- Encryption if stored externally

Recommended retention:
- 7 daily backups minimum
- 4 weekly backups if possible
- 3 monthly backups once the app matures

### Storage locations

Do not keep backups only on the same server.

Recommended options:
- Cloud object storage
- Another private server
- Encrypted external storage

Best practice:
- Follow the 3-2-1 idea where practical:
  - 3 copies of data
  - 2 different storage types
  - 1 copy offsite

### Backup checks

Each backup routine should confirm:
- the dump completed successfully
- the file size is reasonable
- the upload succeeded
- old backups are pruned according to retention

## Restore Procedure

At minimum, the team should have a documented restore flow:

1. Provision a clean PostgreSQL database
2. Restore the most appropriate backup
3. Point the backend to the restored database
4. Run smoke checks such as `/health`
5. Validate key business records in the app
6. Record what backup was used and why

Restore testing should happen before trusting the system in production.

## Migration Rules

When changing Prisma schema:

- Never drop a table or column without a recovery plan
- Never run untested destructive migrations on production first
- Always back up before applying production migrations
- Review whether older mobile clients can still sync after the schema change
- Prefer backward-compatible API changes

Before each production migration:
- Take a fresh backup
- Test the migration on a staging copy
- Verify rollback or restore steps
- Deploy during a controlled maintenance window if risk is high

## Mobile App Data Safety Rules

The mobile app should follow these rules:

- Save locally first when offline
- Keep a sync status on each local record
- Never assume local-only data is permanently safe until synced
- Surface failed sync states clearly to users/admins
- Avoid destructive local cleanup of unsynced records
- Preserve `remoteId` mapping carefully during sync

Recommended UX rule:
- Show whether a record is local-only, synced, or failed-to-sync

## Operational Checklist

Use this checklist before and after releases.

### Before release
- Backup completed successfully
- New migration tested on non-production data
- Sync changes reviewed for conflicts
- Old app versions considered
- Restore steps still valid

### After release
- Health endpoint works
- Key records still load correctly
- Create/update/delete flows still sync
- Backup job still runs
- No increase in sync failures

## Recommended Next Enhancements

These are the best follow-up improvements for FarmTrack:

1. Add automated PostgreSQL backup scripts plus offsite upload
2. Add a restore runbook under `docs/`
3. Add sync conflict rules per model
4. Add `deletedAt` alongside `isDeleted`
5. Add an audit log for payments, expenses, sales, and work entries
6. Add monitoring for backup failures and sync failure spikes

## Practical Standard for v1

For FarmTrack v1, "data is protected" should mean:

- The backend database is the source of truth
- The database is backed up automatically every day
- Backups are stored off-server
- Restores have been tested
- Records are soft-deleted, not hard-deleted
- Schema changes are additive by default
- Sync does not silently destroy newer data

If all of the above are true, the risk of permanent data loss drops significantly.
