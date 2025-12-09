/**
 * Script to create an access token using the admin account defined in env
 * Usage: node scripts/notifications/create-admin-token.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

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
        res.text = async () => data;
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
 * Login with admin credentials
 */
async function login(identifier, password) {
  try {
    console.log(`\n🔐 Logging in as admin: ${identifier}...`);
    
    // Try login with username first
    let response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: identifier,
        password: password
      })
    });

    // If fails, try with email
    if (response.statusCode >= 400) {
      const isEmail = identifier.includes('@');
      if (isEmail) {
        response = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: identifier,
            password: password
          })
        });
      }
    }

    if (response.statusCode >= 400) {
      const errorText = response.data || response.statusMessage;
      console.error(`❌ Login failed: ${response.statusCode} ${response.statusMessage}`, errorText);
      return null;
    }

    const result = JSON.parse(response.data);
    console.log(`✅ Login successful!`);
    return result.accessToken;
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return null;
  }
}

/**
 * Create access token
 */
async function createAccessToken(jwtToken, tokenName = 'Script Test Token') {
  try {
    console.log(`\n🔑 Creating access token: ${tokenName}...`);
    
    const response = await fetch(`${BASE_URL}/access-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        name: tokenName,
        storeToken: true,
        scopes: [] // Empty scopes = full access
      })
    });

    if (response.statusCode >= 400) {
      const errorText = response.data || response.statusMessage;
      console.error(`❌ Failed to create access token: ${response.statusCode} ${response.statusMessage}`, errorText);
      return null;
    }

    const result = JSON.parse(response.data);
    console.log(`✅ Access token created successfully!`);
    console.log(`   Token: ${result.token}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Name: ${result.name}`);
    
    return result.token;
  } catch (error) {
    console.error('❌ Error creating access token:', error.message);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Creating admin access token...\n');
  console.log('━'.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Admin Users: ${ADMIN_USERS}`);
  console.log('━'.repeat(60));

  // Get first admin user
  const adminIdentifiers = ADMIN_USERS.split(',').map(id => id.trim());
  const adminIdentifier = adminIdentifiers[0];

  if (!adminIdentifier) {
    console.error('❌ No admin user found in ADMIN_USERS environment variable');
    process.exit(1);
  }

  if (!ADMIN_PASSWORD) {
    console.error('❌ ADMIN_DEFAULT_PASSWORD environment variable is not set');
    process.exit(1);
  }

  // Step 1: Login
  const jwtToken = await login(adminIdentifier, ADMIN_PASSWORD);
  if (!jwtToken) {
    console.error('\n❌ Failed to login. Please check ADMIN_USERS and ADMIN_DEFAULT_PASSWORD.');
    process.exit(1);
  }

  // Step 2: Create access token
  const accessToken = await createAccessToken(jwtToken);
  if (!accessToken) {
    console.error('\n❌ Failed to create access token.');
    process.exit(1);
  }

  // Output the token
  console.log('\n━'.repeat(60));
  console.log('✨ SUCCESS!');
  console.log('━'.repeat(60));
  console.log(`\nAccess Token:\n${accessToken}\n`);
  console.log('You can use this token in your scripts by setting:');
  console.log(`const TOKEN = '${accessToken}';`);
  console.log('\n━'.repeat(60));
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
