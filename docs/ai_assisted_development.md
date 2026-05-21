# AI-Assisted Development Guide

This project leverages specialized AI skills to maintain consistency, enforce security mandates, and accelerate feature development.

## Available Skills

| Skill | Purpose | Key Commands / Usage |
| :--- | :--- | :--- |
| **`farm-feature-generator`** | Scaffolds new domain entities across the full stack. | "Create a new entity for [EntityName] with fields [JSON]" |
| **`farm-sync-manager`** | Manages the bi-directional sync lifecycle and field mappings. | "Hook up [Table] to sync" or "Fix sync mapping for [Field]" |
| **`farm-report-builder`** | Simplifies PDF and Excel report generation. | "Add a section to the PDF report" or "Create a new Excel export" |
| **`farm-security-audit`** | Enforces ProjectAccess and Soft-Delete compliance. | "Audit [File] for security" or "Implement deletion for [Entity]" |

---

## Usage Examples

### 1. Accelerating Feature Development
Use the **`farm-feature-generator`** to eliminate boilerplate when adding new domain models like "Livestock", "Equipment", or "Tasks".

*   **Example:** *"Create a new entity for Equipment with name (string), model (string), and purchaseDate (date)."*
*   **What happens:** The AI uses the `scaffold_entity.cjs` script to generate backend controllers, Zod validators, and WatermelonDB models automatically.

### 2. Maintaining Sync Integrity
The **`farm-sync-manager`** ensures your new data correctly flows between the mobile app (WatermelonDB) and the server (Prisma).

*   **Example:** *"I added a 'serial_number' field to Equipment. Update the sync mapping."*
*   **What happens:** The AI updates `backend/src/controllers/sync.controller.js` with the correct camelCase to snake_case mapping and date handling rules.

### 3. Building Rich Reports
The **`farm-report-builder`** provides pre-defined patterns for `pdfkit` and `exceljs`.

*   **Example:** *"Add a summary table of chemical applications to the project PDF report."*
*   **What happens:** The AI follows the project's layout standards (headers, lines, font sizes) to insert a consistent new section into the reporting logic.

### 4. Enforcing Security Mandates
The **`farm-security-audit`** skill prevents data leaks and ensures we never hard-delete records.

*   **Example:** *"Review my new controller for security compliance."*
*   **What happens:** The AI audits the code against the **ProjectAccess** checklist:
    - Is `verifyProjectAccess` called?
    - Are `findMany` calls filtering by `isDeleted: false`?
    - Are deletions implemented as soft-deletes?

---

## Developer Workflow with AI

1.  **Onboarding:** Ensure you have the Gemini CLI installed and the skills enabled.
2.  **Instruction:** Provide clear, high-level instructions referencing the domain (e.g., "Add a report", "Audit this route").
3.  **Validation:** The AI will use the skills to generate or review code. Always verify the output against the project's technical standards.
