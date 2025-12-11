#!/usr/bin/env node

/**
 * Rate limit E2E tests for the /messages endpoint.
 *
 * Goal:
 * - Verify that, beyond a certain number of requests within the window,
 *   the rate-limit guard responds with 429 Too Many Requests.
 *
 * Uses:
 * - BASE_URL (e.g. http://localhost:3000/api/v1)
 * - TOKEN (access token zat_...)
 * - BUCKET_ID (valid bucket where to create messages)
 * - RATE_LIMIT_LIMIT (optional, to know roughly when to expect 429)
 */

const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;
// If defined in env we use it to have more precise expectations
const RATE_LIMIT_LIMIT = Number(process.env.RATE_LIMIT_LIMIT || '0');

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required');
    process.exit(1);
}

if (!BUCKET_ID) {
    console.error('❌ BUCKET_ID environment variable is required');
    process.exit(1);
}

async function runRateLimitTests() {
    console.log(`\n🧪 Testing Messages Rate Limit (${BASE_URL}/messages)...`);

    const agent = request(BASE_URL);

    const approxLimit = RATE_LIMIT_LIMIT > 0 ? RATE_LIMIT_LIMIT : 0;
    const maxRequests = RATE_LIMIT_LIMIT > 0 ? RATE_LIMIT_LIMIT + 20 : 200; // maximum number of attempts

    if (approxLimit > 0) {
        console.log(`   Expected limit (from env): ~${approxLimit} requests/window`);
    } else {
        console.log(`   Expected limit: unknown (using generic upper bound of ${maxRequests} requests)`);
    }

    let successCount = 0;
    let rateLimitedCount = 0;
    let retryAfterMs = null;

    // Phase 1: push requests until we see a 429 (or exhaust maxRequests)
    for (let i = 1; i <= maxRequests; i++) {
        console.log(`\n➡️  Request #${i}`);

        try {
            const res = await agent
                .post('/messages')
                .set('Authorization', `Bearer ${TOKEN}`)
                .send({
                    title: `Rate limit test #${i}`,
                    body: 'This is a rate limit test message',
                    bucketId: BUCKET_ID,
                    deliveryType: 'NORMAL',
                });

            if (res.status === 201) {
                console.log('   ✅ 201 Created');
                successCount++;
            } else if (res.status === 429) {
                console.log('   🚫 429 Too Many Requests (rate limited)');
                rateLimitedCount++;
                const headers = res.headers || {};

                const retryAfter = headers['retry-after'];
                if (!retryAfter) {
                    console.error('   ❌ Expected Retry-After header on 429 response');
                    process.exit(1);
                } else {
                    console.log(`   ⏱  Retry-After: ${retryAfter}`);
                    const retrySeconds = Number(retryAfter);
                    if (!Number.isNaN(retrySeconds) && retrySeconds > 0) {
                        retryAfterMs = retrySeconds * 1000;
                    } else {
                        // Conservative fallback: if it's not a number, wait for known TTL or 10s
                        retryAfterMs = RATE_LIMIT_TTL_MS_GUESS();
                    }
                }

                const rlLimit = headers['x-ratelimit-limit'];
                const rlRemaining = headers['x-ratelimit-remaining'];
                const rlReset = headers['x-ratelimit-reset'];

                if (rlLimit !== undefined) {
                    console.log(`   📈 X-RateLimit-Limit: ${rlLimit}`);
                }
                if (rlRemaining !== undefined) {
                    console.log(`   📉 X-RateLimit-Remaining: ${rlRemaining}`);
                }
                if (rlReset !== undefined) {
                    console.log(`   🔄 X-RateLimit-Reset: ${rlReset}`);
                }
                // Once the rate limit is triggered, exit the loop
                break;
            } else {
                console.error(`   ❌ Unexpected status: ${res.status}`);
                console.error('      Body:', JSON.stringify(res.body, null, 2));
                process.exit(1);
            }
        } catch (err) {
            console.error('   ❌ Request failed:', err.message);
            process.exit(1);
        }
    }

    console.log(`\n📊 Phase 1 summary:`);
    console.log(`   Successful (201): ${successCount}`);
    console.log(`   Rate limited (429): ${rateLimitedCount}`);

    if (rateLimitedCount === 0) {
        console.error('\n❌ Rate limit did not trigger within the expected number of requests.');
        process.exit(1);
    }

    // Phase 2: wait for the window and verify that requests go back to 201
    const waitMs = retryAfterMs != null ? retryAfterMs + 1000 : RATE_LIMIT_TTL_MS_GUESS();
    console.log(`\n⏲  Waiting ${waitMs}ms to allow rate limit window to reset...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    console.log('\n🧪 Phase 2: verifying requests succeed again after window reset...');

    const postWindowAttempts = 5;
    let postWindowSuccess = 0;
    for (let j = 1; j <= postWindowAttempts; j++) {
        console.log(`   ➡️  Post-window request #${j}`);
        const res = await agent
            .post('/messages')
            .set('Authorization', `Bearer ${TOKEN}`)
            .send({
                title: `Rate limit post-window test #${j}`,
                body: 'This is a post-window rate limit test message',
                bucketId: BUCKET_ID,
                deliveryType: 'NORMAL',
            });

        if (res.status === 201) {
            console.log('      ✅ 201 Created');
            postWindowSuccess++;
        } else if (res.status === 429) {
            console.error('      ❌ Still rate limited (429) after waiting for window to reset');
            console.error('         Body:', JSON.stringify(res.body, null, 2));
            process.exit(1);
        } else {
            console.error(`      ❌ Unexpected status after window reset: ${res.status}`);
            console.error('         Body:', JSON.stringify(res.body, null, 2));
            process.exit(1);
        }
    }

    console.log(`\n📊 Phase 2 summary:`);
    console.log(`   Successful (201) after window reset: ${postWindowSuccess}/${postWindowAttempts}`);

    if (postWindowSuccess !== postWindowAttempts) {
        console.error('\n❌ Not all requests succeeded after waiting for rate limit window to reset.');
        process.exit(1);
    }

    console.log('\n✅ Messages rate limit behaviour verified: 429 received and window respected.');
}

// Conservative estimate of the TTL window when we cannot parse Retry-After
function RATE_LIMIT_TTL_MS_GUESS() {
    if (RATE_LIMIT_LIMIT > 0) {
        // If we configured TTL in env for tests, try to use it
        const ttlEnv = process.env.RATE_LIMIT_TTL_MS;
        if (ttlEnv) {
            const v = Number(ttlEnv);
            if (!Number.isNaN(v) && v > 0) {
                return v + 1000; // small safety margin
            }
        }
    }
    // Fallback: 10 seconds
    return 11000;
}

runRateLimitTests().catch((err) => {
    console.error('\n❌ Messages rate limit tests failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
