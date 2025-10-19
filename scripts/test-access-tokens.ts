#!/usr/bin/env ts-node
/**
 * Test script for Access Token scope validation
 * 
 * This script tests the access token authentication and scope validation
 * by attempting to create messages in different buckets with different tokens.
 * 
 * Usage:
 *   ts-node scripts/test-access-tokens.ts
 * 
 * Or add to package.json:
 *   "test:tokens": "ts-node scripts/test-access-tokens.ts"
 */

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE_URL}/api/v1/messages`;

// Test tokens
const SCOPED_TOKEN = 'zat_a152f4979a5286a14edfc06c026416fb3eb6f64320de4f3e4c7984a553cb742f'; // Scoped to a1f61182-afd4-4cd2-9077-ac0b42b64bce
const ADMIN_TOKEN = 'zat_9381e2ac59bb0af2d58e133a4a55e7a2f65310a480a9a56ad2187fc1bf801f48';  // Full access

// Test buckets
const ALLOWED_BUCKET = 'a1f61182-afd4-4cd2-9077-ac0b42b64bce'; // Allowed for scoped token
const FORBIDDEN_BUCKET_1 = '20e4f7bd-f635-4a80-a841-6fcdd3f5ed27'; // Not allowed for scoped token
const FORBIDDEN_BUCKET_2 = '031347a0-5a32-4ebb-a230-2554ded44573'; // Not allowed for scoped token

interface TestResult {
  test: string;
  token: string;
  bucket: string;
  success: boolean;
  status?: number;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Create a test message in a bucket using an access token
 */
async function createMessage(
  token: string,
  bucketId: string,
  testName: string
): Promise<TestResult> {
  console.log(`\n🧪 Test: ${testName}`);
  console.log(`   Token: ${token.substring(0, 20)}...`);
  console.log(`   Bucket: ${bucketId}`);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucketId,
        title: `Test Message - ${testName}`,
        body: `This is a test message created by the token test script at ${new Date().toISOString()}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || response.statusText;
      const result: TestResult = {
        test: testName,
        token: token.substring(0, 20) + '...',
        bucket: bucketId,
        success: false,
        status: response.status,
        error: `❌ FAILED - Status ${response.status}: ${errorMessage}`,
      };

      console.log(`   ${result.error}`);
      return result;
    }

    const result: TestResult = {
      test: testName,
      token: token.substring(0, 20) + '...',
      bucket: bucketId,
      success: true,
      status: response.status,
      message: `✅ SUCCESS - Message created: ${data.id}`,
    };

    console.log(`   ${result.message}`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const result: TestResult = {
      test: testName,
      token: token.substring(0, 20) + '...',
      bucket: bucketId,
      success: false,
      error: `❌ FAILED - ${errorMessage}`,
    };

    console.log(`   ${result.error}`);
    return result;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('🔐 ACCESS TOKEN SCOPE VALIDATION TEST');
  console.log('='.repeat(80));
  console.log(`\nAPI Endpoint: ${API_ENDPOINT}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Test 1: Scoped token with ALLOWED bucket (should succeed)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST GROUP 1: SCOPED TOKEN (should only access allowed bucket)');
  console.log('-'.repeat(80));
  
  results.push(
    await createMessage(
      SCOPED_TOKEN,
      ALLOWED_BUCKET,
      'Scoped Token → Allowed Bucket'
    )
  );

  // Test 2: Scoped token with FORBIDDEN bucket 1 (should fail)
  results.push(
    await createMessage(
      SCOPED_TOKEN,
      FORBIDDEN_BUCKET_1,
      'Scoped Token → Forbidden Bucket 1'
    )
  );

  // Test 3: Scoped token with FORBIDDEN bucket 2 (should fail)
  results.push(
    await createMessage(
      SCOPED_TOKEN,
      FORBIDDEN_BUCKET_2,
      'Scoped Token → Forbidden Bucket 2'
    )
  );

  // Test 4: Admin token with ALLOWED bucket (should succeed)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST GROUP 2: ADMIN TOKEN (should access all buckets)');
  console.log('-'.repeat(80));

  results.push(
    await createMessage(
      ADMIN_TOKEN,
      ALLOWED_BUCKET,
      'Admin Token → Allowed Bucket'
    )
  );

  // Test 5: Admin token with FORBIDDEN bucket 1 (should succeed)
  results.push(
    await createMessage(
      ADMIN_TOKEN,
      FORBIDDEN_BUCKET_1,
      'Admin Token → Forbidden Bucket 1'
    )
  );

  // Test 6: Admin token with FORBIDDEN bucket 2 (should succeed)
  results.push(
    await createMessage(
      ADMIN_TOKEN,
      FORBIDDEN_BUCKET_2,
      'Admin Token → Forbidden Bucket 2'
    )
  );

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const passedTests = results.filter((r) => r.success).length;
  const failedTests = results.filter((r) => !r.success).length;
  const totalTests = results.length;

  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);

  console.log('\n' + '-'.repeat(80));
  console.log('DETAILED RESULTS:');
  console.log('-'.repeat(80));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.test}`);
    console.log(`   Token: ${result.token}`);
    console.log(`   Bucket: ${result.bucket}`);
    console.log(`   Result: ${result.success ? result.message : result.error}`);
  });

  // Expected behavior validation
  console.log('\n' + '='.repeat(80));
  console.log('🎯 EXPECTED BEHAVIOR VALIDATION');
  console.log('='.repeat(80));

  const expectedResults = [
    { index: 0, shouldPass: true, reason: 'Scoped token accessing allowed bucket' },
    { index: 1, shouldPass: false, reason: 'Scoped token accessing forbidden bucket' },
    { index: 2, shouldPass: false, reason: 'Scoped token accessing forbidden bucket' },
    { index: 3, shouldPass: true, reason: 'Admin token accessing any bucket' },
    { index: 4, shouldPass: true, reason: 'Admin token accessing any bucket' },
    { index: 5, shouldPass: true, reason: 'Admin token accessing any bucket' },
  ];

  let allExpectedBehavior = true;

  expectedResults.forEach((expected) => {
    const result = results[expected.index];
    const isCorrect = result.success === expected.shouldPass;
    const icon = isCorrect ? '✅' : '❌';
    
    console.log(`\n${icon} Test ${expected.index + 1}: ${expected.reason}`);
    console.log(`   Expected: ${expected.shouldPass ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`   Actual: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
    
    if (!isCorrect) {
      console.log(`   ⚠️  UNEXPECTED BEHAVIOR!`);
      allExpectedBehavior = false;
    }
  });

  // Final verdict
  console.log('\n' + '='.repeat(80));
  if (allExpectedBehavior) {
    console.log('🎉 ALL TESTS BEHAVED AS EXPECTED!');
    console.log('✅ Access token scope validation is working correctly.');
  } else {
    console.log('⚠️  SOME TESTS DID NOT BEHAVE AS EXPECTED!');
    console.log('❌ Please review the access token scope validation logic.');
  }
  console.log('='.repeat(80));

  // Exit with appropriate code
  process.exit(allExpectedBehavior ? 0 : 1);
}

// Run the tests
runTests().catch((error) => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});

