/**
 * Script to get the magicCode of a bucket
 * Usage: node get-magic-code.js <token> <bucketId>
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

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

async function getMagicCode(token, bucketId) {
  try {
    // Query GraphQL per ottenere il bucket con userBucket
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
      console.error(`❌ Error: ${response.statusCode} ${response.statusMessage}`, errorText);
      return null;
    }

    const result = JSON.parse(response.data);
    
    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);
      return null;
    }

    const magicCode = result.data?.bucket?.userBucket?.magicCode;
    if (magicCode) {
      console.log(`✅ Magic Code: ${magicCode}`);
      return magicCode;
    } else {
      console.log('⚠️  No magic code found for this bucket');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node get-magic-code.js <token> <bucketId>');
  process.exit(1);
}

const token = args[0];
const bucketId = args[1];

getMagicCode(token, bucketId).then(magicCode => {
  if (magicCode) {
    console.log(`\nUse this magic code in your tests:\n${magicCode}\n`);
  } else {
    process.exit(1);
  }
});
