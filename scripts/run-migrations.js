const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔄 Running database migrations...\n');

const backendDir = path.join(__dirname, '..');
const distExists = fs.existsSync(path.join(backendDir, 'dist'));
const tsNodeAvailable = fs.existsSync(path.join(backendDir, 'node_modules', 'ts-node'));

try {
  let command;
  
  if (distExists && !tsNodeAvailable) {
    // Production mode: use compiled JS files
    console.log('Running migrations in production mode (using compiled JS)...');
    command = 'npx typeorm migration:run -d dist/ormconfig.js';
  } else {
    // Development mode: use ts-node
    console.log('Running migrations in development mode (using TypeScript)...');
    command = 'npx ts-node -r tsconfig-paths/register node_modules/typeorm/cli.js migration:run -d ormconfig.ts';
  }
  
  execSync(command, {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_PROJECT: './tsconfig.json' }
  });
  
  console.log('\n✅ Migrations completed successfully');
} catch (error) {
  console.error('\n❌ Migration failed');
  console.error(error);
  process.exit(1);
}

