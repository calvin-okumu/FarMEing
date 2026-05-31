# Dedicated Invoice & Payment Tracking Plan

## Background & Motivation
Currently, payments are recorded on a strictly per-sale basis. To accommodate real-world scenarios where customers pay a lump sum to settle multiple outstanding sales (invoices) at once, we need a dedicated section to track receivables, manage customer balances, and process batch payments efficiently.

## Scope & Impact
- **Frontend Only (Primarily)**: We can achieve this without massive schema changes to the offline sync engine by intelligently auto-splitting lump sum payments into individual `SalePayment` records under the hood.
- **New Screens**: A central "Invoices & Payments" dashboard and a "Receive Payment" processing screen.
- **Navigation**: Added to the main project navigation or dashboard for easy access.

## Proposed Solution

### 1. Invoices & Receivables Dashboard (`InvoicesScreen.js`)
Create a new dedicated screen that acts as an accounts receivable hub.
- **Customer Grouping**: Groups unpaid sales by the `customer` string field.
- **Status Tabs**: Easily switch between `Unpaid`, `Overdue`, and `Paid` invoices (sales).
- **Summary Metrics**: Displays total outstanding balance and total overdue across all customers.

### 2. Receive Lump Sum Payment (`ReceivePaymentScreen.js`)
A specialized screen for processing payments.
- **Customer Selection**: User selects a customer (populated dynamically from the `customer` fields of unpaid sales).
- **Payment Entry**: User enters the lump sum amount, payment method, and date.
- **Auto-Distribution**: The app lists the customer's unpaid invoices (sales) from oldest to newest. As the user enters the amount, it automatically allocates the payment down the list until the amount is exhausted (with options to manually override the distribution).
- **Data Persistence**: Upon saving, the app generates individual `SalePayment` records for each affected sale under the hood. This seamlessly integrates with the existing WatermelonDB sync and backend schema without requiring new tables.

### 3. Navigation Integration
- Add the "Invoices & Payments" section to the main navigation (e.g., as a new tab or a prominent button on the project dashboard).

## Alternatives Considered
- **Formal Customer Accounts Schema**: Introducing a new `Customer` and `CustomerPayment` table in Prisma and WatermelonDB. *Rejected for now* because it requires extensive changes to the sync engine (`SYNC_ORDER`, mappings, scoping) and historical data migration, whereas the auto-distribution approach delivers the requested UX using the robust, existing sync infrastructure.

## Verification & Testing
- Create multiple sales for the same customer with different due dates.
- Process a lump sum payment that partially covers the oldest sale and fully covers the newest.
- Verify that the correct individual `SalePayment` records are created and synced to the backend.
- Verify the Invoices dashboard correctly updates the balances and statuses.
