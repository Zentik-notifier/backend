#!/usr/bin/env node

/**
 * Node.js script for backend deployment automation (version bump + git push + Railway deploy)
 * Usage: node scripts/deploy.js [patch|minor|major]
 * Default: patch
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function colorize(color, text) {
    return `${colors[color]}${text}${colors.reset}`;
}

function printInfo(message) {
    console.log(colorize('blue', `ℹ️  ${message}`));
}

function printSuccess(message) {
    console.log(colorize('green', `✅ ${message}`));
}

function printWarning(message) {
    console.log(colorize('yellow', `⚠️  ${message}`));
}

function printError(message) {
    console.log(colorize('red', `❌ ${message}`));
}

function printHeader() {
    console.log(colorize('blue', '🚀 ========================================'));
    console.log(colorize('blue', '   Zentik Backend Deploy Automation'));
    console.log(colorize('blue', '   Version Bump → Git Push → Railway Deploy'));
    console.log(colorize('blue', '========================================'));
}

// Function to run shell commands
function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        printInfo(`Running: ${command} ${args.join(' ')}`);

        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

// Check we're in the correct directory
const packagePath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packagePath)) {
    printError('package.json not found. Run the script from the backend/ directory');
    process.exit(1);
}

// Check if we're in a git repository
if (!fs.existsSync(path.join(process.cwd(), '..', '.git'))) {
    printError('.git directory not found. Make sure you are in a git repository');
    process.exit(1);
}

// Bump type (default: patch)
const bumpType = process.argv[2] || 'patch';

// Validate bump type
if (!['patch', 'minor', 'major'].includes(bumpType)) {
    printError(`Invalid bump type: ${bumpType}`);
    printInfo('Use: patch, minor, or major');
    process.exit(1);
}

printHeader();
printInfo(`Bump type: ${bumpType}`);

// Read package.json file
let packageJson;
try {
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    packageJson = JSON.parse(packageContent);
} catch (error) {
    printError(`Error reading package.json: ${error.message}`);
    process.exit(1);
}

// Extract current version
if (!packageJson.version) {
    printError('Unable to find version in package.json');
    process.exit(1);
}

const currentVersion = packageJson.version;

printInfo('Current version:');
printInfo(`  Version: ${currentVersion}`);

// Function to increment semantic version
function incrementVersion(version, type) {
    const parts = version.split('.').map(Number);
    let [major, minor, patch] = parts;

    switch (type) {
        case 'major':
            major += 1;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor += 1;
            patch = 0;
            break;
        case 'patch':
            patch += 1;
            break;
    }

    return `${major}.${minor}.${patch}`;
}

// Calculate new version
const newVersion = incrementVersion(currentVersion, bumpType);

printInfo('New version:');
printInfo(`  Version: ${newVersion}`);

// Create backup
const backupPath = `${packagePath}.backup`;
try {
    fs.copyFileSync(packagePath, backupPath);
    printInfo(`Backup created: ${path.basename(backupPath)}`);
} catch (error) {
    printError(`Error creating backup: ${error.message}`);
    process.exit(1);
}

// Update version in package.json
packageJson.version = newVersion;

// Write updated file
try {
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    printSuccess('Version updated in package.json');
} catch (error) {
    printError(`Error writing package.json: ${error.message}`);
    // Restore backup
    try {
        fs.copyFileSync(backupPath, packagePath);
        printWarning('File restored from backup');
    } catch (restoreError) {
        printError(`Error restoring: ${restoreError.message}`);
    }
    process.exit(1);
}

// Show differences
printInfo('Changes:');
printInfo(`  Version: ${currentVersion} → ${newVersion}`);

printSuccess('🎉 Version bump completed successfully!');

// Main deployment process
async function runDeployProcess() {
    try {
        console.log('');
        printInfo('Starting automated backend deployment process...');

        // Step 1: Trigger Railway deploy
        printInfo('Step 3/3: Triggering Railway deployment...');

        // Check if railway CLI is available
        try {
            await runCommand('railway', ['--version']);
        } catch (error) {
            printWarning('Railway CLI not found. Attempting to install...');
            await runCommand('npm', ['install', '-g', '@railway/cli']);
        }

        // Check if project is linked
        try {
            await runCommand('railway', ['status'], { cwd: '..' });
        } catch (error) {
            printWarning('No Railway project linked. Attempting to link...');
            printInfo('Please follow the prompts to link your Railway project:');
            await runCommand('railway', ['link'], { cwd: '..' });
        }

        // Trigger deployment (detached mode)
        await runCommand('railway', ['up', '--detach'], { cwd: '..' });

        printSuccess('Railway deployment triggered successfully!');

        // Step 2: Git add and commit
        printInfo('Step 1/3: Committing changes to git...');
        await runCommand('git', ['add', 'backend/package.json'], { cwd: '..' });
        await runCommand('git', ['commit', '-m', `"chore: bump backend version to v${newVersion}"`], { cwd: '..' });

        printSuccess('Changes committed to git');

        // Step 3: Git push
        printInfo('Step 2/3: Pushing to git repository...');
        await runCommand('git', ['push'], { cwd: '..' });

        printSuccess('Changes pushed to git repository');

        // Remove backup if everything went well
        try {
            fs.unlinkSync(backupPath);
            printInfo('Backup removed');
        } catch (error) {
            printWarning(`Unable to remove backup: ${error.message}`);
        }

        printSuccess('🎉 Backend deployment automation completed successfully!');
        console.log('');
        printInfo('Summary:');
        printInfo(`  ✅ Version bumped: ${currentVersion} → ${newVersion}`);
        printInfo(`  ✅ Changes committed to git`);
        printInfo(`  ✅ Changes pushed to repository`);
        printInfo(`  ✅ Railway deployment triggered`);

    } catch (error) {
        printError(`Deployment process failed: ${error.message}`);
        printWarning('Restoring backup...');

        // Restore backup in case of error
        try {
            fs.copyFileSync(backupPath, packagePath);
            printWarning('package.json file restored from backup');
            fs.unlinkSync(backupPath);
            printInfo('Backup file removed');
        } catch (restoreError) {
            printError(`Error restoring backup: ${restoreError.message}`);
        }

        printWarning('You may need to reset git changes manually if the commit was made');
        process.exit(1);
    }
}

// Run the deployment process
runDeployProcess();
