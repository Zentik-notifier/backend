/**
 * Script to test templates and transformers with magicCode
 * 
 * Usage: 
 *   node scripts/test-templates-transformers.js <magicCode> <template1> <template2> ... <parser1> <parser2> ...
 * 
 * Examples:
 *   node scripts/test-templates-transformers.js abc12345 my-template
 *   node scripts/test-templates-transformers.js abc12345 my-template authentic railway
 *   node scripts/test-templates-transformers.js abc12345 authentic github
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

// Test results tracking
const results = {
  templates: { success: [], failure: [] },
  transformers: { success: [], failure: [] }
};

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
        res.statusCode = res.statusCode;
        res.statusMessage = res.statusMessage;
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
 * Builtin parser payload examples
 */
const parserPayloads = {
  authentik: {
    body: 'User testuser logged in successfully: {"userAgent": "Mozilla/5.0", "pathNext": "/if/admin/", "authMethod": "password"}',
    severity: 'info',
    user_email: 'test@example.com',
    user_username: 'testuser'
  },
  servarr: {
    eventType: 'Download',
    movie: {
      title: 'Test Movie',
      year: 2024
    }
  },
  railway: {
    type: 'deployment',
    project: {
      name: 'test-project'
    },
    service: {
      name: 'test-service'
    },
    status: 'success'
  },
  github: {
    repository: {
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      html_url: 'https://github.com/testuser/test-repo'
    },
    sender: {
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png'
    },
    action: 'opened',
    pull_request: {
      title: 'Test PR',
      number: 123,
      html_url: 'https://github.com/testuser/test-repo/pull/123',
      body: 'This PR adds a new feature',
      state: 'open'
    }
  },
  expo: {
    accountName: 'test-account',
    projectName: 'test-project',
    platform: 'ios',
    status: 'finished',
    metadata: {
      buildProfile: 'production'
    }
  },
  'status-io': {
    title: 'Test Incident',
    details: 'This is a test incident',
    status_page_url: 'https://status.example.com',
    incident_url: 'https://status.example.com/incidents/123'
  },
  instatus: {
    meta: {
      event_type: 'incident.created'
    },
    page: {
      url: 'https://status.example.com'
    },
    incident: {
      name: 'Test Incident',
      status: 'investigating'
    }
  },
  'atlas-statuspage': {
    meta: {
      event_type: 'incident.created'
    },
    page: {
      id: 'test-page-id'
    },
    incident: {
      name: 'Test Incident',
      status: 'investigating'
    }
  }
};

/**
 * Test template endpoint
 */
async function testTemplate(magicCode, templateName) {
  const templateData = {
    name: 'Test User',
    message: `Test message from template ${templateName} at ${new Date().toISOString()}`,
    value: 42,
    status: 'success'
  };

  try {
    console.log(`\n📝 Testing template: ${templateName}`);
    
    const url = `${BASE_URL}/messages/template?template=${encodeURIComponent(templateName)}&magicCode=${encodeURIComponent(magicCode)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });

    const responseData = response.data ? JSON.parse(response.data) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`  ✅ SUCCESS: Message created with ID: ${responseData?.id}`);
      console.log(`     Title: ${responseData?.title || 'N/A'}`);
      console.log(`     Body: ${(responseData?.body || '').substring(0, 100)}...`);
      results.templates.success.push({
        template: templateName,
        messageId: responseData?.id,
        status: response.statusCode
      });
      return { success: true, messageId: responseData?.id, template: templateName };
    } else {
      console.log(`  ❌ FAILED: ${response.statusCode} - ${responseData?.message || response.statusMessage}`);
      results.templates.failure.push({
        template: templateName,
        error: responseData?.message || response.statusMessage,
        status: response.statusCode
      });
      return { success: false, error: responseData?.message || response.statusMessage, template: templateName };
    }
  } catch (error) {
    const errorMsg = error.message || error.toString() || 'Unknown error';
    console.log(`  ❌ FAILED: Exception - ${errorMsg}`);
    if (error.stack) {
      console.log(`     Stack: ${error.stack.substring(0, 200)}...`);
    }
    results.templates.failure.push({
      template: templateName,
      error: errorMsg
    });
    return { success: false, error: errorMsg, template: templateName };
  }
}

/**
 * Test transformer/parser endpoint
 */
async function testTransformer(magicCode, parserName) {
  // Get example payload for this parser
  const payload = parserPayloads[parserName.toLowerCase()] || parserPayloads[parserName] || {
    test: 'data',
    timestamp: new Date().toISOString(),
    message: `Test payload for parser ${parserName}`
  };

  try {
    console.log(`\n🔄 Testing transformer: ${parserName}`);
    console.log(`   Payload: ${JSON.stringify(payload).substring(0, 100)}...`);
    
    const url = `${BASE_URL}/messages/transform?parser=${encodeURIComponent(parserName)}&magicCode=${encodeURIComponent(magicCode)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = response.data ? JSON.parse(response.data) : null;

    if (response.statusCode === 204) {
      console.log(`  ⏭️  SKIPPED: Parser skipped (no content produced)`);
      results.transformers.success.push({
        parser: parserName,
        status: response.statusCode,
        skipped: true
      });
      return { success: true, skipped: true, parser: parserName };
    } else if (response.statusCode >= 200 && response.statusCode < 300) {
      // Check if response actually contains a message
      if (responseData && responseData.id) {
        console.log(`  ✅ SUCCESS: Message created with ID: ${responseData.id}`);
        console.log(`     Title: ${responseData.title || 'N/A'}`);
        console.log(`     Body: ${(responseData.body || '').substring(0, 100)}...`);
        results.transformers.success.push({
          parser: parserName,
          messageId: responseData.id,
          status: response.statusCode
        });
        return { success: true, messageId: responseData.id, parser: parserName };
      } else {
        // Response OK but no message ID - might be an error message
        console.log(`  ⚠️  WARNING: Parser returned success but no message ID`);
        console.log(`     Response: ${JSON.stringify(responseData).substring(0, 200)}...`);
        results.transformers.failure.push({
          parser: parserName,
          error: 'Parser returned success but no message ID',
          status: response.statusCode
        });
        return { success: false, error: 'Parser returned success but no message ID', parser: parserName };
      }
    } else {
      console.log(`  ❌ FAILED: ${response.statusCode} - ${responseData?.message || response.statusMessage}`);
      results.transformers.failure.push({
        parser: parserName,
        error: responseData?.message || response.statusMessage,
        status: response.statusCode
      });
      return { success: false, error: responseData?.message || response.statusMessage, parser: parserName };
    }
  } catch (error) {
    const errorMsg = error.message || error.toString() || 'Unknown error';
    console.log(`  ❌ FAILED: Exception - ${errorMsg}`);
    if (error.stack) {
      console.log(`     Stack: ${error.stack.substring(0, 200)}...`);
    }
    results.transformers.failure.push({
      parser: parserName,
      error: errorMsg
    });
    return { success: false, error: errorMsg, parser: parserName };
  }
}

/**
 * Determine if a name is a builtin parser
 */
function isBuiltinParser(name) {
  const builtinParsers = [
    'authentik', 'servarr', 'railway', 'github', 'expo', 
    'status-io', 'statusio', 'instatus', 'atlas-statuspage'
  ];
  return builtinParsers.includes(name.toLowerCase());
}

/**
 * Main test function
 */
async function runTests() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node scripts/test-templates-transformers.js <magicCode> <template1> [template2] ... [parser1] [parser2] ...

Examples:
  node scripts/test-templates-transformers.js abc12345 my-template
  node scripts/test-templates-transformers.js abc12345 my-template authentic railway
  node scripts/test-templates-transformers.js abc12345 authentic github expo

Builtin parsers:
  - authentic
  - servarr
  - railway
  - github
  - expo
  - status-io (or statusio)
  - instatus
  - atlas-statuspage

Environment variables:
  BASE_URL - API base URL (default: http://localhost:3000/api/v1)
`);
    process.exit(1);
  }

  const magicCode = args[0];
  const testNames = args.slice(1);

  console.log(`\n🚀 Starting template and transformer tests`);
  console.log(`   Magic Code: ${magicCode}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Tests to run: ${testNames.join(', ')}\n`);

  // Separate templates from parsers
  const templates = [];
  const parsers = [];

  for (const name of testNames) {
    if (isBuiltinParser(name)) {
      parsers.push(name);
    } else {
      // Assume it's a template (could also be a custom parser)
      // We'll try it as a template first, then as a parser if it fails
      templates.push(name);
    }
  }

  console.log(`📋 Templates to test: ${templates.length > 0 ? templates.join(', ') : 'none'}`);
  console.log(`🔄 Parsers to test: ${parsers.length > 0 ? parsers.join(', ') : 'none'}\n`);

  // Test templates
  if (templates.length > 0) {
    console.log('='.repeat(60));
    console.log('TESTING TEMPLATES');
    console.log('='.repeat(60));
    
    for (const template of templates) {
      await testTemplate(magicCode, template);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Test parsers/transformers
  if (parsers.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('TESTING TRANSFORMERS/PARSERS');
    console.log('='.repeat(60));
    
    for (const parser of parsers) {
      await testTransformer(magicCode, parser);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  if (templates.length > 0) {
    console.log(`\n📝 Templates:`);
    console.log(`   ✅ Success: ${results.templates.success.length}`);
    console.log(`   ❌ Failed: ${results.templates.failure.length}`);
    
    if (results.templates.success.length > 0) {
      console.log(`\n   Successful templates:`);
      results.templates.success.forEach(r => {
        console.log(`     - ${r.template} (Message ID: ${r.messageId})`);
      });
    }
    
    if (results.templates.failure.length > 0) {
      console.log(`\n   Failed templates:`);
      results.templates.failure.forEach(r => {
        console.log(`     - ${r.template}: ${r.error} (Status: ${r.status || 'N/A'})`);
      });
    }
  }

  if (parsers.length > 0) {
    console.log(`\n🔄 Transformers/Parsers:`);
    console.log(`   ✅ Success: ${results.transformers.success.length}`);
    console.log(`   ❌ Failed: ${results.transformers.failure.length}`);
    
    if (results.transformers.success.length > 0) {
      console.log(`\n   Successful parsers:`);
      results.transformers.success.forEach(r => {
        if (r.skipped) {
          console.log(`     - ${r.parser} (Skipped - no content)`);
        } else {
          console.log(`     - ${r.parser} (Message ID: ${r.messageId})`);
        }
      });
    }
    
    if (results.transformers.failure.length > 0) {
      console.log(`\n   Failed parsers:`);
      results.transformers.failure.forEach(r => {
        console.log(`     - ${r.parser}: ${r.error} (Status: ${r.status || 'N/A'})`);
      });
    }
  }

  const totalSuccess = results.templates.success.length + results.transformers.success.length;
  const totalFailure = results.templates.failure.length + results.transformers.failure.length;
  
  console.log(`\n📊 Total:`);
  console.log(`   ✅ Success: ${totalSuccess}`);
  console.log(`   ❌ Failed: ${totalFailure}`);
  
  // Only exit with error if all tests failed or if there are critical errors
  // Template not found (404) is acceptable for optional templates
  const criticalFailures = results.templates.failure.filter(f => f.status && f.status !== 404).length +
                          results.transformers.failure.filter(f => f.status && f.status !== 404 && f.status !== 204).length;
  
  if (totalSuccess === 0 || criticalFailures > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
