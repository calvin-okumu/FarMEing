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

### Models:
- **FarmProject:** `id`, `userId`, `name`, `crop`, `landSize`, `landUnit`, `startDate`, `endDate`, `expectedYield`, `status`, `contractUrl`, `notes`.
- **BudgetItem:** `id`, `projectId`, `name`, `category`, `quantity`, `unit`, `unitPrice`, `total`, `notes`.
- **Expense:** `id`, `projectId`, `category`, `amount`, `date`, `note`, `expenseType`, `isRecurring`, `frequency`, `payee`, `payeeId`, `receiptUrl`.
- **WorkEntry:** `id`, `projectId`, `employeeId`, `activity`, `date`, `daysWorked`, `ratePerDay`, `totalCost`, `hoursWorked`, `status`, `notes`, `isRecurring`, `frequency`.
- **Harvest:** `id`, `projectId`, `crop`, `date`, `weight`, `unit`, `quality`, `notes`.
- **Sale:** `id`, `projectId`, `date`, `customer`, `weightSold`, `unitPrice`, `totalAmount`, `paymentStatus`, `balanceDue`, `receiptUrl`, `notes`.
- **SalePayment:** `id`, `saleId`, `amount`, `date`, `note` — individual payment installments against a sale.
- **InventoryItem:** `id`, `projectId`, `name`, `category`, `quantity`, `unit`, `unitCost`, `totalCost`, `usedQty`, `notes`.
- **Payee:** `id`, `name`, `phone`, `email`, `address`, `category`, `notes`.
- **Payment:** `id`, `employeeId`, `amount`, `date`, `note`.
- **Employee:** `id`, `name`, `phone`, `role`, `isDeleted`.
- **EmployeeProjectAssignment:** `id`, `projectId`, `employeeId`.

### Associations:
- **Sale** → `salePayments` (has_many): each sale can have multiple payment installments.
- **SalePayment** → `sales` (belongs_to): each payment links to its parent sale.

### Payment tracking:
- `paymentStatus`: `'pending' | 'partial' | 'paid'` (computed from `totalAmount - sum(salePayments.amount)`)
- `balanceDue`: remaining amount = `totalAmount - totalCollected`
- `collectedRevenue` / `pendingRevenue`: computed in `computeProjectSummary()` from `balanceDue`

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
- `ProjectDetailScreen`: Multi-tab view (Budget, Expenses, Labor, Harvest, Sales, Inventory, Team, Timeline) with sticky tabs, export actions, and member management.
  - **Sales tab**: Cards show customer, weight, total amount, and balance due. Tapping navigates to edit sale with full payment management.
  - **Timeline**: Cards use same design as other tabs with colored left accent.
  - **Hero pills**: Metric pills with currency symbol on label row, value below. Revenue pill shows balance due as note.
- `AddHarvestScreen`: Form to record crop yields. Includes project picker with crop auto-fill from project.
- `AddSaleScreen`: Form to record revenue with multi-installment payment tracking.
  - **Vendor picker**: Select from payees list with free-text fallback.
  - **Receipt upload**: Camera/Album image upload.
  - **Payment installments**: Add multiple partial payments via modal (amount + date + note).
  - **Status**: Auto-computed (`pending` / `partial` / `paid`) from collected vs total.

### Sales & Payment flow:
- Create a sale with weight, price, and optional initial payment.
- Add/edit/delete partial payments within the sale edit form.
- Tap payment row to select, then trash icon to delete.
- `balanceDue` updates automatically. Revenue pills show collected + pending.

### Reports
- `ReportsScreen`: Portfolio overview with bar chart (profitability), pie chart (cost allocation), revenue collection chart (total vs collected per project), and harvest by crop pie chart. Includes `ProjectPerformanceCard` for per-project breakdown.

### Auth
- `RegisterScreen`: Includes role selection (Admin/Worker).

### Settings
- `SettingsScreen`: Toggle between English and Kiswahili.
