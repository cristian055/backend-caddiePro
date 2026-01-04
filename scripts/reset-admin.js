import prisma from '../src/config/database.js';
import bcrypt from 'bcryptjs';

async function resetAdmin() {
  try {
    console.log('=== Admin Reset Tool ===');

    // Check current admin
    const currentAdmin = await prisma.admin.findFirst();
    if (currentAdmin) {
      console.log('Current admin found:');
      console.log('  ID:', currentAdmin.id);
      console.log('  Created:', currentAdmin.createdAt);
      console.log('  Password hash:', currentAdmin.password.substring(0, 30) + '...');

      // Test if "admin123" works
      const testMatch = await bcrypt.compare('admin123', currentAdmin.password);
      console.log('  Password "admin123" matches:', testMatch);
    } else {
      console.log('No admin found in database');
    }

    // Ask what to do
    const action = process.argv[2];

    if (action === 'reset' || action === 'create') {
      console.log('\n=== Creating/Resetting Admin ===');

      // Delete existing admin
      if (currentAdmin) {
        await prisma.admin.deleteMany();
        console.log('Deleted existing admin');
      }

      // Create new admin with password "admin123"
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const newAdmin = await prisma.admin.create({
        data: { password: hashedPassword },
      });

      console.log('New admin created:');
      console.log('  ID:', newAdmin.id);
      console.log('  Password: admin123');
      console.log('  Hash:', hashedPassword.substring(0, 30) + '...');
      console.log('\n✅ Admin reset successfully!');
    } else if (action === 'test') {
      console.log('\n=== Testing Passwords ===');

      const testPasswords = ['admin123', 'admin', 'password', 'test'];

      for (const testPwd of testPasswords) {
        const match = currentAdmin ? await bcrypt.compare(testPwd, currentAdmin.password) : false;
        console.log(`  "${testPwd}": ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
      }
    } else {
      console.log('\nUsage:');
      console.log('  node scripts/reset-admin.js check    - Check current admin');
      console.log('  node scripts/reset-admin.js reset    - Reset admin password to "admin123"');
      console.log('  node scripts/reset-admin.js create    - Create new admin with password "admin123"');
      console.log('  node scripts/reset-admin.js test     - Test common passwords');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();
