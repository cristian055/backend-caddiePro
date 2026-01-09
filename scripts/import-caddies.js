import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isFresh = args.includes('--fresh') || args.includes('-f');

// Map category names to values
const CATEGORY_MAP = {
  'Primera': 'Primera',
  'Segunda': 'Segunda',
  'Tercera': 'Tercera',
};

async function importCaddies() {
  console.log('🚀 Starting caddie import...\n');
  
  // If --fresh flag is provided, clean existing data
  if (isFresh) {
    console.log('🧹 Fresh import requested - cleaning existing data...\n');
    
    // Delete in order to respect foreign key constraints
    const deletedHistory = await prisma.dispatchHistory.deleteMany({});
    console.log(`   Deleted ${deletedHistory.count} dispatch history records`);
    
    const deletedAvailability = await prisma.caddieAvailability.deleteMany({});
    console.log(`   Deleted ${deletedAvailability.count} availability records`);
    
    const deletedServiceLogs = await prisma.serviceLog.deleteMany({});
    console.log(`   Deleted ${deletedServiceLogs.count} service log records`);
    
    const deletedAssignments = await prisma.weeklyAssignment.deleteMany({});
    console.log(`   Deleted ${deletedAssignments.count} weekly assignment records`);
    
    const deletedCaddies = await prisma.caddie.deleteMany({});
    console.log(`   Deleted ${deletedCaddies.count} caddies`);
    
    const deletedLists = await prisma.listConfig.deleteMany({});
    console.log(`   Deleted ${deletedLists.count} list configs`);
    
    console.log('\n✅ Database cleaned successfully!\n');
  }

  // Read CSV file
  const csvPath = path.join(__dirname, '../load_data/caddies.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Skip header
  const dataLines = lines.slice(1);
  
  console.log(`📊 Found ${dataLines.length} caddies to import\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Track the next number for each category
  const categoryNumbers = {
    'Primera': 1,
    'Segunda': 1,
    'Tercera': 1,
  };

  // Count existing caddies per category to set correct numbers
  for (const category of Object.keys(categoryNumbers)) {
    const maxCaddie = await prisma.caddie.findFirst({
      where: { category },
      orderBy: { number: 'desc' },
    });
    if (maxCaddie) {
      categoryNumbers[category] = maxCaddie.number + 1;
    }
  }

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    
    if (!line) continue;

    // Parse CSV (handles quoted values)
    const match = line.match(/"([^"]+)","([^"]+)"/);
    
    if (!match) {
      console.log(`⚠️  Skipping invalid line ${i + 2}: ${line}`);
      continue;
    }

    const nombre = match[1];
    const categoryText = match[2];
    const category = CATEGORY_MAP[categoryText];

    if (!category) {
      console.log(`⚠️  Invalid category "${categoryText}" for: ${nombre}`);
      continue;
    }

    try {
      // Check if caddie already exists by name and category
      const existing = await prisma.caddie.findFirst({
        where: { name: nombre, category },
      });

      if (existing) {
        console.log(`⏭️  Skipping (already exists): ${nombre} (${category})`);
        continue;
      }

      // Determine the number for this caddie
      const number = categoryNumbers[category]++;

      // Create caddie with new schema
      const caddie = await prisma.caddie.create({
        data: {
          name: nombre,
          number,
          category,
          status: 'AVAILABLE',
          isActive: true,
          location: 'Llanogrande',
          role: 'Golf',
          weekendPriority: number,
          isSkippedNextWeek: false,
          historyCount: 0,
          absencesCount: 0,
          lateCount: 0,
          leaveCount: 0,
        },
      });

      console.log(`✅ Created: ${nombre} (${category}, #${number})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Error creating ${nombre}:`, error.message);
      errorCount++;
      errors.push({ nombre, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📈 Import Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('='.repeat(50));

  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach(e => console.log(`   - ${e.nombre}: ${e.error}`));
  }

  // Create default list configurations if they don't exist
  console.log('\n📋 Checking list configurations...');
  
  const listDefaults = [
    { category: 'Primera', name: 'Lista Primera', rangeStart: 1, rangeEnd: 60 },
    { category: 'Segunda', name: 'Lista Segunda', rangeStart: 1, rangeEnd: 30 },
    { category: 'Tercera', name: 'Lista Tercera', rangeStart: 1, rangeEnd: 25 },
  ];

  for (const listDef of listDefaults) {
    const existing = await prisma.listConfig.findFirst({
      where: { category: listDef.category },
    });

    if (!existing) {
      await prisma.listConfig.create({
        data: {
          name: listDef.name,
          category: listDef.category,
          location: 'Llanogrande',
          rangeStart: listDef.rangeStart,
          rangeEnd: listDef.rangeEnd,
          orderType: 'ASC',
        },
      });
      console.log(`   ✅ Created list config: ${listDef.name}`);
    } else {
      console.log(`   ⏭️  List config already exists: ${listDef.category}`);
    }
  }

  console.log('\n🎉 Import completed!');
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npm run import:caddies [options]

Options:
  --fresh, -f    Delete all existing caddies and related data before importing
  --help, -h     Show this help message

Examples:
  npm run import:caddies              # Import caddies (skips existing)
  npm run import:caddies -- --fresh   # Clean database and import fresh
`);
  process.exit(0);
}

importCaddies()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
