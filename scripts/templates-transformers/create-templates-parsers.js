/**
 * Script per creare template e parsers
 * 
 * Usage: 
 *   node scripts/create-templates-parsers.js <token> --template <templateFile>
 *   node scripts/create-templates-parsers.js <token> --parser <parserFile>
 *   node scripts/create-templates-parsers.js <token> --config <configFile>
 * 
 * Esempi:
 *   node scripts/create-templates-parsers.js <token> --template ./examples/template-example.json
 *   node scripts/create-templates-parsers.js <token> --parser ./examples/parser-example.json
 *   node scripts/create-templates-parsers.js <token> --config ./examples/create-config.json
 */

const fs = require('fs');
const path = require('path');

let BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

// Results tracking
const results = {
  templates: { created: [], failed: [] },
  parsers: { created: [], failed: [] }
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
 * Create a template
 */
async function createTemplate(token, templateData) {
  try {
    console.log(`\n📝 Creating template: ${templateData.name}`);
    
    const url = `${BASE_URL}/user-templates`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(templateData)
    });

    const responseData = response.data ? JSON.parse(response.data) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`  ✅ SUCCESS: Template created with ID: ${responseData?.id}`);
      console.log(`     Name: ${responseData?.name}`);
      results.templates.created.push({
        name: templateData.name,
        id: responseData?.id,
        response: responseData
      });
      return { success: true, id: responseData?.id, template: templateData.name, response: responseData };
    } else {
      console.log(`  ❌ FAILED: ${response.statusCode} - ${responseData?.message || response.statusMessage}`);
      results.templates.failed.push({
        name: templateData.name,
        error: responseData?.message || response.statusMessage,
        status: response.statusCode
      });
      return { success: false, error: responseData?.message || response.statusMessage, template: templateData.name };
    }
  } catch (error) {
    console.log(`  ❌ FAILED: Exception - ${error.message}`);
    results.templates.failed.push({
      name: templateData.name,
      error: error.message
    });
    return { success: false, error: error.message, template: templateData.name };
  }
}

/**
 * Create a parser/payload mapper
 */
async function createParser(token, parserData) {
  try {
    console.log(`\n🔄 Creating parser: ${parserData.name}`);
    
    const url = `${BASE_URL}/payload-mappers`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(parserData)
    });

    const responseData = response.data ? JSON.parse(response.data) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`  ✅ SUCCESS: Parser created with ID: ${responseData?.id}`);
      console.log(`     Name: ${responseData?.name}`);
      results.parsers.created.push({
        name: parserData.name,
        id: responseData?.id,
        response: responseData
      });
      return { success: true, id: responseData?.id, parser: parserData.name, response: responseData };
    } else {
      console.log(`  ❌ FAILED: ${response.statusCode} - ${responseData?.message || response.statusMessage}`);
      results.parsers.failed.push({
        name: parserData.name,
        error: responseData?.message || response.statusMessage,
        status: response.statusCode
      });
      return { success: false, error: responseData?.message || response.statusMessage, parser: parserData.name };
    }
  } catch (error) {
    console.log(`  ❌ FAILED: Exception - ${error.message}`);
    results.parsers.failed.push({
      name: parserData.name,
      error: error.message
    });
    return { success: false, error: error.message, parser: parserData.name };
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

  // Use first arg as token, or default token if --use-default is specified
  const token = args[0] === '--use-default' ? DEFAULT_TOKEN : (args[0] || DEFAULT_TOKEN);
  const config = {
    token,
    templates: [],
    parsers: [],
    configFile: null
  };

  // Skip first arg if it's not --use-default (it's the token)
  const startIndex = args[0] === '--use-default' ? 1 : 1;
  
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--config' && i + 1 < args.length) {
      config.configFile = args[++i];
    } else if (arg === '--template' && i + 1 < args.length) {
      config.templates.push({ file: args[++i] });
    } else if (arg === '--parser' && i + 1 < args.length) {
      config.parsers.push({ file: args[++i] });
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
    token: config.token,
    templates: config.templates || [],
    parsers: config.parsers || [],
    baseUrl: config.baseUrl || BASE_URL
  };
}

/**
 * Main function
 */
async function run() {
  let config = parseArgs();
  
  if (!config) {
    console.log(`
Usage: 
  node templates-transformers/create-templates-parsers.js [token] [options]
  node templates-transformers/create-templates-parsers.js --use-default [options]

Options:
  --config <file>              Load configuration from JSON file
  --template <file>             Create template from JSON file
  --parser <file>               Create parser from JSON file

Examples:
  # Create a template (using default token)
  node templates-transformers/create-templates-parsers.js --use-default --template examples/template-example.json

  # Create a template (with custom token)
  node templates-transformers/create-templates-parsers.js <token> --template examples/template-example.json

  # Create a parser
  node templates-transformers/create-templates-parsers.js --use-default --parser examples/parser-example.json

  # Create multiple templates and parsers
  node templates-transformers/create-templates-parsers.js --use-default \\
    --template examples/template-example.json \\
    --template examples/template-example2.json \\
    --parser examples/parser-example.json

  # Use configuration file
  node templates-transformers/create-templates-parsers.js --use-default --config examples/create-config.json

Template file format (JSON):
{
  "name": "my-template",
  "description": "Template description (optional)",
  "title": "Hello {{name}}!",
  "subtitle": "Status: {{status}}",
  "body": "Message: {{message}}"
}

Parser file format (JSON):
{
  "name": "my-parser",
  "jsEvalFn": "function transform(payload, bucketId, userId, headers) { return { title: 'Test', body: JSON.stringify(payload) }; }",
  "requiredUserSettings": []
}

Configuration file format (JSON):
{
  "token": "YOUR_TOKEN_HERE",
  "baseUrl": "http://localhost:3000/api/v1",
  "templates": [
    {
      "name": "my-template",
      "description": "Template description",
      "title": "Hello {{name}}!",
      "subtitle": "Status: {{status}}",
      "body": "Message: {{message}}"
    }
  ],
  "parsers": [
    {
      "name": "my-parser",
      "jsEvalFn": "function transform(payload, bucketId, userId, headers) { return { title: 'Test', body: JSON.stringify(payload) }; }",
      "requiredUserSettings": []
    }
  ]
}

Environment variables:
  BASE_URL - API base URL (default: http://localhost:3000/api/v1)
  TOKEN - Default token to use when --use-default is specified
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

  console.log(`\n🚀 Creating templates and parsers`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Templates to create: ${config.templates.length}`);
  console.log(`   Parsers to create: ${config.parsers.length}\n`);

  // Create templates
  if (config.templates.length > 0) {
    console.log('='.repeat(60));
    console.log('CREATING TEMPLATES');
    console.log('='.repeat(60));
    
    for (const templateConfig of config.templates) {
      let templateData = null;
      
      // Load from file if specified
      if (templateConfig.file) {
        templateData = loadJsonFile(templateConfig.file);
        if (!templateData) {
          console.log(`  ⚠️  Skipping template - failed to load file`);
          continue;
        }
      } else {
        // Use inline data
        templateData = templateConfig;
      }
      
      await createTemplate(config.token, templateData);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Create parsers
  if (config.parsers.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('CREATING PARSERS');
    console.log('='.repeat(60));
    
    for (const parserConfig of config.parsers) {
      let parserData = null;
      
      // Load from file if specified
      if (parserConfig.file) {
        parserData = loadJsonFile(parserConfig.file);
        if (!parserData) {
          console.log(`  ⚠️  Skipping parser - failed to load file`);
          continue;
        }
      } else {
        // Use inline data
        parserData = parserConfig;
      }
      
      await createParser(config.token, parserData);
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
    console.log(`   ✅ Created: ${results.templates.created.length}`);
    console.log(`   ❌ Failed: ${results.templates.failed.length}`);
    
    if (results.templates.created.length > 0) {
      console.log(`\n   Created templates:`);
      results.templates.created.forEach(r => {
        console.log(`     - ${r.name} (ID: ${r.id})`);
      });
    }
    
    if (results.templates.failed.length > 0) {
      console.log(`\n   Failed templates:`);
      results.templates.failed.forEach(r => {
        console.log(`     - ${r.name}: ${r.error} (Status: ${r.status || 'N/A'})`);
      });
    }
  }

  if (config.parsers.length > 0) {
    console.log(`\n🔄 Parsers:`);
    console.log(`   ✅ Created: ${results.parsers.created.length}`);
    console.log(`   ❌ Failed: ${results.parsers.failed.length}`);
    
    if (results.parsers.created.length > 0) {
      console.log(`\n   Created parsers:`);
      results.parsers.created.forEach(r => {
        console.log(`     - ${r.name} (ID: ${r.id})`);
      });
    }
    
    if (results.parsers.failed.length > 0) {
      console.log(`\n   Failed parsers:`);
      results.parsers.failed.forEach(r => {
        console.log(`     - ${r.name}: ${r.error} (Status: ${r.status || 'N/A'})`);
      });
    }
  }

  const totalCreated = results.templates.created.length + results.parsers.created.length;
  const totalFailed = results.templates.failed.length + results.parsers.failed.length;
  
  console.log(`\n📊 Total:`);
  console.log(`   ✅ Created: ${totalCreated}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  
  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run
run().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
