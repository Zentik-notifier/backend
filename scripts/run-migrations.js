/**
 * Script to run database migrations
 * Usage: node scripts/run-migrations.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { DataSource } = require('typeorm');
const ormconfig = require('../ormconfig');
const dataSource = ormconfig.default || ormconfig;

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');

  if (process.env.DB_SYNCHRONIZE === 'true') {
    console.log('⚠️  DB_SYNCHRONIZE is enabled, skipping migrations');
    return;
  }

  try {
    console.log('🔄 Initializing database connection...');
    await dataSource.initialize();

    console.log('🔄 Running pending migrations...');
    const migrations = await dataSource.runMigrations();

    if (migrations.length > 0) {
      console.log(`\n✅ Executed ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`  - ${migration.name}`);
      });
    } else {
      console.log('\n✅ Database is up to date, no migrations to run');
    }

    await dataSource.destroy();
    console.log('\n✅ Migration process completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

// Run migrations
runMigrations();
