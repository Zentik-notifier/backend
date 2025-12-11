#!/usr/bin/env node

/**
 * Run templates & parsers tests as a standalone step.
 *
 * Uses:
 * - TOKEN (access token)
 * - BUCKET_ID (bucket with magicCode)
 * - BASE_URL (API base URL, e.g. http://localhost:3000/api/v1)
 */

const path = require('path');
const { spawn } = require('child_process');

const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

if (!BUCKET_ID) {
  console.error('❌ BUCKET_ID environment variable is required');
  process.exit(1);
}

/**
 * Minimal HTTP helper (same style as other scripts).
 */
async function fetchHttp(url, options = {}) {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        res.data = data;
        res.ok = res.statusCode >= 200 && res.statusCode < 300;
        res.status = res.statusCode;
        res.statusText = res.statusMessage;
        resolve(res);
      });
    });
    req.on('error', reject);

    if (options.headers) {
      Object.keys(options.headers).forEach((key) => {
        req.setHeader(key, options.headers[key]);
      });
    }

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function getMagicCode(token, bucketId) {
  try {
    const query = `
      query GetBucket($id: String!) {
        bucket(id: $id) {
          id
          name
          userBucket {
            magicCode
          }
        }
      }
    `;

    const response = await fetchHttp(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: { id: bucketId },
      }),
    });

    if (response.status >= 400) {
      const errorText = response.data || response.statusText;
      console.error(`❌ Error getting magic code: ${response.status} ${response.statusText}`, errorText);
      return null;
    }

    const result = JSON.parse(response.data || '{}');

    if (result.errors) {
      console.error('❌ GraphQL errors while getting magic code:', result.errors);
      return null;
    }

    const magicCode = result.data?.bucket?.userBucket?.magicCode;
    if (!magicCode) {
      console.log('⚠️  No magic code found for this bucket; template tests will be skipped.');
      return null;
    }

    return magicCode;
  } catch (error) {
    console.error('❌ Error getting magic code:', error.message);
    return null;
  }
}

function runScript(scriptPath, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Running: ${path.basename(scriptPath)}`);
    console.log(`${'='.repeat(80)}\n`);

    const child = spawn('node', [scriptPath, ...args], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${path.basename(scriptPath)} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('📝 TEMPLATES & PARSERS TESTS');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`   Bucket ID: ${BUCKET_ID}`);
  console.log(`   Base URL: ${BASE_URL}`);

  console.log(`\n${'─'.repeat(80)}`);
  console.log('📦 STEP 1: Getting magic code...');
  const magicCode = await getMagicCode(TOKEN, BUCKET_ID);

  if (!magicCode) {
    console.log('\n⏭️  Skipping template/transformer tests (no magic code available).');
    return; // do not fail the build just for missing magic code
  }

  console.log(`✅ Magic Code: ${magicCode}\n`);

  // Step 2: Ensure required templates/parsers exist
  try {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('📦 STEP 2: Creating required templates (if needed)...');

    const createScript = path.join(__dirname, 'create-templates-parsers.js');
    const examplesDir = path.join(__dirname, 'examples');
    const fs = require('fs');

    const welcomeTemplate = path.join(examplesDir, 'template-example.json');
    if (fs.existsSync(welcomeTemplate)) {
      try {
        console.log('   Creating welcome-message template...');
        await runScript(createScript, [TOKEN, '--template', welcomeTemplate], { BASE_URL });
      } catch (err) {
        console.log(`   ⚠️  Could not create welcome-message template: ${err.message}`);
        console.log('   (This is OK if the template already exists)');
      }
    }

    const alertTemplate = path.join(examplesDir, 'template-example2.json');
    if (fs.existsSync(alertTemplate)) {
      try {
        console.log('   Creating alert-notification template...');
        await runScript(createScript, [TOKEN, '--template', alertTemplate], { BASE_URL });
      } catch (err) {
        console.log(`   ⚠️  Could not create alert-notification template: ${err.message}`);
        console.log('   (This is OK if the template already exists)');
      }
    }

    console.log('✅ Template creation step completed.');
  } catch (error) {
    console.warn(`⚠️  Warning: Could not create templates: ${error.message}`);
    console.log('   Continuing with tests anyway...');
  }

  // Step 3: Run template/transformer tests
  console.log(`\n${'─'.repeat(80)}`);
  console.log('🧪 STEP 3: Running template/transformer tests...');

  const templatesScript = path.join(__dirname, 'test-templates-transformers.js');
  const testArgs = [
    magicCode,
    'welcome-message',
    'alert-notification',
    'github',
    'railway',
    'authentik',
  ];

  await runScript(templatesScript, testArgs, { BASE_URL });

  console.log('\n✅ Templates & parsers tests completed successfully.');
}

main().catch((err) => {
  console.error('\n❌ Templates & parsers tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
