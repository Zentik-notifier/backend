/**
 * Script to test all message creation combinations with:
 * - token + bucketId (authenticated)
 * - magicCode (unauthenticated)
 * 
 * Tests extend to buckets with access and without access.
 * Fetches buckets and related permissions and chooses appropriate buckets for testing.
 * 
 * Usage: node scripts/test-magic-code-and-token.js
 */

const TOKEN = 'zat_44d2bfc7ce01f01ea93e9dae622b8c24d3c45fde4e0b234b997c8f28f89b24de';
const BASE_URL = 'http://localhost:3000/api/v1';

// Test results tracking
const results = {
  success: [],
  failure: [],
  skipped: []
};

/**
 * Make an HTTP request with better error handling
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
 * Fetch all buckets for the user with permissions
 */
async function fetchBuckets() {
  try {
    console.log('📦 Fetching buckets with permissions...');
    const response = await fetch(`${BASE_URL}/buckets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    if (response.statusCode >= 400) {
      console.error(`❌ Error fetching buckets: ${response.statusCode} ${response.statusMessage}`);
      const text = response.data;
      console.error('Response:', text);
      return [];
    }

    const buckets = JSON.parse(response.data);
    console.log(`✅ Found ${buckets.length} buckets`);
    return buckets || [];
  } catch (error) {
    console.error('❌ Failed to fetch buckets:', error.message);
    return [];
  }
}

/**
 * Fetch UserBucket for a specific bucket to get magicCode
 */
async function fetchUserBucket(bucketId) {
  try {
    // Query GraphQL for bucket with userBucket relation
    const query = `
      query GetBucket($id: String!) {
        bucket(id: $id) {
          id
          name
          userBucket {
            magicCode
            userId
          }
          userPermissions {
            canWrite
            canRead
            canAdmin
            canDelete
            isOwner
            isSharedWithMe
          }
        }
      }
    `;

    const response = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        query,
        variables: { id: bucketId }
      })
    });

    if (response.statusCode >= 400) {
      console.error(`❌ Error fetching bucket ${bucketId}: ${response.statusCode}`);
      return null;
    }

    const result = JSON.parse(response.data);
    if (result.errors) {
      console.error(`❌ GraphQL errors for bucket ${bucketId}:`, result.errors);
      return null;
    }

    return result.data.bucket;
  } catch (error) {
    console.error(`❌ Failed to fetch user bucket for ${bucketId}:`, error.message);
    return null;
  }
}

/**
 * Create a message using token authentication
 */
async function createMessageWithToken(bucketId, bucketName) {
  const testTitle = `Token Test: ${bucketName}`;
  const testBody = `Test message created with token authentication at ${new Date().toISOString()}`;

  try {
    console.log(`  🔑 Testing token + bucketId for bucket: ${bucketName}`);
    
    const response = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        bucketId,
        title: testTitle,
        body: testBody
      })
    });

    const responseData = response.data ? JSON.parse(response.data) : null;
    const createdMessage = responseData?.message ?? responseData;

    if (response.statusCode < 400) {
      console.log(`    ✅ SUCCESS: Message created with ID: ${createdMessage?.id}`);
      return { success: true, messageId: createdMessage?.id, bucketId, bucketName, method: 'token' };
    } else {
      console.log(`    ❌ FAILED: ${response.statusCode} - ${responseData?.message || response.statusMessage}`);
      return { success: false, error: responseData?.message || response.statusMessage, bucketId, bucketName, method: 'token' };
    }
  } catch (error) {
    console.log(`    ❌ FAILED: Exception - ${error.message}`);
    return { success: false, error: error.message, bucketId, bucketName, method: 'token' };
  }
}

/**
 * Create a message using magic code authentication
 */
async function createMessageWithMagicCode(bucketId, bucketName, magicCode) {
  const testTitle = `MagicCode Test: ${bucketName}`;
  const testBody = `Test message created with magic code authentication at ${new Date().toISOString()}`;

  try {
    console.log(`  ✨ Testing magicCode for bucket: ${bucketName} (code: ${magicCode})`);
    
    // With magic code, we don't use Authorization header
    // Instead, we use the magic code parameter
    const response = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        magicCode: magicCode,
        title: testTitle,
        body: testBody
      })
    });

    const responseData = response.data ? JSON.parse(response.data) : null;
    const createdMessage = responseData?.message ?? responseData;

    if (response.statusCode < 400) {
      console.log(`    ✅ SUCCESS: Message created with ID: ${createdMessage?.id}`);
      return { success: true, messageId: createdMessage?.id, bucketId, bucketName, method: 'magicCode', magicCode };
    } else {
      console.log(`    ❌ FAILED: ${response.statusCode} - ${responseData?.message || response.statusMessage}`);
      return { success: false, error: responseData?.message || response.statusMessage, bucketId, bucketName, method: 'magicCode', magicCode };
    }
  } catch (error) {
    console.log(`    ❌ FAILED: Exception - ${error.message}`);
    return { success: false, error: error.message, bucketId, bucketName, method: 'magicCode', magicCode };
  }
}

/**
 * Test messages for all buckets
 */
async function testAllBuckets() {
  console.log('\n🚀 Starting magic code and token authentication tests\n');
  
  const buckets = await fetchBuckets();
  
  if (buckets.length === 0) {
    console.log('❌ No buckets found. Exiting.');
    return;
  }

  // Fetch detailed info for all buckets including magic codes
  const bucketDetails = [];
  for (const bucket of buckets) {
    const details = await fetchUserBucket(bucket.id);
    if (details) {
      bucketDetails.push(details);
    }
  }

  console.log(`\n📊 Found ${bucketDetails.length} buckets with details\n`);

  // Categorize buckets
  const ownedBuckets = bucketDetails.filter(b => b.userPermissions.isOwner);
  const sharedBuckets = bucketDetails.filter(b => b.userPermissions.isSharedWithMe && !b.userPermissions.isOwner);
  
  console.log(`📂 Owned buckets: ${ownedBuckets.length}`);
  console.log(`🔗 Shared buckets: ${sharedBuckets.length}`);

  // Test owned buckets
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TESTING OWNED BUCKETS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const bucket of ownedBuckets) {
    console.log(`\n📦 Testing bucket: ${bucket.name} (${bucket.id})`);
    console.log(`   Permissions: ${bucket.userPermissions.isOwner ? '✅ Owner' : ''}`);
    
    // Test with token
    const tokenResult = await createMessageWithToken(bucket.id, bucket.name);
    if (tokenResult.success) {
      results.success.push(tokenResult);
    } else {
      results.failure.push(tokenResult);
    }

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test with magic code if available
    if (bucket.userBucket && bucket.userBucket.magicCode) {
      const magicCodeResult = await createMessageWithMagicCode(
        bucket.id,
        bucket.name,
        bucket.userBucket.magicCode
      );
      if (magicCodeResult.success) {
        results.success.push(magicCodeResult);
      } else {
        results.failure.push(magicCodeResult);
      }
    } else {
      console.log('    ⚠️  No magic code available for this bucket');
      results.skipped.push({ bucketId: bucket.id, bucketName: bucket.name, reason: 'No magic code' });
    }
  }

  // Test shared buckets
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TESTING SHARED BUCKETS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const bucket of sharedBuckets) {
    console.log(`\n📦 Testing bucket: ${bucket.name} (${bucket.id})`);
    console.log(`   Permissions: ${bucket.userPermissions.canWrite ? '✅ Write' : '❌ No Write'}`);
    
    // Test with token only if user has write permission
    if (bucket.userPermissions.canWrite) {
      const tokenResult = await createMessageWithToken(bucket.id, bucket.name);
      if (tokenResult.success) {
        results.success.push(tokenResult);
      } else {
        results.failure.push(tokenResult);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Test with magic code if available
      if (bucket.userBucket && bucket.userBucket.magicCode) {
        const magicCodeResult = await createMessageWithMagicCode(
          bucket.id,
          bucket.name,
          bucket.userBucket.magicCode
        );
        if (magicCodeResult.success) {
          results.success.push(magicCodeResult);
        } else {
          results.failure.push(magicCodeResult);
        }
      } else {
        console.log('    ⚠️  No magic code available for this bucket');
        results.skipped.push({ bucketId: bucket.id, bucketName: bucket.name, reason: 'No magic code' });
      }
    } else {
      console.log('    ⚠️  Skipping: No write permission');
      results.skipped.push({ bucketId: bucket.id, bucketName: bucket.name, reason: 'No write permission' });
    }
  }

  // Print summary
  printSummary();
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`✅ Successful tests: ${results.success.length}`);
  results.success.forEach(r => {
    console.log(`   - ${r.method} for ${r.bucketName} (${r.messageId})`);
  });

  console.log(`\n❌ Failed tests: ${results.failure.length}`);
  results.failure.forEach(r => {
    console.log(`   - ${r.method} for ${r.bucketName}: ${r.error}`);
  });

  console.log(`\n⚠️  Skipped tests: ${results.skipped.length}`);
  results.skipped.forEach(r => {
    console.log(`   - ${r.bucketName}: ${r.reason}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total: ${results.success.length + results.failure.length + results.skipped.length} tests`);
  console.log(`Success rate: ${results.success.length}/${results.success.length + results.failure.length} (${results.failure.length === 0 ? 100 : Math.round(results.success.length / (results.success.length + results.failure.length) * 100)}%)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the tests
testAllBuckets().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

