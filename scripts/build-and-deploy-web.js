#!/usr/bin/env node

/**
 * Build web frontend and copy to backend/public
 * This script:
 * 1. Builds the frontend web app
 * 2. Copies it to backend/public
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const BACKEND_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(BACKEND_DIR, 'public');

function exec(command, options = {}) {
  console.log(`\n📦 ${command}`);
  try {
    return execSync(command, {
      stdio: 'inherit',
      ...options,
    });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log('🚀 Starting web build process...\n');

  // Step 1: Build frontend with EXPO_PUBLIC_SELFHOSTED=true
  console.log('📦 Building frontend web app (self-hosted mode)...');
  exec('EXPO_PUBLIC_SELFHOSTED=true npm run build:web', { cwd: FRONTEND_DIR });

  // Step 2: Remove old public directory if exists
  if (fs.existsSync(PUBLIC_DIR)) {
    console.log('\n🧹 Removing old public directory...');
    fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  }

  // Step 3: Copy dist to backend/public
  console.log('\n📋 Copying built files to backend/public...');
  const distDir = path.join(FRONTEND_DIR, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('❌ Frontend dist directory not found!');
    process.exit(1);
  }
  fs.cpSync(distDir, PUBLIC_DIR, { recursive: true });

  // Step 4: Get frontend version
  const frontendPackageJson = JSON.parse(
    fs.readFileSync(path.join(FRONTEND_DIR, 'package.json'), 'utf8')
  );
  const frontendVersion = frontendPackageJson.version;

  console.log('\n✅ Build completed successfully!');
  console.log(`📦 Frontend version: ${frontendVersion}`);
  console.log(`� Files copied to: ${PUBLIC_DIR}`);
  console.log('\n💡 Next steps:');
  console.log('   - Commit and push the public/ directory to trigger Docker build');
  console.log('   - Or run the backend locally to test with: npm run start:dev');
}

main();
