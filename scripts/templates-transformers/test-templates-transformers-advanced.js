/**
 * Advanced script to test templates and transformers with magicCode
 * Supports custom payloads and more complex configurations
 * 
 * Usage: 
 *   node scripts/test-templates-transformers-advanced.js <magicCode> --config <configFile>
 *   node scripts/test-templates-transformers-advanced.js <magicCode> --template <name> --data <jsonFile>
 *   node scripts/test-templates-transformers-advanced.js <magicCode> --parser <name> --payload <jsonFile>
 * 
 * Examples:
 *   node scripts/test-templates-transformers-advanced.js abc12345 --template my-template --data ./test-data.json
 *   node scripts/test-templates-transformers-advanced.js abc12345 --parser authentic --payload ./authentik-payload.json
 *   node scripts/test-templates-transformers-advanced.js abc12345 --config ./test-config.json
 */

const fs = require('fs');
const path = require('path');

let BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

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
        resolve(res);
      });
    });
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Load JSON from file
 */
function loadJsonFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading JSON file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Test template endpoint with custom data
 */
async function testTemplate(magicCode, templateName, templateData = null) {
  const defaultData = {
    name: 'Test User',
    message: `Test message from template ${templateName} at ${new Date().toISOString()}`,
    value: 42,
    status: 'success'
  };

  const data = templateData || defaultData;

  try {
    console.log(`\n📝 Testing template: ${templateName}`);
    console.log(`   Data: ${JSON.stringify(data).substring(0, 150)}...`);
    
    const url = `${BASE_URL}/messages/template?template=${encodeURIComponent(templateName)}&magicCode=${encodeURIComponent(magicCode)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const responseData = response.data ? JSON.parse(response.data) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`  ✅ SUCCESS: Message created with ID: ${responseData?.id}`);
      console.log(`     Title: ${responseData?.title || 'N/A'}`);
      console.log(`     Subtitle: ${responseData?.subtitle || 'N/A'}`);
      console.log(`     Body: ${(responseData?.body || '').substring(0, 150)}...`);
      results.templates.success.push({
        template: templateName,
        messageId: responseData?.id,
        status: response.statusCode,
        response: responseData
      });
      return { success: true, messageId: responseData?.id, template: templateName, response: responseData };
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
    console.log(`  ❌ FAILED: Exception - ${error.message}`);
    results.templates.failure.push({
      template: templateName,
      error: error.message
    });
    return { success: false, error: error.message, template: templateName };
  }
}

/**
 * Test transformer/parser endpoint with custom payload
 */
async function testTransformer(magicCode, parserName, payload = null) {
  const defaultPayload = {
    test: 'data',
    timestamp: new Date().toISOString(),
    message: `Test payload for parser ${parserName}`
  };

  const testPayload = payload || defaultPayload;

  try {
    console.log(`\n🔄 Testing transformer: ${parserName}`);
    console.log(`   Payload: ${JSON.stringify(testPayload).substring(0, 150)}...`);
    
    const url = `${BASE_URL}/messages/transform?parser=${encodeURIComponent(parserName)}&magicCode=${encodeURIComponent(magicCode)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
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
      console.log(`  ✅ SUCCESS: Message created with ID: ${responseData?.id}`);
      console.log(`     Title: ${responseData?.title || 'N/A'}`);
      console.log(`     Subtitle: ${responseData?.subtitle || 'N/A'}`);
      console.log(`     Body: ${(responseData?.body || '').substring(0, 150)}...`);
      results.transformers.success.push({
        parser: parserName,
        messageId: responseData?.id,
        status: response.statusCode,
        response: responseData
      });
      return { success: true, messageId: responseData?.id, parser: parserName, response: responseData };
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
    console.log(`  ❌ FAILED: Exception - ${error.message}`);
    results.transformers.failure.push({
      parser: parserName,
      error: error.message
    });
    return { success: false, error: error.message, parser: parserName };
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    return null;
  }

  const magicCode = args[0];
  const config = {
    magicCode,
    templates: [],
    parsers: [],
    configFile: null
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--config' && i + 1 < args.length) {
      config.configFile = args[++i];
    } else if (arg === '--template' && i + 1 < args.length) {
      const templateName = args[++i];
      const templateConfig = { name: templateName };
      
      // Check for --data option
      if (i + 1 < args.length && args[i + 1] === '--data' && i + 2 < args.length) {
        templateConfig.dataFile = args[i + 2];
        i += 2;
      }
      
      config.templates.push(templateConfig);
    } else if (arg === '--parser' && i + 1 < args.length) {
      const parserName = args[++i];
      const parserConfig = { name: parserName };
      
      // Check for --payload option
      if (i + 1 < args.length && args[i + 1] === '--payload' && i + 2 < args.length) {
        parserConfig.payloadFile = args[i + 2];
        i += 2;
      }
      
      config.parsers.push(parserConfig);
    }
  }

  return config;
}

/**
 * Load configuration from file
 */
function loadConfig(configFile) {
  const config = loadJsonFile(configFile);
  if (!config) {
    return null;
  }

  return {
    magicCode: config.magicCode,
    templates: config.templates || [],
    parsers: config.parsers || [],
    baseUrl: config.baseUrl || BASE_URL
  };
}

/**
 * Main test function
 */
async function runTests() {
  let config = parseArgs();
  
  if (!config) {
    console.log(`
Usage: 
  node scripts/test-templates-transformers-advanced.js <magicCode> [options]

Options:
  --config <file>              Load configuration from JSON file
  --template <name> [--data <file>]   Test a template (optionally with custom data file)
  --parser <name> [--payload <file>]  Test a parser (optionally with custom payload file)

Examples:
  # Test a template with default data
  node scripts/test-templates-transformers-advanced.js abc12345 --template my-template

  # Test a template with custom data
  node scripts/test-templates-transformers-advanced.js abc12345 --template my-template --data ./test-data.json

  # Test a parser with custom payload
  node scripts/test-templates-transformers-advanced.js abc12345 --parser authentic --payload ./authentik-payload.json

  # Test multiple templates and parsers
  node scripts/test-templates-transformers-advanced.js abc12345 \\
    --template my-template --data ./data1.json \\
    --template another-template \\
    --parser authentic --payload ./auth.json \\
    --parser github

  # Use configuration file
  node scripts/test-templates-transformers-advanced.js abc12345 --config ./test-config.json

Configuration file format (JSON):
{
  "magicCode": "abc12345",
  "baseUrl": "http://localhost:3000/api/v1",
  "templates": [
    {
      "name": "my-template",
      "data": { "name": "Test", "value": 42 }
    },
    {
      "name": "another-template",
      "dataFile": "./test-data.json"
    }
  ],
  "parsers": [
    {
      "name": "authentik",
      "payload": { "body": "loginSuccess: {...}" }
    },
    {
      "name": "github",
      "payloadFile": "./github-payload.json"
    }
  ]
}

Environment variables:
  BASE_URL - API base URL (default: http://localhost:3000/api/v1)
`);
    process.exit(1);
  }

  // Load config from file if specified
  if (config.configFile) {
    const fileConfig = loadConfig(config.configFile);
    if (fileConfig) {
      config = { ...fileConfig, ...config };
      if (fileConfig.baseUrl) {
        BASE_URL = fileConfig.baseUrl;
      }
    } else {
      console.error('❌ Failed to load configuration file');
      process.exit(1);
    }
  }

  console.log(`\n🚀 Starting advanced template and transformer tests`);
  console.log(`   Magic Code: ${config.magicCode}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Templates: ${config.templates.length}`);
  console.log(`   Parsers: ${config.parsers.length}\n`);

  // Test templates
  if (config.templates.length > 0) {
    console.log('='.repeat(60));
    console.log('TESTING TEMPLATES');
    console.log('='.repeat(60));
    
    for (const templateConfig of config.templates) {
      let templateData = templateConfig.data || null;
      
      // Load data from file if specified
      if (templateConfig.dataFile) {
        templateData = loadJsonFile(templateConfig.dataFile);
        if (!templateData) {
          console.log(`  ⚠️  Skipping template ${templateConfig.name} - failed to load data file`);
          continue;
        }
      }
      
      await testTemplate(config.magicCode, templateConfig.name, templateData);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Test parsers/transformers
  if (config.parsers.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('TESTING TRANSFORMERS/PARSERS');
    console.log('='.repeat(60));
    
    for (const parserConfig of config.parsers) {
      let payload = parserConfig.payload || null;
      
      // Load payload from file if specified
      if (parserConfig.payloadFile) {
        payload = loadJsonFile(parserConfig.payloadFile);
        if (!payload) {
          console.log(`  ⚠️  Skipping parser ${parserConfig.name} - failed to load payload file`);
          continue;
        }
      }
      
      await testTransformer(config.magicCode, parserConfig.name, payload);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  if (config.templates.length > 0) {
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

  if (config.parsers.length > 0) {
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
  
  if (totalFailure > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
