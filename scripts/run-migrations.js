const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Running database migrations...\n');

try {
  // Use ts-node to run the migration with proper path resolution
  execSync(
    'npx ts-node -r tsconfig-paths/register node_modules/typeorm/cli.js migration:run -d ormconfig.ts',
    {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env, TS_NODE_PROJECT: './tsconfig.json' }
    }
  );
  console.log('\n✅ Migrations completed successfully');
} catch (error) {
  console.error('\n❌ Migration failed');
  process.exit(1);
}

