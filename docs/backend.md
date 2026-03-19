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
   - [Inventory](#inventory)
6. [Prisma Schema](#prisma-schema)

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | JWT (`jsonwebtoken`) — 7-day tokens |
| Password hashing | bcrypt (10 salt rounds) |
| Validation | Zod |
| Environment | dotenv |

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
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── budget.controller.js
    │   ├── employee.controller.js
    │   ├── expense.controller.js
    │   ├── inventory.controller.js
    │   ├── payment.controller.js
    │   └── project.controller.js
    ├── middleware/
    │   └── auth.middleware.js   # JWT verification
    ├── routes/
    │   ├── auth.routes.js
    │   ├── budget.routes.js
    │   ├── employee.routes.js
    │   ├── expense.routes.js
    │   ├── inventory.routes.js
    │   ├── payment.routes.js
    │   ├── project.routes.js
    │   └── workEntry.routes.js
    ├── validators/              # Zod schemas (one file per resource)
    └── lib/
        └── prisma.js            # Shared PrismaClient singleton
```

---

## Middleware

### `auth.middleware.js` — `authenticate`

Applied as `router.use(authenticate)` on every route group except `/auth`.

**Verification steps:**

1. Reads the `Authorization` header and expects the format `Bearer <token>`.
2. Returns `401 { error: 'Authorization token required' }` if the header is missing or malformed.
3. Calls `jwt.verify(token, process.env.JWT_SECRET)` to decode and validate the token signature and expiry.
   - Expired tokens → `401 { error: 'Token expired' }`
   - Any other JWT error → `401 { error: 'Invalid token' }`
4. Fetches the user from the database by `payload.sub` (the user's UUID), selecting only safe fields: `id`, `name`, `phone`, `currency`, `locale`. This ensures soft-deleted or removed users are rejected even if their token has not expired.
5. Attaches the user object to `req.user` and calls `next()`.

---

## API Endpoints

All protected endpoints require the `Authorization: Bearer <token>` header.

Validation errors return:
```json
{
  "error": "Validation failed",
  "details": [{ "field": "fieldName", "message": "reason" }]
}
```

---

### Auth

Base path: `/auth` — **no authentication required**

#### `POST /auth/register`

Register a new user account.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `phone` | string | yes (must be unique) |
| `password` | string | yes |

**Success response `201`:**
```json
{
  "user": {
    "id": "uuid",
    "name": "string",
    "phone": "string",
    "currency": "TZS",
    "locale": "sw-TZ",
    "createdAt": "ISO datetime"
  },
  "token": "jwt"
}
```

**Error responses:**
- `400` — validation failed
- `409` — phone number already registered

---

#### `POST /auth/login`

Authenticate with phone and password.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `phone` | string | yes |
| `password` | string | yes |

**Success response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "name": "string",
    "phone": "string",
    "currency": "string",
    "locale": "string"
  },
  "token": "jwt"
}
```

**Error responses:**
- `400` — validation failed
- `401` — invalid phone or password

---

### Projects

Base path: `/projects` — **authentication required**

All operations are scoped to the authenticated user (`req.user.id`). Deleted projects (`isDeleted: true`) are excluded from list and get responses.

#### `POST /projects`

Create a new farm project.

**Request body:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `crop` | string | yes | |
| `landSize` | number | yes | |
| `landUnit` | string | yes | e.g. `"acres"` |
| `startDate` | string | yes | ISO date |
| `endDate` | string | no | ISO date |
| `notes` | string | no | |
| `seasonId` | string (UUID) | no | Must belong to the same user |

**Success response `201`:** `{ "project": { ...projectFields } }`

---

#### `GET /projects`

List all active (non-deleted) projects for the authenticated user, ordered by `createdAt` descending.

**Success response `200`:**
```json
{ "projects": [ { ...projectFields } ] }
```

Project fields include: `id`, `name`, `crop`, `landSize`, `landUnit`, `startDate`, `endDate`, `notes`, `isDeleted`, `createdAt`, `updatedAt`, `seasonId`, `userId`, `season: { id, name }`.

---

#### `GET /projects/:id`

Get a single project by ID (must belong to the authenticated user and not be deleted).

**Success response `200`:** `{ "project": { ...projectFields } }`

**Error:** `404` — project not found or access denied

---

#### `GET /projects/:id/summary`

Get financial aggregates for a project.

**Success response `200`:**
```json
{
  "project": { ...projectFields },
  "summary": {
    "totalBudget": 0.00,
    "totalExpenses": 0.00,
    "totalLaborCost": 0.00,
    "totalCost": 0.00
  }
}
```

`totalCost` = `totalExpenses` + `totalLaborCost`. Only non-deleted child records are counted.

---

#### `PUT /projects/:id`

Update a project. Accepts the same optional fields as create (all fields are optional on update).

**Success response `200`:** `{ "project": { ...projectFields } }`

---

#### `DELETE /projects/:id`

Soft-delete a project (`isDeleted` set to `true`).

**Success response `200`:** `{ "message": "Project deleted" }`

---

### Budget Items

Base path: `/budget` — **authentication required**

Ownership is verified through the parent project (must belong to `req.user.id`).

#### `POST /budget`

Create a budget item. `total` is computed server-side as `quantity × unitPrice`.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `projectId` | string (UUID) | yes |
| `category` | string | yes |
| `name` | string | yes |
| `quantity` | number | yes |
| `unit` | string | yes |
| `unitPrice` | number | yes |
| `notes` | string | no |

**Success response `201`:** `{ "budgetItem": { ...fields, "total": number } }`

---

#### `GET /budget/:projectId`

List all non-deleted budget items for a project.

**Success response `200`:**
```json
{
  "budgetItems": [ { ...fields } ],
  "grandTotal": 0.00
}
```

---

#### `PUT /budget/:id`

Update a budget item. `total` is recalculated server-side on every update.

**Success response `200`:** `{ "budgetItem": { ...fields } }`

---

#### `DELETE /budget/:id`

Soft-delete a budget item.

**Success response `200`:** `{ "message": "Budget item deleted" }`

---

### Expenses

Base path: `/expenses` — **authentication required**

#### `POST /expenses`

Create an expense record.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `projectId` | string (UUID) | yes |
| `category` | string | yes |
| `amount` | number | yes |
| `date` | string | yes | ISO date |
| `note` | string | no |
| `receiptUrl` | string | no |

**Success response `201`:** `{ "expense": { ...fields } }`

---

#### `GET /expenses/:projectId`

List all non-deleted expenses for a project, ordered by `date` descending.

**Success response `200`:**
```json
{
  "expenses": [ { ...fields } ],
  "totalAmount": 0.00
}
```

---

#### `PUT /expenses/:id`

Update an expense.

**Success response `200`:** `{ "expense": { ...fields } }`

---

#### `DELETE /expenses/:id`

Soft-delete an expense.

**Success response `200`:** `{ "message": "Expense deleted" }`

---

### Employees

Base path: `/employees` — **authentication required**

#### `POST /employees`

Create an employee record linked to the authenticated user.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `phone` | string | no |
| `role` | string | no |

**Success response `201`:** `{ "employee": { ...fields } }`

---

#### `GET /employees`

List all non-deleted employees belonging to the authenticated user, ordered by `createdAt` descending.

**Success response `200`:** `{ "employees": [ { ...fields } ] }`

---

#### `GET /employees/:id/balance`

Compute the financial balance for an employee.

- `totalEarned` — sum of all non-deleted `WorkEntry.totalCost` for this employee
- `totalPaid` — sum of all `Payment.amount` for this employee
- `outstanding` — `totalEarned - totalPaid` (positive = owed to employee)

**Success response `200`:**
```json
{
  "employee": { "id": "uuid", "name": "string", "phone": "string", "role": "string" },
  "balance": {
    "totalEarned": 0.00,
    "totalPaid": 0.00,
    "outstanding": 0.00
  }
}
```

---

#### `PUT /employees/:id`

Update an employee.

**Success response `200`:** `{ "employee": { ...fields } }`

---

#### `DELETE /employees/:id`

Soft-delete an employee.

**Success response `200`:** `{ "message": "Employee deleted" }`

---

### Payments

Base path: `/payments` — **authentication required**

> Note: payment logic is implemented directly in `payment.routes.js` (no separate controller file).

#### `POST /payments`

Record a payment to an employee.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `employeeId` | string (UUID) | yes |
| `amount` | number | yes |
| `date` | string | yes | ISO date |
| `note` | string | no |

**Success response `201`:** `{ "payment": { ...fields } }`

---

#### `GET /payments`

List all payments for employees belonging to the authenticated user, ordered by `date` descending.

**Success response `200`:** `{ "payments": [ { ...fields } ] }`

---

#### `GET /payments/:employeeId`

List payments for a specific employee, ordered by `date` descending.

**Success response `200`:** `{ "payments": [ { ...fields } ] }`

---

### Work Entries

Base path: `/work-entries` — **authentication required**

> Note: work entry logic is implemented directly in `workEntry.routes.js` with inline Zod validation.

#### `POST /work-entries`

Create a work entry. Input is validated with a Zod schema.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `projectId` | string (UUID) | yes | |
| `employeeId` | string (UUID) | yes | |
| `activity` | string | yes | min length 1 |
| `date` | string | yes | ISO date |
| `daysWorked` | number | yes | must be positive |
| `ratePerDay` | number | yes | must be positive |
| `totalCost` | number | yes | |
| `notes` | string | no | |

**Success response `201`:** `{ "workEntry": { ...fields } }`

**Error:** `400` — ZodError with array of validation messages

---

#### `GET /work-entries/:projectId`

List all non-deleted work entries for a project, ordered by `date` descending.

**Success response `200`:** `{ "workEntries": [ { ...fields } ] }`

---

#### `PUT /work-entries/:id`

Update a work entry. Accepts any subset of the work entry fields.

**Success response `200`:** `{ "workEntry": { ...fields } }`

---

#### `DELETE /work-entries/:id`

Soft-delete a work entry (`isDeleted` set to `true`).

**Success response `200`:** `{ "message": "Work entry deleted" }`

---

### Inventory

Base path: `/inventory` — **authentication required**

Ownership is verified through the parent project. `totalCost` is computed server-side as `quantity × unitCost`.

#### `POST /inventory`

Create an inventory item.

**Request body:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `projectId` | string (UUID) | yes | |
| `name` | string | yes | |
| `category` | string | yes | |
| `quantity` | number | yes | |
| `unit` | string | yes | |
| `unitCost` | number | yes | |
| `usedQty` | number | no | defaults to 0; cannot exceed `quantity` |
| `notes` | string | no | |

**Success response `201`:** `{ "inventoryItem": { ...fields, "totalCost": number } }`

**Error:** `400` — if `usedQty > quantity`

---

#### `GET /inventory/:projectId`

List all non-deleted inventory items for a project.

**Success response `200`:**
```json
{
  "inventoryItems": [ { ...fields } ],
  "grandTotalCost": 0.00
}
```

---

#### `PUT /inventory/:id`

Update an inventory item. `totalCost` is recalculated server-side. `usedQty` is validated against the effective `quantity`.

**Success response `200`:** `{ "inventoryItem": { ...fields } }`

---

#### `DELETE /inventory/:id`

Soft-delete an inventory item.

**Success response `200`:** `{ "message": "Inventory item deleted" }`

---

## Prisma Schema

Database: PostgreSQL. All primary keys are UUIDs (`@default(uuid())`). Timestamps use `@default(now())` and `@updatedAt`.

### `User`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `name` | String | |
| `phone` | String | `@unique` |
| `password` | String | bcrypt hash |
| `currency` | String | default `"TZS"` |
| `locale` | String | default `"sw-TZ"` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Relations: has many `FarmProject`, `Employee`, `Season`.

---

### `Season`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `userId` | String | FK → User |
| `name` | String | |
| `startDate` | DateTime | |
| `endDate` | DateTime? | optional |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Relations: belongs to `User`; has many `FarmProject`.

---

### `FarmProject`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `userId` | String | FK → User |
| `seasonId` | String? | FK → Season (optional) |
| `name` | String | |
| `crop` | String | |
| `landSize` | Float | |
| `landUnit` | String | default `"acres"` |
| `startDate` | DateTime | |
| `endDate` | DateTime? | optional |
| `notes` | String? | optional |
| `isDeleted` | Boolean | default `false` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Relations: belongs to `User`, `Season`; has many `BudgetItem`, `Expense`, `WorkEntry`.

---

### `BudgetItem`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `projectId` | String | FK → FarmProject |
| `category` | String | |
| `name` | String | |
| `quantity` | Float | |
| `unit` | String | |
| `unitPrice` | Float | |
| `total` | Float | computed: `quantity × unitPrice` |
| `notes` | String? | optional |
| `isDeleted` | Boolean | default `false` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### `Expense`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `projectId` | String | FK → FarmProject |
| `category` | String | |
| `amount` | Float | |
| `date` | DateTime | |
| `note` | String? | optional |
| `receiptUrl` | String? | optional |
| `isDeleted` | Boolean | default `false` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### `Employee`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `userId` | String | FK → User |
| `name` | String | |
| `phone` | String? | optional |
| `role` | String? | optional |
| `isDeleted` | Boolean | default `false` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Relations: belongs to `User`; has many `WorkEntry`, `Payment`.

---

### `WorkEntry`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `projectId` | String | FK → FarmProject |
| `employeeId` | String | FK → Employee |
| `activity` | String | |
| `date` | DateTime | |
| `daysWorked` | Float | |
| `ratePerDay` | Float | |
| `totalCost` | Float | |
| `notes` | String? | optional |
| `isPaid` | Boolean | default `false` |
| `isDeleted` | Boolean | default `false` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### `Payment`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `employeeId` | String | FK → Employee |
| `amount` | Float | |
| `date` | DateTime | |
| `note` | String? | optional |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

> Note: `Payment` has no `isDeleted` field in the Prisma schema.

---

### `InventoryItem`

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID) | PK |
| `projectId` | String | (no FK constraint defined in schema) |
| `name` | String | |
| `category` | String | |
| `quantity` | Float | |
| `unit` | String | |
| `unitCost` | Float | |
| `totalCost` | Float | computed: `quantity × unitCost` |
| `usedQty` | Float | default `0` |
| `notes` | String? | optional |
| `isDeleted` | Boolean | default `false` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

> Note: `InventoryItem` is not represented in the WatermelonDB local schema — inventory data is not synced to the mobile app.
