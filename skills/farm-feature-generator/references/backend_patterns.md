# Backend Patterns for Domain Entities

## Prisma Model Template

```prisma
model {{Entity}} {
  id          String      @id @default(uuid())
  projectId   String
  {{fields}}
  isDeleted   Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  project     FarmProject @relation(fields: [projectId], references: [id])
}
```

## Controller Template

```javascript
const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

const create{{Entity}} = async (req, res) => {
  const data = req.validatedData;
  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const record = await prisma.{{entity}}.create({
      data: {
        ...data,
        {{dateFields}}
      },
    });
    return res.status(201).json({ {{entity}}: record });
  } catch (error) {
    console.error('Create {{Entity}} Error:', error);
    return res.status(500).json({ error: 'Failed to create {{entity}}' });
  }
};

const list{{Entity}}s = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;

    const records = await prisma.{{entity}}.findMany({
      where: { projectId: req.params.projectId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ {{entity}}s: records });
  } catch (error) {
    console.error('List {{Entity}}s Error:', error);
    return res.status(500).json({ error: 'Failed to list {{entity}}s' });
  }
};

module.exports = { create{{Entity}}, list{{Entity}}s, update{{Entity}}, delete{{Entity}} };
```

## Validator Template (Zod)

```javascript
const { z } = require('zod');

const create{{Entity}}Schema = z.object({
  projectId: z.string().uuid(),
  {{zodFields}}
});

const update{{Entity}}Schema = z.object({
  {{zodFieldsOptional}}
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required for update',
});

module.exports = { create{{Entity}}Schema, update{{Entity}}Schema };
```
