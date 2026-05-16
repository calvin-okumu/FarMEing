# Architecture & Sync Improvements (May 2026)

This document outlines the architectural and synchronization improvements implemented to enhance the reliability, performance, and maintainability of the application.

## 1. Sync Reliability & Conflict Resolution
The sync process is critical for the offline-first architecture. The following changes make it more robust:

*   **Resilient Push:** The backend `sync/push` operation was refactored to remove the single global `$transaction`. Records are now processed iteratively. If one record fails validation or a database constraint, it is logged and skipped, allowing the rest of the sync payload to succeed. This prevents "sync deadlocks."
*   **Conflict Strategy (Server Delete Wins):** Before upserting a record from the client, the server now checks if that record has been soft-deleted (`isDeleted: true`). If it has, the client's update is ignored, preventing deleted data from being "resurrected."
*   **Detailed Sync Results:** The sync push response now includes a detailed `results` object, providing counts of created, updated, and deleted records per table, as well as specific error messages for failed records.

## 2. Performance Optimizations
*   **Parallelized Sync Pull:** The backend `sync/pull` operation was refactored to use `Promise.all()`. Database queries to fetch updates for the various tables now execute concurrently, significantly reducing the overall latency of the pull operation.

## 3. Architectural Refinement (Backend)
To reduce code duplication and improve consistency, the backend controllers were standardized:
*   **Validation Middleware:** A centralized `validateRequest` middleware using Zod was introduced. This shifts input validation to the route level, removing boilerplate from the controllers.
*   **Consolidated Access Checks:** Project access logic and standard database selection shapes were abstracted into a shared utility (`backend/src/lib/project-access.js`).
*   **Controller Standardization:** All controllers (Project, Employee, Expense, Budget, Harvest, Inventory, Payee, Payment, Sale, WorkEntry) were refactored to use the new validation middleware and shared access utilities.

## 4. Season Model Integration
The previously unused `Season` model has been fully integrated:
*   **Backend:** Created `season.controller.js`, `season.routes.js`, and validators. Registered the routes and added the model to the sync mapping utilities.
*   **Frontend:** Added the `seasons` table to the WatermelonDB schema (incrementing the version to 20), created the `Season` model, and added the necessary migration path in `migrations.js`.

## 5. Development Standards
*   Initialized **ESLint** and **Prettier** configurations in the project root to enforce code quality and formatting standards. Added `lint` and `format` scripts to `package.json`.

---

## Deployment: Onboarding Changes to the Staging Server

When pulling these changes to the staging server, specific steps must be followed to ensure the environment is correctly updated.

### Prerequisite: Pull Changes
```bash
git checkout staging # Or your target branch
git pull origin improve/sync-and-architecture
```

### Step 1: Update Dependencies
Because ESLint, Prettier, and related plugins were added to the root `package.json`, you must install the new dependencies.
```bash
npm install
```

### Step 2: Regenerate Prisma Client
**CRITICAL:** Even if the database schema (`schema.prisma`) hasn't changed structurally, pulling new code that alters how the backend interacts with Prisma (e.g., changes to models, relations, or sync logic) requires regenerating the client to ensure the generated types and query engine in `node_modules` are up-to-date.
```bash
cd backend
npx prisma generate
```

### Step 3: Apply Migrations (If Applicable)
Ensure the staging database has all current migrations applied. While the `Season` model already existed in the schema, it's best practice to ensure the database state matches the expected schema.
```bash
# Still in the backend directory
npx prisma migrate deploy
```
*Note: Always use `migrate deploy` on staging/production to apply migrations safely without resetting the database.*

### Step 4: Restart the Application Process
Because new routes (e.g., `/seasons`) were added and existing controller logic was extensively modified, the Node.js process must be restarted to load the new code into memory. Failure to restart can lead to crashes (like "argument handler must be a function") due to cached, outdated file references.
```bash
# Example using PM2
pm2 restart farmtrack-api
```
