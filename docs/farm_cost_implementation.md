# 🌱 Farm Cost & Labor Management App — Implementation Plan

## 🎯 Goal
Build a mobile application to plan, track, and analyze farming costs, including detailed labor (employee) tracking.

---

# 🧠 1. Development Approach (Agentic Coding)

Work in iterative cycles:
1. Define a small task
2. Generate code using AI agent
3. Run & test
4. Fix issues
5. Move to next task

---

# 🏗️ 2. Tech Stack

## Frontend (Mobile)
- React Native (Expo)

## Backend
- Node.js + Express

## Database
- PostgreSQL

---

# 📁 3. Project Structure

## Backend
```
server/
  modules/
    users/
    farmProjects/
    budget/
    expenses/
    employees/
    workEntries/
  config/
  shared/
```

## Mobile
```
app/
  screens/
  components/
  services/
  store/
```

---

# 🚀 4. Phase 1 — Core Backend

## TASK 1: Setup Backend Project
- Initialize Node.js project
- Install dependencies:
  - express
  - pg / prisma
  - dotenv
  - cors
- Setup basic server

---

## TASK 2: Database Setup

### FarmProject
- id
- name
- crop
- land_size
- start_date
- end_date

### BudgetItem
- id
- project_id
- category
- name
- quantity
- unit_price
- total

### Expense
- id
- project_id
- category
- amount
- date
- note

---

## TASK 3: Employee Module

### Employee Table
- id
- name
- phone
- role

### WorkEntry Table
- id
- project_id
- employee_id
- activity
- date
- days_worked
- rate_per_day
- total_cost
- notes

---

## TASK 4: API Endpoints

### Farm Projects
- POST /projects
- GET /projects

### Budget
- POST /budget
- GET /budget/:projectId

### Expenses
- POST /expenses
- GET /expenses/:projectId

### Employees
- POST /employees
- GET /employees

### Work Entries
- POST /work-entries
- GET /work-entries/:projectId

---

# 📱 5. Phase 2 — Mobile App (MVP)

## Screens

### 1. Project Screen
- Create project
- List projects

### 2. Budget Screen
- Add budget items
- View totals

### 3. Expense Screen
- Add expense
- View list

### 4. Employee Screen
- Add worker
- List workers

### 5. Work Log Screen
- Add work entry
- Select employee
- Enter days & rate

### 6. Dashboard
- Total cost
- Labor cost
- Budget vs actual

---

# 📊 6. Core Calculations

## Total Labor Cost
sum(work_entries.total_cost)

## Cost Per Worker
sum(work_entries.total_cost WHERE employee_id)

## Cost Per Activity
sum(work_entries.total_cost WHERE activity)

## Total Project Cost
expenses + labor_cost

---

# 🧪 7. Phase 3 — Testing
- Test all API endpoints
- Validate calculations
- Test mobile forms

---

# 🚀 8. Phase 4 — Enhancements
- Offline support (SQLite)
- Charts & analytics
- Export to PDF/Excel
- Authentication

---

# 🔥 9. Future Improvements
- Yield tracking
- Profit calculation
- Multi-user support
- AI recommendations

---

# ✅ 10. MVP Checklist
- [ ] Create project
- [ ] Add budget
- [ ] Add expenses
- [ ] Add employees
- [ ] Track work entries
- [ ] View total costs

---

# 🧭 Execution Tip
Start small:
1. Backend API
2. Test with Postman
3. Build mobile UI
4. Connect API

Avoid overbuilding early. Focus on usable features first.
