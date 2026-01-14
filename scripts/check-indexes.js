import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIndexes() {
  console.log('🔍 Checking composite indexes...\n');

  // Get information about all tables and their indexes
  const tables = await prisma.$queryRaw`
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;

  // Group by table
  const indexesByTable = {};
  tables.forEach(idx => {
    if (!indexesByTable[idx.tablename]) {
      indexesByTable[idx.tablename] = [];
    }
    indexesByTable[idx.tablename].push(idx);
  });

  // Display composite indexes only
  for (const [table, indexes] of Object.entries(indexesByTable)) {
    const compositeIndexes = indexes.filter(idx => {
      const indexdef = idx.indexdef;
      return indexdef.includes('(') && indexdef.includes(',');
    });

    if (compositeIndexes.length > 0) {
      console.log(`\n📊 Table: ${table}`);
      compositeIndexes.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
        console.log(`    ${idx.indexdef}`);
      });
    }
  }

  console.log('\n✅ Index check complete!\n');

  await prisma.$disconnect();
}

checkIndexes().catch(console.error);