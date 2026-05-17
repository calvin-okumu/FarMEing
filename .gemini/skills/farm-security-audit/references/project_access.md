# Project Access Implementation

## Collaborative Security Model

The project uses a `ProjectAccess` model to manage multi-user access to farm projects.

### Core Helper: `verifyProjectAccess`

Located in `backend/src/lib/project-access.js`.

```javascript
const { verifyProjectAccess } = require('../lib/project-access');

const myController = async (req, res) => {
  const { projectId } = req.params;
  
  // Verify access and require specific roles
  const access = await verifyProjectAccess(projectId, req.user.id, res, ['OWNER', 'MANAGER']);
  if (!access) return; // Response already sent by helper

  // access.role and access.project are now available
  // ...
};
```

### Roles and Permissions

- **OWNER**: Full control, including deletion of the project and management of other members.
- **MANAGER**: Can create, update, and delete (soft) records within the project (Expenses, Harvests, etc.).
- **VIEWER**: Read-only access to project data.

### Best Practices
- **Early Exit**: Call `verifyProjectAccess` as early as possible in the controller.
- **Scoping**: When querying related records, always include `projectId` in the `where` clause to prevent cross-project data leakage.
- **Select Shape**: Use `PROJECT_SELECT` from the lib to ensure consistent and safe project data exposure.
