---
name: farm-sync-manager
description: Manages the complex bi-directional sync lifecycle between WatermelonDB and Prisma. Use when adding new tables to sync, updating field mappings, or troubleshooting synchronization conflicts and security scoping.
---

# Farm Sync Manager

This skill provides guidance and automation for the offline-first synchronization system.

## Workflow

1.  **Field Mapping**: Map Prisma camelCase fields to WatermelonDB snake_case fields.
2.  **Sync Order**: Define the order of operations in `push` to respect foreign key constraints.
3.  **Security Scoping**: Implement user-specific data filtering in `pull`.
4.  **Conflict Resolution**: Manage how data is merged (default: server-delete wins).

## Key Files

- **Backend Logic**: `backend/src/controllers/sync.controller.js`
- **Frontend Logic**: `frontend/src/services/syncService.js`
- **Database Schema**: `backend/prisma/schema.prisma` and `frontend/src/db/schema.js`

## Reference Guides

- **Field Mapping Rules**: See [mapping.md](references/mapping.md) for naming conventions and date handling.
- **Scoping & Security**: See [scoping.md](references/scoping.md) for patterns on filtering data by project or user.
- **Troubleshooting**: See [troubleshooting.md](references/troubleshooting.md) for common sync errors (e.g., ID collisions, 401s).

## Standards

- **Dates**: Always convert to/from Unix ms timestamps when syncing.
- **Soft Delete**: `isDeleted` flag must be synced and handled in `pull`.
- **Project Scope**: Most data should be scoped via `ProjectAccess`.
- **Foreign Keys**: Ensure parent records are synced before child records in `SYNC_ORDER`.
