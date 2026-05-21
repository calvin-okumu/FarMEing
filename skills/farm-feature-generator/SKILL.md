---
name: farm-feature-generator
description: Scaffolds new domain entities across the full farm management stack. Use when adding new domain models (like Equipment, Task, Chemical) to automate Prisma, Backend (Controller/Validator/Route), WatermelonDB (Schema/Model), and Frontend Screen creation.
---

# Farm Feature Generator

This skill automates the creation of a new domain entity across the entire offline-first stack.

## Workflow

1.  **Define the Entity**: Identify the fields, types, and relationships for the new entity.
2.  **Run Scaffolding Script**: Use the bundled script to generate the boilerplate.
3.  **Refine Implementation**: Manually adjust the generated code for specific business logic.
4.  **Sync Registration**: Ensure the new entity is correctly registered in the sync lifecycle.

## Scaffolding Command

Use the bundled script to generate files:

```bash
node skills/farm-feature-generator/scripts/scaffold_entity.cjs <EntityName> '<FieldsJSON>'
```

Example:
```bash
node skills/farm-feature-generator/scripts/scaffold_entity.cjs Equipment '{"name":"string","model":"string","purchaseDate":"date","status":"enum:OPERATIONAL,MAINTENANCE,BROKEN"}'
```

## Reference Patterns

- **Backend Patterns**: See [backend_patterns.md](references/backend_patterns.md) for Prisma, Controller, and Validator templates.
- **Frontend Patterns**: See [frontend_patterns.md](references/frontend_patterns.md) for WatermelonDB Schema/Model and Screen templates.
- **Sync Integration**: See [sync_integration.md](references/sync_integration.md) for details on updating `sync.controller.js`.

## Standards & Mandates

- **Soft Delete**: All entities MUST have an `isDeleted` field.
- **Security**: All backend controllers MUST use `verifyProjectAccess`.
- **UI**: All screens MUST use **Stitch UI** primitives (`StitchSurface`, `StitchInput`, etc.) and MUST use `stitchTheme` for any custom styling.
- **Keyboard**: Wrap all form content in keyboard-aware containers (e.g., `StitchDashboardShell` or `KeyboardAvoidingView`) to ensure inputs slide into view.
- **Naming**: Use `PascalCase` for entity names and `camelCase` for fields in code, but `snake_case` for WatermelonDB columns.
