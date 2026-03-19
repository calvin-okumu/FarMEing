# Frontend Documentation

[← Back to README](./README.md)

## Table of Contents

1. [Stack](#stack)
2. [How to Run](#how-to-run)
3. [Folder Structure](#folder-structure)
4. [Auth Flow](#auth-flow)
5. [Navigation Structure](#navigation-structure)
6. [Screen Inventory](#screen-inventory)
7. [WatermelonDB Setup](#watermelondb-setup)
8. [Sync Service](#sync-service)
9. [Offline Strategy](#offline-strategy)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 55 / React Native |
| Navigation | React Navigation (`@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`) |
| Local database | WatermelonDB (`@nozbe/watermelondb`) with SQLite adapter via `expo-sqlite` |
| Server state / cache | TanStack React Query (`@tanstack/react-query`) |
| Global auth state | Zustand (`zustand`) |
| HTTP client | Axios (via `src/lib/api.js`) |
| Secure storage | `expo-secure-store` |
| Icons | `@expo/vector-icons` (Ionicons) |
| Image picking | `expo-image-picker` |
| Gestures | `react-native-gesture-handler` |

---

## How to Run

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Start Expo development server
npx expo start

# 3. Run on Android (requires connected device or emulator)
npx expo run:android
```

The app connects to the backend API. Ensure the API base URL in `src/lib/api.js` points to your running backend server.

> The SQLite adapter runs with JSI disabled (`jsi: false`) for Expo Go compatibility.

---

## Folder Structure

```
frontend/
├── App.js                        # Root component — providers and hydration
└── src/
    ├── db/
    │   ├── index.js              # Database instance and collection exports
    │   ├── schema.js             # WatermelonDB table/column definitions (version 3)
    │   └── models/
    │       ├── FarmProject.js
    │       ├── BudgetItem.js
    │       ├── Expense.js
    │       ├── WorkEntry.js
    │       ├── Employee.js
    │       └── Payment.js
    ├── navigation/
    │   ├── RootNavigator.js      # Auth gate — shows auth stack or tab navigator
    │   └── TabNavigator.js       # Bottom tab navigator with nested stacks
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.js
    │   │   └── RegisterScreen.js
    │   ├── ProjectsScreen.js
    │   ├── ProjectDetailScreen.js
    │   ├── AddBudgetItemScreen.js
    │   ├── AddExpenseScreen.js
    │   ├── EmployeesScreen.js
    │   ├── EmployeeDetailScreen.js
    │   ├── QuickEntryScreen.js
    │   ├── DashboardScreen.js
    │   ├── ReportsScreen.js
    │   └── SettingsScreen.js
    ├── services/
    │   └── syncService.js        # Pull-only sync from API → WatermelonDB
    ├── store/
    │   └── useAuthStore.js       # Zustand auth store
    ├── hooks/
    │   └── useSync.js            # Hook that triggers syncAll on foreground
    └── lib/
        └── api.js                # Axios instance with auth header injection
```

---

## Auth Flow

Authentication is managed by `src/store/useAuthStore.js`, a Zustand store. Credentials are persisted to `expo-secure-store`.

### Store shape

| Property | Type | Description |
|---|---|---|
| `token` | `string \| null` | JWT access token |
| `user` | `object \| null` | User data (`id`, `name`, `phone`, `currency`, `locale`) |
| `isLoading` | `boolean` | `true` until `hydrate()` completes on first app boot |

### Store actions

| Action | Description |
|---|---|
| `hydrate()` | Reads `auth_token` and `auth_user` from `SecureStore` in parallel. Called once in `App.js` via `useEffect`. Sets `isLoading: false` when done. |
| `register({ name, phone, password })` | `POST /auth/register` → persists token and user to `SecureStore` → updates Zustand state. |
| `login({ phone, password })` | `POST /auth/login` → persists token and user to `SecureStore` → updates Zustand state. |
| `logout()` | Deletes both `SecureStore` keys → sets `token` and `user` to `null`. |

### SecureStore keys

| Key | Value |
|---|---|
| `auth_token` | Raw JWT string |
| `auth_user` | JSON-serialized user object |

### Auth gate

`RootNavigator` watches the `token` value from the Zustand store. When `token` is `null` the auth stack (Login/Register screens) is shown; when `token` is set, the main tab navigator is shown. During hydration (`isLoading: true`) a loading screen is displayed.

---

## Navigation Structure

```
RootNavigator
├── Auth Stack (shown when token is null)
│   ├── LoginScreen
│   └── RegisterScreen
└── TabNavigator (shown when token is set)
    ├── Projects tab  →  ProjectStackNavigator
    │   ├── ProjectsList     (ProjectsScreen)
    │   ├── ProjectDetail    (ProjectDetailScreen)
    │   ├── AddBudgetItem    (AddBudgetItemScreen)
    │   └── AddExpense       (AddExpenseScreen)
    ├── Employees tab  →  EmployeeStackNavigator
    │   ├── EmployeesList    (EmployeesScreen)
    │   └── EmployeeDetail   (EmployeeDetailScreen)
    ├── QuickEntry tab   →  QuickEntryScreen  (headerShown: true)
    ├── Dashboard tab    →  DashboardScreen   (headerShown: true)
    └── Settings tab     →  SettingsScreen    (headerShown: true)
```

### Tab icons (Ionicons)

| Tab | Focused icon | Unfocused icon |
|---|---|---|
| Projects | `leaf` | `leaf-outline` |
| Employees | `people` | `people-outline` |
| QuickEntry | `add-circle` | `add-circle-outline` |
| Dashboard | `grid` | `grid-outline` |
| Settings | `settings` | `settings-outline` |

Tab bar colours: active `#16a34a` (green-600), inactive `#9ca3af` (gray-400). All stack headers share the same green background (`#16a34a`) with white text.

---

## Screen Inventory

### Auth screens

#### `src/screens/auth/LoginScreen.js`

**Purpose:** Phone + password login form.

**Key features:**
- Calls `useAuthStore.login({ phone, password })`.
- Inline validation — alerts if either field is empty.
- Password visibility toggle.
- Navigation handled automatically by `RootNavigator` on token change.
- Link to `RegisterScreen`.

---

#### `src/screens/auth/RegisterScreen.js`

**Purpose:** New account creation form.

**Key features:**
- Calls `useAuthStore.register({ name, phone, password })`.
- Fields: name, phone, password, confirm password.
- Client-side password match check before submitting.
- Link back to `LoginScreen`.

---

### Main screens

#### `src/screens/ProjectsScreen.js`

**Purpose:** Master list of all farm projects.

**Key features:**
- Reads projects from WatermelonDB (`farm_projects` collection, `is_deleted = false`).
- Pull-to-refresh triggers `syncAll()` then reloads from local DB.
- Inline modal form to create a new project (fields: name, crop, landSize, landUnit, startDate). Writes directly to the API via `POST /projects` then calls `syncAll()`.
- Swipe-to-delete row action (calls `DELETE /projects/:id` then `syncAll()`).
- Navigates to `ProjectDetail` on row tap.

---

#### `src/screens/ProjectDetailScreen.js`

**Purpose:** Detail view for a single project with tabbed sub-sections.

**Key features:**
- Receives `projectId` via `route.params`.
- Loads project, budget items, and expenses from local WatermelonDB.
- Two tabs: **Budget** and **Expenses**.
- Budget tab: lists budget items with totals; FAB navigates to `AddBudgetItem`.
- Expenses tab: lists expenses; FAB navigates to `AddExpense`.
- Pull-to-refresh triggers `syncAll()`.

---

#### `src/screens/AddBudgetItemScreen.js`

**Purpose:** Form to add a budget item to a project.

**Key features:**
- Receives `projectId` via `route.params`.
- Category picker with predefined options: Seeds, Fertilizer, Pesticides, Labor, Equipment, Fuel, Irrigation, Other.
- Fields: category, name, quantity, unit, unitPrice.
- Submits via `POST /budget`, then calls `syncAll()` before navigating back.

---

#### `src/screens/AddExpenseScreen.js`

**Purpose:** Form to record an actual expense against a project.

**Key features:**
- Receives `projectId` via `route.params`.
- Category picker: Seeds, Fertilizer, Pesticides, Labor, Equipment, Fuel, Irrigation, Transport, Other.
- Fields: category, amount, date, note, receipt image.
- Receipt image can be picked from the device library via `expo-image-picker`.
- Submits via `POST /expenses`, then calls `syncAll()` before navigating back.

---

#### `src/screens/EmployeesScreen.js`

**Purpose:** Master list of all employees.

**Key features:**
- Reads employees from WatermelonDB (`employees` collection, `is_deleted = false`).
- Pull-to-refresh triggers `syncAll()`.
- Inline modal to create an employee (fields: name, phone, role). Writes to `POST /employees` then syncs.
- Swipe-to-delete row action (calls `DELETE /employees/:id` then syncs).
- Navigates to `EmployeeDetail` on row tap.

---

#### `src/screens/EmployeeDetailScreen.js`

**Purpose:** Detail view for a single employee showing work history and payment ledger.

**Key features:**
- Receives `employeeId` via `route.params`.
- Two tabs: **Work** (work entries from local DB) and **Payments** (payments from local DB).
- Displays outstanding balance fetched from `GET /employees/:id/balance`.
- Add work entry modal (fields: project selector, activity, date, days worked, rate per day). Submits to `POST /work-entries`.
- Add payment modal (fields: amount, date, note). Submits to `POST /payments`.
- Predefined activity list: Planting, Weeding, Harvesting, Spraying, Irrigation, Fertilizing, Other.
- Pull-to-refresh triggers `syncAll()`.

---

#### `src/screens/QuickEntryScreen.js`

**Purpose:** Single-screen rapid work-entry form without navigating into a project first.

**Key features:**
- Loads projects and employees from local WatermelonDB on mount.
- Project selector dropdown and employee selector dropdown (with text filter).
- Fields: activity (picker from Planting, Weeding, Harvesting, Spraying, Other), number of workers, days worked, rate per day, date.
- Submits to `POST /work-entries`, then calls `syncAll()`.
- Designed for field use — keyboard is dismissed on submit.

---

#### `src/screens/DashboardScreen.js`

**Purpose:** Financial overview dashboard aggregated per project.

**Key features:**
- Project selector dropdown — loads projects from local DB.
- On project selection, fetches summary from `GET /projects/:id/summary` (live API call).
- Displays: total budget, total expenses, total labor cost, total cost.
- Loads labor breakdown by employee and by activity from local WatermelonDB work entries.
- Calculates unpaid balance for displayed entries.
- Pull-to-refresh triggers `syncAll()` then reloads all figures.

---

#### `src/screens/ReportsScreen.js`

**Purpose:** Placeholder screen for future project summaries and financial reports.

**Key features:**
- Renders a static message: _"Project summaries and financial reports will appear here."_

---

#### `src/screens/SettingsScreen.js`

**Purpose:** User profile display and logout.

**Key features:**
- Reads `user` object from `useAuthStore`.
- Displays name, phone, currency, and locale from the user profile.
- Logout button triggers a confirmation `Alert`, then calls `useAuthStore.logout()`.

---

## WatermelonDB Setup

### Configuration (`src/db/index.js`)

- **Adapter:** `SQLiteAdapter` from `@nozbe/watermelondb/adapters/sqlite` (uses `expo-sqlite` under the hood).
- **Database name:** `farmtrack`
- **JSI:** disabled (`jsi: false`) for Expo Go compatibility.
- **Model classes:** `FarmProject`, `BudgetItem`, `Expense`, `WorkEntry`, `Employee`, `Payment`.

Convenience collection exports:

```js
export const projectsCollection    = database.get('farm_projects');
export const budgetItemsCollection = database.get('budget_items');
export const expensesCollection    = database.get('expenses');
export const workEntriesCollection = database.get('work_entries');
export const employeesCollection   = database.get('employees');
export const paymentsCollection    = database.get('payments');
```

### Schema version

`appSchema` is at **version 3** (`src/db/schema.js`).

### Tables and columns

#### `farm_projects`

| Column | Type | Optional |
|---|---|---|
| `remote_id` | string | no |
| `user_id` | string | no |
| `season_id` | string | yes |
| `name` | string | no |
| `crop` | string | no |
| `land_size` | number | no |
| `land_unit` | string | no |
| `start_date` | number | no | Unix ms timestamp |
| `end_date` | number | yes | Unix ms timestamp |
| `notes` | string | yes |
| `is_deleted` | boolean | no |
| `created_at` | number | no |
| `updated_at` | number | no |

---

#### `budget_items`

| Column | Type | Optional |
|---|---|---|
| `remote_id` | string | no |
| `project_id` | string | no |
| `category` | string | no |
| `name` | string | no |
| `quantity` | number | no |
| `unit` | string | no |
| `unit_price` | number | no |
| `is_deleted` | boolean | no |
| `created_at` | number | no |
| `updated_at` | number | no |

> Note: `total` (computed server-side) is not stored locally; it must be recalculated from `quantity × unit_price` if needed in the UI.

---

#### `expenses`

| Column | Type | Optional |
|---|---|---|
| `remote_id` | string | no |
| `project_id` | string | no |
| `category` | string | no |
| `amount` | number | no |
| `date` | number | no | Unix ms timestamp |
| `note` | string | yes |
| `receipt_url` | string | yes |
| `is_deleted` | boolean | no |
| `created_at` | number | no |
| `updated_at` | number | no |

---

#### `work_entries`

| Column | Type | Optional |
|---|---|---|
| `remote_id` | string | no |
| `project_id` | string | no |
| `employee_id` | string | no |
| `activity` | string | no |
| `date` | number | no | Unix ms timestamp |
| `days_worked` | number | no |
| `rate_per_day` | number | no |
| `total_cost` | number | no |
| `notes` | string | yes |
| `is_paid` | boolean | no |
| `is_deleted` | boolean | no |
| `created_at` | number | no |
| `updated_at` | number | no |

---

#### `employees`

| Column | Type | Optional |
|---|---|---|
| `remote_id` | string | no |
| `user_id` | string | no |
| `name` | string | no |
| `phone` | string | yes |
| `role` | string | yes |
| `is_deleted` | boolean | no |
| `created_at` | number | no |
| `updated_at` | number | no |

---

#### `payments`

| Column | Type | Optional |
|---|---|---|
| `remote_id` | string | no |
| `employee_id` | string | no |
| `amount` | number | no |
| `date` | number | no | Unix ms timestamp |
| `note` | string | yes |
| `is_deleted` | boolean | no |
| `created_at` | number | no |
| `updated_at` | number | no |

---

### Model classes (`src/db/models/`)

Each model extends `Model` from `@nozbe/watermelondb` and uses decorators from `@nozbe/watermelondb/decorators`.

| Model | Table | Decorators used |
|---|---|---|
| `FarmProject` | `farm_projects` | `@nochange`, `@text`, `@field`, `@date`, `@readonly` |
| `BudgetItem` | `budget_items` | `@nochange`, `@text`, `@field`, `@date`, `@readonly` |
| `Expense` | `expenses` | `@nochange`, `@text`, `@field`, `@date`, `@readonly` |
| `WorkEntry` | `work_entries` | `@nochange`, `@text`, `@field`, `@date`, `@readonly` |
| `Employee` | `employees` | `@nochange`, `@text`, `@field`, `@date`, `@readonly` |
| `Payment` | `payments` | `@nochange`, `@text`, `@field`, `@date`, `@readonly` |

`remote_id` is decorated with `@nochange` on all models — it is set once on creation and never mutated.

`created_at` is decorated with `@readonly` on all models.

---

## Sync Service

File: `src/services/syncService.js`

### Strategy

**Pull-only.** The mobile app never pushes local-only changes to the server. All writes go directly to the API (Axios POST/PUT/DELETE). After a write, the app immediately calls `syncAll()` to pull the updated state back into WatermelonDB so the local DB reflects the latest server state.

### `syncAll()`

The public entry point. A module-level `_syncing` boolean prevents overlapping invocations.

**Execution order:**

```
1. syncProjects()
   → GET /projects
   → upsert into 'farm_projects'
   → returns array of remote project objects

2. (in parallel)
   syncExpenses(activeProjectIds)     → GET /expenses/:projectId  for each active project
   syncBudgetItems(activeProjectIds)  → GET /budget/:projectId    for each active project
   syncEmployees()                    → GET /employees
   syncPayments()                     → GET /payments

3. syncWorkEntries(activeProjectIds)  → GET /work-entries/:projectId  for each active project
```

Projects are synced first so their remote IDs are available for all child syncs. Expenses, budget items, employees, and payments run in parallel (step 2). Work entries run sequentially after (step 3). Deleted projects are excluded from child syncs — only `isDeleted: false` project IDs are passed as `activeIds`.

If a per-project fetch fails (e.g. the project was deleted on the server between steps 1 and 2), the error is caught and skipped silently.

### `upsertCollection(collection, remoteItems, mapFn, createMapFn)`

Core upsert helper used by all sync runners.

1. Fetches all existing local records and builds a `Map<remoteId, localRecord>`.
2. Opens a single `database.write()` transaction.
3. For each remote item:
   - **Existing record found:** skips if `remote.updatedAt <= local.updatedAt`; otherwise calls `local.update(mapFn)`.
   - **No local record:** calls `collection.create(createMapFn)`, setting `record._raw.id = item.id` so the WatermelonDB local UUID matches the server UUID.

### ISO to timestamp conversion

```js
const toMs = (iso) => (iso ? new Date(iso).getTime() : null);
```

All API date strings (ISO 8601) are converted to Unix millisecond timestamps before being stored in WatermelonDB (which only stores numbers for date columns).

### Soft-delete propagation

When the API returns a record with `isDeleted: true`, the mapper sets `record.isDeleted = true` locally. All collection queries in screens filter with `Q.where('is_deleted', false)` to exclude these records from display.

---

## Offline Strategy

FarmTrack uses a **write-through / pull-on-demand** offline pattern:

```
User action (create / edit / delete)
        │
        ▼
  Direct API call (Axios)
        │
        ▼ success
  syncAll() called immediately
        │
        ▼
  WatermelonDB updated (upsert)
        │
        ▼
  Screen reads from local DB
  (re-renders with updated data)
```

**Read path:** All screens query WatermelonDB directly. The app is fully readable without a network connection as long as data has been synced at least once.

**Write path:** Writes require a network connection (they go directly to the API). There is no local write queue or optimistic update.

**Background sync:** The `useSync` hook (used in `App.js` via `AppContent`) triggers `syncAll()` when the app comes to the foreground, keeping local data fresh after the device resumes from background.

**React Query:** Used for some live API calls (e.g. project summary on the Dashboard) where fresh server-computed aggregates are needed and caching with a 5-minute stale time is acceptable.
