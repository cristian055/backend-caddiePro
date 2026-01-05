import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Map list names to numbers
const LIST_MAP = {
  'Primera': 1,
  'Segunda': 2,
  'Tercera': 3,
};

async function importCaddies() {
  console.log('🚀 Starting caddie import...\n');

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
    const listaTexto = match[2];
    const listNumber = LIST_MAP[listaTexto];

    if (!listNumber) {
      console.log(`⚠️  Invalid list "${listaTexto}" for: ${nombre}`);
      continue;
    }

    try {
      // Check if caddie already exists
      const existing = await prisma.caddie.findFirst({
        where: { name: nombre, listNumber },
      });

      if (existing) {
        console.log(`⏭️  Skipping (already exists): ${nombre} (Lista ${listNumber})`);
        continue;
      }

      // Create caddie
      const caddie = await prisma.caddie.create({
        data: {
          name: nombre,
          listNumber,
          status: 'Disponible',
        },
      });

      // Get next queue position for this list
      const lastQueue = await prisma.caddieQueue.findFirst({
        where: { listNumber },
        orderBy: { position: 'desc' },
      });

      const position = lastQueue ? lastQueue.position + 1 : 1;

      // Create queue entry
      await prisma.caddieQueue.create({
        data: {
          caddieId: caddie.id,
          listNumber,
          position,
          available: true,
        },
      });

      console.log(`✅ Created: ${nombre} (Lista ${listNumber}, Posición ${position})`);
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

  console.log('\n🎉 Import completed!');
}

importCaddies()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
