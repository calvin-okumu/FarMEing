const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing seed data (idempotent)
  await prisma.workEntry.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.farmProject.deleteMany();
  await prisma.season.deleteMany();
  await prisma.user.deleteMany({ where: { phone: '+255700000001' } });

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.create({
    data: {
      name: 'Juma Mwangi',
      phone: '+255700000001',
      password: hashedPassword,
      currency: 'TZS',
      locale: 'sw-TZ',
    },
  });

  console.log(`Created user: ${user.name} (${user.id})`);

  // Create a season
  const season = await prisma.season.create({
    data: {
      userId: user.id,
      name: 'Long Rains 2025',
      startDate: new Date('2025-03-01'),
      endDate: new Date('2025-07-31'),
    },
  });

  console.log(`Created season: ${season.name}`);

  // Create a farm project
  const project = await prisma.farmProject.create({
    data: {
      userId: user.id,
      seasonId: season.id,
      name: 'Maize Farm - Block A',
      crop: 'Maize',
      landSize: 5,
      landUnit: 'acres',
      startDate: new Date('2025-03-15'),
      endDate: new Date('2025-07-15'),
      notes: 'Hybrid maize, irrigated section near river.',
    },
  });

  console.log(`Created farm project: ${project.name}`);

  // Add a budget item
  await prisma.budgetItem.create({
    data: {
      projectId: project.id,
      category: 'Seeds',
      name: 'DK8031 Hybrid Maize Seeds',
      quantity: 10,
      unit: 'kg',
      unitPrice: 12000,
      total: 120000,
      notes: '2 kg per acre',
    },
  });

  // Add an expense
  await prisma.expense.create({
    data: {
      projectId: project.id,
      category: 'Labour',
      amount: 45000,
      date: new Date('2025-03-20'),
      note: 'Land preparation - tractor hire',
    },
  });

  // Add an employee
  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      name: 'Hassan Salim',
      phone: '+255711222333',
      role: 'Field Worker',
    },
  });

  // Add a work entry
  await prisma.workEntry.create({
    data: {
      projectId: project.id,
      employeeId: employee.id,
      activity: 'Planting',
      date: new Date('2025-03-22'),
      daysWorked: 3,
      ratePerDay: 10000,
      totalCost: 30000,
    },
  });

  console.log('Seed complete.');
  console.log('---');
  console.log('Test login credentials:');
  console.log('  Phone:    +255700000001');
  console.log('  Password: password123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
