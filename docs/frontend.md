# Frontend Documentation

[← Back to README](./README.md)

## Table of Contents

1. [Stack](#stack)
2. [Folder Structure](#folder-structure)
3. [Navigation](#navigation)
4. [Localization (i18n)](#localization-i18n)
5. [WatermelonDB Models](#watermelondb-models)
6. [Sync Service](#sync-service)
7. [Screen Inventory](#screen-inventory)

---

## Stack

- **Framework:** Expo SDK 55
- **Local Database:** WatermelonDB with SQLite adapter
- **State Management:** Zustand (Auth/Settings)
- **API Client:** Axios
- **Localization:** i18next
- **Icons:** Ionicons (Expo Vector Icons)

---

## Folder Structure

```
frontend/
├── src/
│   ├── db/              # WatermelonDB schema and models
│   ├── i18n/            # Translations (en, sw)
│   ├── navigation/      # React Navigation setup
│   ├── screens/         # UI screens
│   ├── services/        # Sync logic
│   ├── store/           # Zustand stores (Auth, Settings)
│   └── hooks/           # Custom hooks (useSync)
```

---

## Navigation

- **Auth Stack:** Login, Register
- **Main Tabs:**
  - **Projects:** List → Details (Budget, Expenses, Labor, Harvest, Sales, Timeline)
  - **Employees:** List → Details (Work, Payments)
  - **Quick Entry:** Rapid labor logging
  - **Dashboard:** Financial overview
  - **Settings:** Profile & Language

---

## Localization (i18n)

Supports **English (en)** and **Kiswahili (sw)**.
- Store: `useSettingsStore`
- Resilience: Lazy-loads `expo-localization` to prevent crashes in environments without the native module.

---

## WatermelonDB Models

### New Models:
- **Harvest:** `id`, `projectId`, `crop`, `date`, `weight`, `unit`, `quality`, `notes`.
- **Sale:** `id`, `projectId`, `date`, `customer`, `weightSold`, `unitPrice`, `totalAmount`, `notes`.

### Updated Models:
- **FarmProject:** Added `expectedYield`, `status`.
- **Expense:** Added `expenseType`, `isRecurring`, `frequency`.
- **WorkEntry:** Added `hoursWorked`, `status`, `isRecurring`, `frequency`.

### Sync identity helpers:
- **FarmProject**, **Employee**, and **Payee** expose `remoteId` from the underlying Watermelon `remote_id` column.
- Project-scoped API calls should prefer `remoteId` over the local Watermelon `id` when a record has already synced.

---

## Sync Service

The `syncService.js` handles bi-directional synchronization:
- **Push:** Local changes (with `pending_` IDs) are sent to the server.
- **Pull:** Latest data is fetched from the server and upserted locally.
- **ID Resolution:** After a successful push, local `pending_` records are replaced with server-confirmed UUIDs.
- **Project access recovery:** Sync-created projects now receive owner access rows on the backend during push, which keeps team-management and export endpoints usable after local-first project creation.

---

## Screen Inventory

### Projects
- `ProjectsScreen`: List with "New Project" modal.
- `ProjectDetailScreen`: Multi-tab view (Budget, Expenses, Labor, Harvest, Sales, Inventory, Team, Timeline) with export actions and member management.
- `AddHarvestScreen`: Form to record crop yields.
- `AddSaleScreen`: Form to record revenue.

### Auth
- `RegisterScreen`: Includes role selection (Admin/Worker).

### Settings
- `SettingsScreen`: Toggle between English and Kiswahili.
