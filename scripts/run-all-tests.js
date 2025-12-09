/**
 * Master script to run all tests together
 * - Notification tests (send-comprehensive-test-notifications.js)
 * - Template and transformer tests (test-templates-transformers.js)
 * 
 * Usage: 
 *   node scripts/run-all-tests.js [--skip-notifications] [--skip-templates]
 * 
 * Environment variables:
 *   TOKEN - Access token (default: zat_ded1db02b4fc91e33ad9ff8aa3f0102c4eddbec1da9b33e51af70dd6d6ff1610)
 *   BUCKET_ID - Bucket ID (default: 2dd0e29d-51c9-45d6-93b9-668b26c659e5)
 *   BASE_URL - API base URL (default: http://localhost:3000/api/v1)
 */

const path = require('path');
const { spawn } = require('child_process');

const TOKEN = process.env.TOKEN || 'zat_ded1db02b4fc91e33ad9ff8aa3f0102c4eddbec1da9b33e51af70dd6d6ff1610';
const BUCKET_ID = process.env.BUCKET_ID || '2dd0e29d-51c9-45d6-93b9-668b26c659e5';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

const args = process.argv.slice(2);
const skipNotifications = args.includes('--skip-notifications');
const skipTemplates = args.includes('--skip-templates');

/**
 * Make an HTTP request
 */
async function fetch(url, options = {}) {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');
  
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;
  
  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        res.data = data;
        res.ok = res.statusCode >= 200 && res.statusCode < 300;
        res.status = res.statusCode;
        res.statusText = res.statusMessage;
        res.json = async () => {
          try {
            return JSON.parse(data);
          } catch (e) {
            throw new Error('Invalid JSON response');
          }
        };
        resolve(res);
      });
    });
    req.on('error', reject);
    
    if (options.headers) {
      Object.keys(options.headers).forEach(key => {
        req.setHeader(key, options.headers[key]);
      });
    }
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Get magic code for a bucket
 */
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

    const response = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query,
        variables: { id: bucketId }
      })
    });

    if (response.statusCode >= 400) {
      const errorText = response.data || response.statusMessage;
      console.error(`❌ Error getting magic code: ${response.statusCode} ${response.statusMessage}`, errorText);
      return null;
    }

    const result = JSON.parse(response.data);
    
    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);
      return null;
    }

    const magicCode = result.data?.bucket?.userBucket?.magicCode;
    if (magicCode) {
      return magicCode;
    } else {
      console.log('⚠️  No magic code found for this bucket');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting magic code:', error.message);
    return null;
  }
}

/**
 * Run a script and capture output
 */
function runScript(scriptPath, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 Running: ${path.basename(scriptPath)}`);
    console.log(`${'='.repeat(80)}\n`);

    const child = spawn('node', [scriptPath, ...args], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 COMPREHENSIVE TEST SUITE');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`   Bucket ID: ${BUCKET_ID}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Skip Notifications: ${skipNotifications}`);
  console.log(`   Skip Templates: ${skipTemplates}`);

  // Step 1: Get magic code
  console.log(`\n${'─'.repeat(80)}`);
  console.log('📦 STEP 1: Getting magic code...');
  const magicCode = await getMagicCode(TOKEN, BUCKET_ID);
  
  if (!magicCode) {
    console.error('\n❌ Failed to get magic code. Cannot proceed with template/transformer tests.');
    console.log('💡 You can still run notification tests with --skip-templates');
    if (skipTemplates) {
      console.log('   Continuing with notifications only...\n');
    } else {
      process.exit(1);
    }
  } else {
    console.log(`✅ Magic Code: ${magicCode}\n`);
  }

  const results = {
    notifications: { success: false, error: null },
    templates: { success: false, error: null }
  };

  // Step 2: Run notification tests
  if (!skipNotifications) {
    try {
      const notificationsScript = path.join(__dirname, 'notifications', 'send-comprehensive-test-notifications.js');
      await runScript(notificationsScript, [], {
        TOKEN,
        BASE_URL,
        DEFAULT_BUCKET_ID: BUCKET_ID
      });
      results.notifications.success = true;
    } catch (error) {
      results.notifications.success = false;
      results.notifications.error = error.message;
      console.error(`\n❌ Notification tests failed: ${error.message}`);
    }
  } else {
    console.log('\n⏭️  Skipping notification tests (--skip-notifications)');
  }

  // Step 3: Run template/transformer tests
  if (!skipTemplates && magicCode) {
    try {
      const templatesScript = path.join(__dirname, 'templates-transformers', 'test-templates-transformers.js');
      // Test with common templates and parsers
      const testArgs = [
        magicCode,
        'welcome-message',
        'alert-notification',
        'github',
        'railway',
        'authentik'
      ];
      await runScript(templatesScript, testArgs, {
        BASE_URL
      });
      results.templates.success = true;
    } catch (error) {
      results.templates.success = false;
      results.templates.error = error.message;
      console.error(`\n❌ Template/transformer tests failed: ${error.message}`);
    }
  } else if (!skipTemplates && !magicCode) {
    console.log('\n⏭️  Skipping template/transformer tests (no magic code)');
  } else {
    console.log('\n⏭️  Skipping template/transformer tests (--skip-templates)');
  }

  // Final summary
  console.log('\n' + '═'.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(80));

  if (!skipNotifications) {
    console.log(`\n📱 Notifications:`);
    if (results.notifications.success) {
      console.log(`   ✅ PASSED`);
    } else {
      console.log(`   ❌ FAILED: ${results.notifications.error || 'Unknown error'}`);
    }
  }

  if (!skipTemplates && magicCode) {
    console.log(`\n📝 Templates & Transformers:`);
    if (results.templates.success) {
      console.log(`   ✅ PASSED`);
    } else {
      console.log(`   ❌ FAILED: ${results.templates.error || 'Unknown error'}`);
    }
  }

  const allPassed = 
    (skipNotifications || results.notifications.success) &&
    (skipTemplates || !magicCode || results.templates.success);

  console.log(`\n${'═'.repeat(80)}`);
  if (allPassed) {
    console.log('✨ All tests completed successfully!');
    console.log('═'.repeat(80) + '\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. See details above.');
    console.log('═'.repeat(80) + '\n');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
