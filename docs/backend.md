# Backend Documentation

[← Back to README](./README.md)

## Table of Contents

1. [Stack](#stack)
2. [How to Run](#how-to-run)
3. [Folder Structure](#folder-structure)
4. [Middleware](#middleware)
5. [API Endpoints](#api-endpoints)
   - [Auth](#auth)
   - [Seasons](#seasons)
   - [Projects](#projects)
   - [Budget Items](#budget-items)
   - [Expenses](#expenses)
   - [Payees](#payees)
   - [Equipment](#equipment)
   - [Employees](#employees)
   - [Payments](#payments)
   - [Work Entries](#work-entries)
   - [Harvests](#harvests)
   - [Sales](#sales)
   - [Invitations](#invitations)
   - [Inventory](#inventory)
   - [Reports](#reports)
   - [System](#system)
6. [Prisma Schema](#prisma-schema)
7. [Sync And Access Notes](#sync-and-access-notes)

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | |
| Framework | Express | v5.2.1 |
| ORM | Prisma | v5.22.0 |
| Database | PostgreSQL | |
| Authentication | JWT (`jsonwebtoken`) — 7-day tokens | ^9.0.3 |
| Password hashing | bcrypt (10 salt rounds) | ^6.0.0 |
| Validation | Zod | ^4.3.6 |
| Environment | dotenv | ^17.3.1 |

---

## How to Run

### Required environment variables

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://user:password@host:5432/farmtrack
JWT_SECRET=your_secret_key_here
PORT=3000
```

`PORT` is optional and defaults to `3000`.

### Setup steps

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Apply database migrations
npx prisma migrate deploy

# 3. Regenerate Prisma client after schema changes
npx prisma generate

# (Optional) Seed or inspect the DB
npx prisma studio

# 4. Start the server
node server.js
```

The server listens on `http://localhost:3000` (or the value of `$PORT`).

For production, the recommended setup is to keep the backend bound to the host machine and expose it through a named Cloudflare Tunnel such as `https://api.carlhub.uk` instead of opening port `3000` directly.

### Health check

```
GET /health
→ { "status": "ok" }
```

---

## Folder Structure

```
backend/
├── server.js                    # Entry point — mounts all routers
├── prisma/
│   └── schema.prisma            # Prisma data model
└── src/
    ├── controllers/             # Business logic & validation
    │   ├── auth.controller.js
    │   ├── budget.controller.js
    │   ├── employee.controller.js
    │   ├── equipment.controller.js
    │   ├── expense.controller.js
    │   ├── harvest.controller.js
    │   ├── inventory.controller.js
    │   ├── payee.controller.js
    │   ├── payment.controller.js
    │   ├── project.controller.js
    │   ├── sale.controller.js
    │   ├── season.controller.js
    │   ├── sync.controller.js
    │   └── workEntry.controller.js
    ├── middleware/
    │   └── auth.middleware.js   # JWT verification
    ├── routes/                  # API Route definitions
    │   ├── auth.routes.js
    │   ├── budget.routes.js
    │   ├── employee.routes.js
    │   ├── equipment.routes.js
    │   ├── expense.routes.js
    │   ├── harvest.routes.js
    │   ├── inventory.routes.js
    │   ├── payee.routes.js
    │   ├── payment.routes.js
    │   ├── project.routes.js
    │   ├── projectInvitation.routes.js
    │   ├── report.routes.js
    │   ├── sale.routes.js
    │   ├── season.routes.js
    │   ├── sync.routes.js
    │   └── workEntry.routes.js
    ├── validators/              # Zod schemas (one file per resource)
    └── lib/
        ├── prisma.js            # Shared PrismaClient singleton
        ├── i18n.js              # Server-side translations for reports
        └── project-access.js    # Access control logic
```

---

## Middleware

### `auth.middleware.js` — `authenticate`

Applied as `router.use(authenticate)` on every route group except `/auth` and `/health`.

**Verification steps:**

1. Reads the `Authorization` header and expects the format `Bearer <token>`.
2. Returns `401 { error: 'Authorization token required' }` if the header is missing or malformed.
3. Calls `jwt.verify(token, process.env.JWT_SECRET)` to decode and validate the token signature and expiry.
   - Expired tokens → `401 { error: 'Token expired' }`
   - Any other JWT error → `401 { error: 'Invalid token' }`
4. Fetches the user from the database by `payload.sub` (the user's UUID), selecting only safe fields: `id`, `name`, `phone`, `role`, `currency`, `locale`. This ensures soft-deleted or removed users are rejected even if their token has not expired.
5. Attaches the user object to `req.user` and calls `next()`.

---

## API Endpoints (Prefix: `/api`)

All protected endpoints require the `Authorization: Bearer <token>` header.

**Note on Prefixing:** All routes listed below are prefixed with `/api` in the final URL (e.g., `https://api.carlhub.uk/api/auth/login`).

**Common Response Formats:**
*   **Validation Errors:** `400 Bad Request`
    ```json
    {
      "error": "Validation failed",
      "details": [{ "field": "fieldName", "message": "reason" }]
    }
    ```
*   **Not Found:** `404 Not Found`
    ```json
    { "error": "Resource not found" }
    ```

### Auth

Base path: `/auth` — **Public**

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `POST` | `/register` | Register new user | `{ name, phone, password, role? }` |
| `POST` | `/login` | Authenticate user | `{ phone, password }` |

### Seasons

Base path: `/seasons` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all farming seasons for the user |
| `POST` | `/` | Create a new farming season |
| `PUT` | `/:id` | Update season details |
| `DELETE` | `/:id` | Soft delete a season |

### Projects

Base path: `/projects` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all active projects |
| `POST` | `/` | Create a new project |
| `GET` | `/:id` | Get project details |
| `PUT` | `/:id` | Update project |
| `DELETE` | `/:id` | Soft delete project |
| `GET` | `/:id/summary` | Get financial summary (budget vs actuals, production totals) |
| `GET` | `/:id/members` | List project members and roles |
| `POST` | `/:id/members` | Invite a member directly by ID |
| `DELETE` | `/:id/members/:userId` | Remove a member from a project |

### Invitations

Base path: `/invitations` — **Protected**

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `POST` | `/` | Create an invitation code | `{ projectId, role }` |
| `POST` | `/join` | Join project via code | `{ inviteCode }` |

### Sync

Base path: `/sync` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/pull` | Pull changes from server (scoped by project access) |
| `POST` | `/push` | Push changes to server (validated for project permissions) |

### Reports

Base path: `/reports` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/project/:id/pdf` | Download localized PDF report (Yield Analysis, Labor Efficiency, Vendor Breakdown) |
| `GET` | `/project/:id/excel` | Download localized Excel report (Summary, Detailed worksheets with Auto-Filters) |

### Budget Items

Base path: `/budget` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List budget items for a project |
| `POST` | `/` | Create a budget item |
| `PUT` | `/:id` | Update a budget item |
| `DELETE` | `/:id` | Delete a budget item |

### Expenses

Base path: `/expenses` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List expenses for a project |
| `POST` | `/` | Create an expense (supports CAPEX/OPEX and Payees) |
| `PUT` | `/:id` | Update an expense |
| `DELETE` | `/:id` | Delete an expense |

### Payees

Base path: `/payees` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all payees (suppliers, vendors, workers) |
| `POST` | `/` | Create a new payee |
| `GET` | `/:id` | Get payee details |
| `GET` | `/:id/summary` | Get financial history for a specific payee |
| `PUT` | `/:id` | Update payee details |
| `DELETE` | `/:id` | Soft delete a payee |

### Equipment

Base path: `/equipment` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List machinery and tools for a project |
| `POST` | `/` | Record new equipment investment |
| `PUT` | `/:id` | Update equipment status or details |
| `DELETE` | `/:id` | Soft delete an equipment record |

### Employees

Base path: `/employees` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all employees |
| `POST` | `/` | Create a new employee |
| `PUT` | `/:id` | Update employee details |
| `DELETE` | `/:id` | Soft delete employee |
| `GET` | `/:id/balance` | Get payment balance for an employee |

### Payments

Base path: `/payments` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all payments made |
| `POST` | `/` | Record a payment to an employee |
| `GET` | `/:employeeId` | List payments for a specific employee |
| `DELETE` | `/:id` | Soft delete a payment |

### Work Entries

Base path: `/work-entries` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List work entries for a project |
| `POST` | `/` | Create a work entry |
| `PUT` | `/:id` | Update a work entry |
| `DELETE` | `/:id` | Delete a work entry |
| `PATCH` | `/:id/approve` | Approve a pending work entry |
| `GET` | `/:projectId/by-employee` | Aggregated work stats by employee |
| `GET` | `/:projectId/by-activity` | Aggregated work stats by activity |

### Harvests

Base path: `/harvests` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List harvest records for a project |
| `POST` | `/` | Record a harvest (includes rejected weight tracking) |
| `PUT` | `/:id` | Update a harvest record |
| `DELETE` | `/:id` | Delete a harvest record |

### Sales

Base path: `/sales` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List sales for a project |
| `POST` | `/` | Record a sale (supports payment installments) |
| `PUT` | `/:id` | Update a sale record |
| `DELETE` | `/:id` | Delete a sale record |

### Inventory

Base path: `/inventory` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List inventory items |
| `POST` | `/` | Add an inventory item |
| `PUT` | `/:id` | Update an inventory item |
| `DELETE` | `/:id` | Delete an inventory item |

### System

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Health check | Public |
| `GET` | `/me` | Get current user details | Protected |

---

## Prisma Schema

The data model is defined in `prisma/schema.prisma`. Key entities include:

### Core
*   **User:** Central entity. Contains credentials, role (`ADMIN`, `WORKER`), and localization settings (`currency`, `locale`).
*   **Season:** Represents a farming season, linked to a user.
*   **FarmProject:** Represents a specific crop cycle on a plot of land. Linked to `User` and optional `Season`. Tracks status (`PLANNING`, `ACTIVE`, `HARVESTED`, `CLOSED`) and optional `cropVariety`.
*   **ProjectAccess:** Join model for collaborative project access. Stores per-user membership and role (`OWNER`, `MANAGER`, `VIEWER`).
*   **ProjectInvitation:** Generates unique codes for users to join projects with specific roles.

### Financials
*   **BudgetItem:** Planned costs for a project.
*   **Expense:** Actual costs incurred. Differentiates `CAPEX` vs `OPEX`. Supports recurring expenses.
*   **Sale:** Revenue generated from selling harvests. Tracks `paymentStatus` (`pending`, `partial`, `paid`) and `balanceDue` for installment payments. Now includes `dueDate`, `invoiceUrl`, and `receiptUrl`. Linked to `Harvest` records via `SaleHarvest`.
*   **SalePayment:** Individual payment installments against a sale. Each has `saleId`, `amount`, `date`, `method`, `note`.
*   **Payment:** Records payments made to employees.

### Operations
*   **Employee:** Workers managed by the user.
*   **WorkEntry:** Logs daily labor. Tracks `activity`, `hoursWorked` / `daysWorked`, `cost`, and approval status.
*   **Harvest:** Records crop yields (`weight`, `unit`, `quality`). Now includes `rejectedWeight` and `rejectedReason` for tracking waste or losses.
*   **InventoryItem:** Tracks inputs and resources.

### Relationships
*   **User** has many **Projects** and **Employees**.
*   **Project** has many **BudgetItems**, **Expenses**, **WorkEntries**, **Harvests**, **Sales**, **ProjectAccess**, and **ProjectInvitations**.
*   **Employee** has many **WorkEntries** and **Payments**.
*   **Sale** has many **SalePayments** and **SaleHarvests**.
*   **Harvest** has many **SaleHarvests**.
*   **SaleHarvest** is a join model linking **Sales** to **Harvests** (many-to-many).
*   **ProjectAccess** links a **User** to a **Project** with a collaborative role.

---

## Sync And Access Notes

- `/sync/pull` collects accessible project IDs from both owned projects and `ProjectAccess` rows. Security scoping is applied to all child records (expenses, harvests, etc.). Soft-deleted access rows are strictly filtered out to prevent unauthorized access.
- For `saleHarvest` and `salePayment` records, security scoping is applied via the parent `sale.projectId`.
- `/sync/push` handles upserting all related operational data and ensures `ProjectAccess` rows are created for new projects. It also implements a **cascading soft-delete** for projects initiated from the client, ensuring all related records are safely preserved but hidden on the server.
- `project_invitations` and `project_access` are included in the sync lifecycle to support collaborative workflows.
- Project-scoped APIs such as members and reports expect the server-side project ID. Mobile clients should prefer `remoteId` when present.
- Deletions are processed via `prisma.$transaction` to ensure atomic consistency across the 12+ related project entities.
