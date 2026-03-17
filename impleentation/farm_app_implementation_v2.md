# 🌱 Farm Cost & Labor Management App — Implementation Plan v2.0

> **Agentic Coding Strategy:** Work in small, testable tasks. Each task should be completable in one AI agent session. Never move to the next task until the current one passes its acceptance criteria.

---

## 🧭 Guiding Principles

- **Offline-first from day one** — farmers work in fields with no internet
- **Auth from day one** — plan the schema now, avoid painful retrofits later
- **One feature at a time** — build → test → commit → repeat
- **Postman-test every endpoint** before touching the mobile app
- **Soft-delete everything** — never permanently lose farm data

---

## 🏗️ Tech Stack

### Frontend (Mobile)
- React Native (Expo)
- Zustand (state management — lighter than Redux)
- WatermelonDB (offline-first local database + sync)
- react-query (server state & optimistic updates)
- expo-image-picker (receipt photo capture)

### Backend
- Node.js + Express
- Prisma ORM (migrations, type safety, easier than raw pg)
- PostgreSQL
- JWT (authentication)
- dotenv, cors, bcrypt, zod (validation)

---

## 📁 Project Structure

### Backend
```
server/
  prisma/
    schema.prisma
    migrations/
  src/
    modules/
      auth/
      users/
      farmProjects/
      seasons/
      budget/
      expenses/
      employees/
      workEntries/
      inventory/
      payments/
    config/
    middleware/
      auth.middleware.js
      validate.middleware.js
    shared/
      utils/
      errors/
  .env
  server.js
```

### Mobile
```
app/
  screens/
    Auth/
    Dashboard/
    Projects/
    Budget/
    Expenses/
    Employees/
    WorkLog/
    Inventory/
    QuickEntry/
  components/
  services/
    api/
    sync/
  store/
    useAuthStore.js
    useProjectStore.js
  db/
    watermelon/
      schema.js
      models/
```

---

## 🗄️ Database Schema (Prisma)

```prisma
model User {
  id         String   @id @default(uuid())
  name       String
  phone      String   @unique
  password   String
  currency   String   @default("TZS")
  locale     String   @default("sw-TZ")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  projects   FarmProject[]
  employees  Employee[]
}

model Season {
  id        String   @id @default(uuid())
  userId    String
  name      String   // e.g. "Long Rains 2025"
  startDate DateTime
  endDate   DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  projects  FarmProject[]
}

model FarmProject {
  id         String   @id @default(uuid())
  userId     String
  seasonId   String?
  name       String
  crop       String
  landSize   Float
  landUnit   String   @default("acres")
  startDate  DateTime
  endDate    DateTime?
  notes      String?
  isDeleted  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id])
  season     Season?  @relation(fields: [seasonId], references: [id])
  budgetItems BudgetItem[]
  expenses   Expense[]
  workEntries WorkEntry[]
}

model BudgetItem {
  id         String   @id @default(uuid())
  projectId  String
  category   String
  name       String
  quantity   Float
  unit       String
  unitPrice  Float
  total      Float
  notes      String?
  isDeleted  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  project    FarmProject @relation(fields: [projectId], references: [id])
}

model Expense {
  id         String   @id @default(uuid())
  projectId  String
  category   String
  amount     Float
  date       DateTime
  note       String?
  receiptUrl String?
  isDeleted  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  project    FarmProject @relation(fields: [projectId], references: [id])
}

model Employee {
  id          String   @id @default(uuid())
  userId      String
  name        String
  phone       String?
  role        String?
  isDeleted   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id])
  workEntries WorkEntry[]
  payments    Payment[]
}

model WorkEntry {
  id          String   @id @default(uuid())
  projectId   String
  employeeId  String
  activity    String
  date        DateTime
  daysWorked  Float
  ratePerDay  Float
  totalCost   Float
  notes       String?
  isPaid      Boolean  @default(false)
  isDeleted   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     FarmProject @relation(fields: [projectId], references: [id])
  employee    Employee @relation(fields: [employeeId], references: [id])
}

model Payment {
  id          String   @id @default(uuid())
  employeeId  String
  amount      Float
  date        DateTime
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  employee    Employee @relation(fields: [employeeId], references: [id])
}

model InventoryItem {
  id         String   @id @default(uuid())
  projectId  String
  name       String
  category   String   // seeds, fertilizer, pesticide, equipment
  quantity   Float
  unit       String
  unitCost   Float
  totalCost  Float
  usedQty    Float    @default(0)
  notes      String?
  isDeleted  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

# 🚀 PHASE 1 — Backend Foundation

> **Goal:** A working API you can test in Postman with auth and all core data models.

---

## TASK 1.1 — Project Setup

**Prompt for agent:**
> Initialize a Node.js + Express project. Install: express, prisma, @prisma/client, dotenv, cors, bcrypt, jsonwebtoken, zod. Create a basic server.js that starts on port 3000 and returns `{ status: "ok" }` on GET /health.

**Acceptance criteria:**
- `node server.js` starts without errors
- GET /health returns 200

---

## TASK 1.2 — Prisma + Database Setup

**Prompt for agent:**
> Set up Prisma with PostgreSQL. Create the schema.prisma file with the full schema (paste schema above). Run the initial migration. Seed the database with one test user and one farm project.

**Acceptance criteria:**
- `npx prisma migrate dev` completes without errors
- `npx prisma studio` shows all tables
- Seed data visible in studio

---

## TASK 1.3 — Auth Module

**Prompt for agent:**
> Build a JWT auth module with two endpoints:
> - POST /auth/register — name, phone, password (hash with bcrypt)
> - POST /auth/login — phone, password → returns JWT token
> Create an auth middleware that protects routes by verifying the JWT.

**Acceptance criteria:**
- Can register a new user
- Can login and receive a token
- Protected route returns 401 without token

---

## TASK 1.4 — Farm Projects API

**Prompt for agent:**
> Build CRUD endpoints for FarmProject (all protected by auth middleware):
> - POST /projects
> - GET /projects (only current user's projects, exclude isDeleted)
> - GET /projects/:id
> - PUT /projects/:id
> - DELETE /projects/:id (soft delete — set isDeleted: true)
> - GET /projects/:id/summary (return project + total budget, total expenses, total labor cost, total cost)

**Acceptance criteria:**
- All endpoints tested in Postman
- Summary endpoint returns correct totals
- Soft delete hides project from GET list

---

## TASK 1.5 — Budget API

**Prompt for agent:**
> Build CRUD endpoints for BudgetItem:
> - POST /budget
> - GET /budget/:projectId
> - PUT /budget/:id
> - DELETE /budget/:id (soft delete)
> Auto-calculate `total = quantity * unitPrice` on create and update.

**Acceptance criteria:**
- Total is always calculated server-side
- Budget items scoped to project

---

## TASK 1.6 — Expenses API

**Prompt for agent:**
> Build CRUD endpoints for Expense:
> - POST /expenses (accept optional receiptUrl)
> - GET /expenses/:projectId
> - PUT /expenses/:id
> - DELETE /expenses/:id (soft delete)

**Acceptance criteria:**
- All endpoints work in Postman

---

## TASK 1.7 — Employees API

**Prompt for agent:**
> Build CRUD endpoints for Employee:
> - POST /employees
> - GET /employees (current user's employees)
> - PUT /employees/:id
> - DELETE /employees/:id (soft delete)
> Also add GET /employees/:id/balance — returns total earned minus total paid.

**Acceptance criteria:**
- Balance endpoint calculates correctly

---

## TASK 1.8 — Work Entries API

**Prompt for agent:**
> Build CRUD endpoints for WorkEntry:
> - POST /work-entries (auto-calculate totalCost = daysWorked * ratePerDay)
> - GET /work-entries/:projectId
> - PUT /work-entries/:id (recalculate totalCost on update)
> - DELETE /work-entries/:id (soft delete)
> Also add:
> - GET /work-entries/:projectId/by-employee (group totals by employee)
> - GET /work-entries/:projectId/by-activity (group totals by activity)

**Acceptance criteria:**
- totalCost always calculated server-side
- Grouped endpoints return correct aggregations

---

## TASK 1.9 — Payments API

**Prompt for agent:**
> Build endpoints for Payment:
> - POST /payments (record a payment to an employee)
> - GET /payments/:employeeId
> Update GET /employees/:id/balance to subtract payments from labor cost.

**Acceptance criteria:**
- Balance reflects payments correctly

---

## TASK 1.10 — Inventory API

**Prompt for agent:**
> Build CRUD endpoints for InventoryItem:
> - POST /inventory
> - GET /inventory/:projectId
> - PUT /inventory/:id (update usedQty or other fields)
> - DELETE /inventory/:id (soft delete)
> Auto-calculate totalCost = quantity * unitCost.

**Acceptance criteria:**
- All endpoints work in Postman

---

# 📱 PHASE 2 — Mobile App (MVP)

> **Goal:** A working React Native app connected to the backend, with offline support.

---

## TASK 2.1 — Expo Project Setup + Navigation

**Prompt for agent:**
> Create a new Expo project. Install: zustand, @tanstack/react-query, react-navigation, axios, expo-secure-store. Set up bottom tab navigation with 5 tabs: Projects, Employees, Quick Entry, Reports, Settings. Each screen shows a placeholder for now.

**Acceptance criteria:**
- App runs in Expo Go
- Navigation between all tabs works

---

## TASK 2.2 — Auth Screens + Token Storage

**Prompt for agent:**
> Build Login and Register screens. On successful login, store the JWT in expo-secure-store. Create a useAuthStore (Zustand) that holds the token and user. Redirect to main app after login, redirect to login if no token found on app start.

**Acceptance criteria:**
- Can register and login
- Token persists after app restart
- Logout clears token and redirects

---

## TASK 2.3 — WatermelonDB Offline Setup

**Prompt for agent:**
> Install and configure WatermelonDB. Create local models mirroring: FarmProject, Expense, WorkEntry, Employee. Create a sync service that pulls from the backend API and writes to local DB on app foreground. All list screens should read from local DB, not directly from API.

**Acceptance criteria:**
- Data loads when offline (from local DB)
- Sync runs when app comes to foreground
- New records created offline sync when connectivity returns

---

## TASK 2.4 — Projects Screen

**Prompt for agent:**
> Build the Projects screen:
> - List of projects with name, crop, land size, total cost badge
> - Tap to open project detail
> - Floating button to create new project (form: name, crop, land size, start date)
> - Swipe to soft-delete

**Acceptance criteria:**
- Can create, view, and delete projects
- Works offline

---

## TASK 2.5 — Budget Screen

**Prompt for agent:**
> Build the Budget screen inside a project:
> - List budget items grouped by category
> - Show total budget at top
> - Add budget item form (category, name, quantity, unit, unit price)
> - Show progress bar: budget used vs total

**Acceptance criteria:**
- Budget items load and display
- Total calculates correctly

---

## TASK 2.6 — Expenses Screen

**Prompt for agent:**
> Build the Expenses screen inside a project:
> - List expenses sorted by date (most recent first)
> - Add expense form (category, amount, date, note, optional photo)
> - Use expo-image-picker for receipt photo
> - Show total expenses at top

**Acceptance criteria:**
- Can add expense with optional photo
- Expenses load from local DB when offline

---

## TASK 2.7 — Employees Screen

**Prompt for agent:**
> Build the Employees screen:
> - List all employees with name, role, and outstanding balance badge
> - Add employee form (name, phone, role)
> - Tap employee to see their work history and payment history
> - Record payment button on employee detail

**Acceptance criteria:**
- Balance displays correctly (earned - paid)
- Payment reduces balance immediately (optimistic update)

---

## TASK 2.8 — Work Log Screen

**Prompt for agent:**
> Build the Work Log screen inside a project:
> - List work entries grouped by date
> - Add work entry form:
>   - Select employee (dropdown from employees list)
>   - Activity (text input with suggestions: planting, weeding, harvesting, spraying)
>   - Date, days worked, rate per day
>   - Auto-show calculated total before saving
> - Show total labor cost for project at top

**Acceptance criteria:**
- Total cost previews before saving
- Employee dropdown populates from local DB

---

## TASK 2.9 — Quick Entry Screen

**Prompt for agent:**
> Build a Quick Entry screen — a single screen to log a work entry fast:
> - Select project (dropdown)
> - Select or type employee name
> - Activity (quick-select chips: Planting, Weeding, Harvesting, Spraying, Other)
> - Number of workers, days, rate
> - Auto-calculates total
> - One tap to save

**Acceptance criteria:**
- Full entry can be completed in under 10 seconds
- Works offline

---

## TASK 2.10 — Dashboard / Reports Screen

**Prompt for agent:**
> Build a Dashboard screen with:
> - Project selector at top
> - Summary cards: Total Budget, Total Spent, Labor Cost, Remaining
> - Budget vs Actual bar (progress bar)
> - Labor cost by employee (sorted list)
> - Labor cost by activity (sorted list)
> - Total unpaid labor balance

**Acceptance criteria:**
- All figures match backend /projects/:id/summary
- Updates when project is switched

---

# 🧪 PHASE 3 — Testing & Hardening

---

## TASK 3.1 — Backend Validation

**Prompt for agent:**
> Add zod validation middleware to all POST and PUT endpoints. Return clear error messages for missing or invalid fields. Add rate limiting (express-rate-limit) to auth endpoints.

---

## TASK 3.2 — Calculation Audit

**Prompt for agent:**
> Write Jest tests for all calculation logic:
> - totalCost = daysWorked * ratePerDay
> - budgetTotal = sum of budgetItems
> - expenseTotal = sum of expenses
> - laborTotal = sum of workEntries
> - projectTotal = expenseTotal + laborTotal
> - employeeBalance = laborTotal - paymentsTotal

---

## TASK 3.3 — Sync Conflict Handling

**Prompt for agent:**
> Update the WatermelonDB sync service to handle conflicts using last-write-wins strategy based on updatedAt timestamps. Log sync errors to console and show a small sync status indicator in the app header.

---

# 🚀 PHASE 4 — Enhancements

> Build these only after Phase 1–3 are stable and in use.

---

## TASK 4.1 — PDF / Excel Export

**Prompt for agent:**
> Add a backend endpoint GET /projects/:id/export?format=pdf|excel that generates a cost report for the project. Use pdfkit for PDF and exceljs for Excel. Include: project summary, budget table, expense list, labor cost by employee.

---

## TASK 4.2 — Yield & Profit Tracking

**Prompt for agent:**
> Add a Harvest model to the schema: projectId, cropWeight, unit, pricePerUnit, totalRevenue, date. Add API endpoints and a mobile screen. Update the Dashboard to show: Revenue, Total Cost, Net Profit/Loss.

---

## TASK 4.3 — Charts & Analytics

**Prompt for agent:**
> Add charts to the Dashboard using victory-native:
> - Cost breakdown pie chart (labor vs supplies vs other)
> - Monthly spending bar chart
> - Budget vs actual grouped bar chart

---

## TASK 4.4 — Multi-user / Team Support

**Prompt for agent:**
> Add a role field to users (owner, worker, viewer). Allow project owners to invite users by phone number. Implement permission checks on all endpoints: owners can write, viewers can only read.

---

## TASK 4.5 — AI Recommendations (Future)

**Prompt for agent:**
> Add a GET /projects/:id/recommendations endpoint that calls the Anthropic API with the project's cost data and returns 3 cost-saving suggestions based on spending patterns.

---

# ✅ MVP Checklist

### Backend
- [ ] Project setup + health check
- [ ] Database schema + migrations
- [ ] Auth (register, login, JWT middleware)
- [ ] Farm Projects CRUD + summary
- [ ] Budget CRUD
- [ ] Expenses CRUD
- [ ] Employees CRUD + balance
- [ ] Work Entries CRUD + grouped reports
- [ ] Payments CRUD
- [ ] Inventory CRUD

### Mobile
- [ ] Expo setup + navigation
- [ ] Login / Register screens
- [ ] Token storage + auth flow
- [ ] WatermelonDB offline setup
- [ ] Projects screen
- [ ] Budget screen
- [ ] Expenses screen (with photo)
- [ ] Employees screen + payments
- [ ] Work Log screen
- [ ] Quick Entry screen
- [ ] Dashboard / Reports screen

---

# 🧭 Execution Order

```
Phase 1 (Backend)     →  Test each task in Postman before moving on
Phase 2 (Mobile MVP)  →  Build screens one at a time, connect to API
Phase 3 (Testing)     →  Harden before showing to real users
Phase 4 (Enhancements)→  Only after real usage confirms what matters
```

**Start here:**
1. Run TASK 1.1 (project setup)
2. Run TASK 1.2 (database)
3. Run TASK 1.3 (auth)
4. Test all three in Postman
5. Continue down the list

> 💡 **Tip:** Paste each TASK's "Prompt for agent" directly into your AI coding agent (Claude Code, Cursor, etc.) along with relevant schema context. Keep tasks small — one task = one agent session.
