const fs = require('fs');
const path = require('path');

const entityName = process.argv[2];
const fieldsJson = process.argv[3];

if (!entityName || !fieldsJson) {
  console.error('Usage: node scaffold_entity.cjs <EntityName> \'<FieldsJSON>\'');
  process.exit(1);
}

let fields;
try {
  fields = JSON.parse(fieldsJson);
} catch (e) {
  console.error('Invalid Fields JSON');
  process.exit(1);
}

const entity = entityName.charAt(0).toLowerCase() + entityName.slice(1);
const Entity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
const tableName = entityName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '') + 's';

console.log(`Scaffolding ${Entity}...`);

// --- Helper Functions ---

const toSnakeCase = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const getPrismaType = (type) => {
  if (type.startsWith('enum:')) return 'String';
  if (type.includes('number')) return 'Float';
  if (type.includes('date')) return 'DateTime';
  if (type.includes('boolean')) return 'Boolean';
  return 'String';
};

const getZodType = (type, forceOptional = false) => {
  let base;
  if (type.startsWith('enum:')) {
    const vals = type.split(':')[1].split(',');
    base = `z.enum(['${vals.join("', '")}'])`;
  } else if (type.includes('number')) {
    base = 'z.number()';
  } else if (type.includes('date')) {
    base = 'z.string().datetime({ offset: true }).or(z.string().date())';
  } else if (type.includes('boolean')) {
    base = 'z.boolean()';
  } else {
    base = 'z.string()';
  }

  if (forceOptional || type.includes('?')) {
    return `${base}.optional()`;
  }
  return base;
};

const getWatermelonType = (type) => {
  if (type.includes('number') || type.includes('date')) return 'number';
  if (type.includes('boolean')) return 'boolean';
  return 'string';
};

// --- Data Preparation ---

const prismaFields = Object.entries(fields).map(([name, type]) => {
  return `  ${name} ${getPrismaType(type)}${type.includes('?') ? '?' : ''}`;
}).join('\n');

const zodFields = Object.entries(fields).map(([name, type]) => {
  return `  ${name}: ${getZodType(type)},`;
}).join('\n');

const updateZodFields = Object.entries(fields).map(([name, type]) => {
  return `  ${name}: ${getZodType(type, true)},`;
}).join('\n');

const watermelonColumns = Object.entries(fields).map(([name, type]) => {
  return `    { name: '${toSnakeCase(name)}', type: '${getWatermelonType(type)}'${type.includes('?') ? ', isOptional: true' : ''} },`;
}).join('\n');

const modelFields = Object.entries(fields).map(([name, type]) => {
  return `  @field('${toSnakeCase(name)}') ${name};`;
}).join('\n');

// --- File Generation ---

const backendPath = 'backend/src';
const frontendPath = 'frontend/src';

const files = [
  {
    path: `${backendPath}/controllers/${entity}.controller.js`,
    content: `const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

const create${Entity} = async (req, res) => {
  const data = req.validatedData;
  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const record = await prisma.${entity}.create({
      data: {
        ...data,
        ${Object.entries(fields).filter(([_, t]) => t.includes('date')).map(([n]) => `${n}: data.${n} ? new Date(data.${n}) : undefined`).join(',\n        ')}
      },
    });
    return res.status(201).json({ ${entity}: record });
  } catch (error) {
    console.error('Create ${Entity} Error:', error);
    return res.status(500).json({ error: 'Failed to create ${entity}' });
  }
};

const list${Entity}s = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;

    const records = await prisma.${entity}.findMany({
      where: { projectId: req.params.projectId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ${entity}s: records });
  } catch (error) {
    console.error('List ${Entity}s Error:', error);
    return res.status(500).json({ error: 'Failed to list ${entity}s' });
  }
};

module.exports = { create${Entity}, list${Entity}s };`
  },
  {
    path: `${backendPath}/validators/${entity}.validator.js`,
    content: `const { z } = require('zod');

const create${Entity}Schema = z.object({
  projectId: z.string().uuid(),
${zodFields}
});

const update${Entity}Schema = z.object({
${updateZodFields}
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required for update',
});

module.exports = { create${Entity}Schema, update${Entity}Schema };`
  },
  {
    path: `${frontendPath}/db/models/${Entity}.js`,
    content: `import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class ${Entity} extends Model {
  static table = '${tableName}';

  @field('project_id') projectId;
${modelFields}
  @field('is_deleted') isDeleted;
  @field('created_at') createdAt;
  @field('updated_at') updatedAt;
}`
  }
];

files.forEach(f => {
  const dir = path.dirname(f.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f.path, f.content);
  console.log(`Generated ${f.path}`);
});

console.log('\n--- Manual Steps Required ---');
console.log(`1. Add model to backend/prisma/schema.prisma:\n\nmodel ${Entity} {\n  id String @id @default(uuid())\n  projectId String\n${prismaFields}\n  isDeleted Boolean @default(false)\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n  project FarmProject @relation(fields: [projectId], references: [id])\n}\n`);
console.log(`2. Update frontend/src/db/schema.js with table definition.`);
console.log(`3. Update backend/src/controllers/sync.controller.js (tableMap, SYNC_ORDER, fieldMapping).`);
console.log(`4. Register routes in backend/src/routes/${entity}.routes.js and server.js.`);
