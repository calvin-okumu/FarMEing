---
name: farm-security-audit
description: Enforces project-wide security and data integrity mandates. Use when reviewing code or implementing new features to ensure compliance with 'ProjectAccess' (collaborative security) and 'Soft-Delete' (data protection) standards.
---

# Farm Security Audit

This skill ensures that all code adheres to the critical security and integrity mandates of the Shamba Mkononi project.

## Mandates

### 1. Collaborative Access Control (`ProjectAccess`)
All data associated with a project MUST be protected by the `ProjectAccess` model.
- **Rule**: Never query project-related data without verifying the user's role.
- **Implementation**: Use `verifyProjectAccess(projectId, userId, res, [roles])` in all controllers.
- **Default Roles**: `OWNER`, `MANAGER`, `VIEWER`.

### 2. Soft-Delete Consistency
Hard deletes are STRICTLY FORBIDDEN. All models MUST use the `isDeleted` flag.
- **Rule**: Every query MUST filter for `isDeleted: false` unless explicitly requested otherwise.
- **Rule**: Deletions MUST be implemented as `update({ data: { isDeleted: true } })`.

### 3. UI/UX & Code Complexity
Minimize bundle size and cognitive load by avoiding heavy dependencies and redundant UI elements.
- **Rule**: Use `stitchTheme` as the SINGLE SOURCE OF TRUTH for all styling. Never hardcode colors, spacing, or font sizes.
- **Rule**: Prefer custom, lightweight CSS-based visualizations over external graphing libraries (e.g., `react-native-chart-kit`).
- **Rule**: Remove "Snapshot" or "Dashboard-in-a-Dashboard" cards that duplicate existing data.
- **Rule**: Consolidate repetitive styling into shared `stitchTheme` or `StitchPrimitives`.
- **Rule**: Ensure keyboard management (e.g., `KeyboardAvoidingView`) is implemented to keep focused inputs visible.

## Reference Guides

- **Project Access Implementation**: See [project_access.md](references/project_access.md) for usage patterns in controllers and middleware.
- **Soft-Delete Implementation**: See [soft_delete.md](references/soft_delete.md) for Prisma query filters and global consistency rules.

## Audit Checklist

1.  **Does the model have `isDeleted`?** (Prisma & WatermelonDB)
2.  **Are all `findMany` and `findUnique` calls filtering by `isDeleted: false`?**
3.  **Is `verifyProjectAccess` called at the start of every project-related controller?**
4.  **Are sensitive fields excluded from the response?** (Use `PROJECT_SELECT` where applicable)
5.  **Is the correct role level required for the action?** (e.g., `MANAGER` for updates, `OWNER` for critical deletions)
