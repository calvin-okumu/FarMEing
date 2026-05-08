# Backend Documentation

[← Back to README](./README.md)

## Table of Contents

1. [Stack](#stack)
2. [How to Run](#how-to-run)
3. [Folder Structure](#folder-structure)
4. [Middleware](#middleware)
5. [API Endpoints](#api-endpoints)
   - [Auth](#auth)
   - [Projects](#projects)
   - [Budget Items](#budget-items)
   - [Expenses](#expenses)
   - [Employees](#employees)
   - [Payments](#payments)
   - [Work Entries](#work-entries)
   - [Harvests](#harvests)
   - [Sales](#sales)
   - [Inventory](#inventory)
   - [System](#system)
6. [Prisma Schema](#prisma-schema)

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

# (Optional) Seed or inspect the DB
npx prisma studio

# 3. Start the server
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
    │   ├── expense.controller.js
    │   ├── harvest.controller.js
    │   ├── inventory.controller.js
    │   ├── payment.controller.js
    │   ├── project.controller.js
    │   ├── sale.controller.js
    │   └── workEntry.controller.js
    ├── middleware/
    │   └── auth.middleware.js   # JWT verification
    ├── routes/                  # API Route definitions
    │   ├── auth.routes.js
    │   ├── budget.routes.js
    │   ├── employee.routes.js
    │   ├── expense.routes.js
    │   ├── harvest.routes.js
    │   ├── inventory.routes.js
    │   ├── payment.routes.js
    │   ├── project.routes.js
    │   ├── sale.routes.js
    │   └── workEntry.routes.js
    ├── validators/              # Zod schemas (one file per resource)
    └── lib/
        └── prisma.js            # Shared PrismaClient singleton
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

### Projects

Base path: `/projects` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all active projects |
| `POST` | `/` | Create a new project |
| `GET` | `/:id` | Get project details |
| `PUT` | `/:id` | Update project |
| `DELETE` | `/:id` | Soft delete project |
| `GET` | `/:id/summary` | Get financial summary (budget vs actuals) |

### Sync

Base path: `/sync` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/pull` | Pull changes from server |
| `POST` | `/push` | Push changes to server |

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
| `POST` | `/` | Create an expense |
| `PUT` | `/:id` | Update an expense |
| `DELETE` | `/:id` | Delete an expense |

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
| `POST` | `/` | Record a harvest |
| `PUT` | `/:id` | Update a harvest record |
| `DELETE` | `/:id` | Delete a harvest record |

### Sales

Base path: `/sales` — **Protected**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:projectId` | List sales for a project |
| `POST` | `/` | Record a sale |
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
*   **FarmProject:** Represents a specific crop cycle on a plot of land. Linked to `User` and optional `Season`. Tracks status (`PLANNING`, `ACTIVE`, `HARVESTED`, `CLOSED`).

### Financials
*   **BudgetItem:** Planned costs for a project.
*   **Expense:** Actual costs incurred. Differentiates `CAPEX` vs `OPEX`. Supports recurring expenses.
*   **Sale:** Revenue generated from selling harvests.
*   **Payment:** Records payments made to employees.

### Operations
*   **Employee:** Workers managed by the user.
*   **WorkEntry:** Logs daily labor. Tracks `activity`, `hoursWorked` / `daysWorked`, `cost`, and approval status.
*   **Harvest:** Records crop yields (`weight`, `unit`, `quality`).
*   **InventoryItem:** Tracks inputs and resources.

### Relationships
*   **User** has many **Projects** and **Employees**.
*   **Project** has many **BudgetItems**, **Expenses**, **WorkEntries**, **Harvests**, and **Sales**.
*   **Employee** has many **WorkEntries** and **Payments**.
