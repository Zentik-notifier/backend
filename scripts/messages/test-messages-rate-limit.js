#!/usr/bin/env node

/**
 * Rate limit E2E tests for the /messages endpoint.
 *
 * Obiettivo:
 * - Verificare che, oltre una certa soglia di richieste in finestra,
 *   il guard di rate-limit risponda con 429 Too Many Requests.
 *
 * Usa:
 * - BASE_URL (es. http://localhost:3000/api/v1)
 * - TOKEN (access token zat_...)
 * - BUCKET_ID (bucket valido dove creare i messaggi)
 * - RATE_LIMIT_LIMIT (opzionale, per sapere dopo quante richieste aspettarsi il 429)
 */

const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;
// Se definito in env lo usiamo per avere aspettative più precise
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

  const expectedLimit = RATE_LIMIT_LIMIT > 0 ? RATE_LIMIT_LIMIT : 20; // fallback se env mancante
  const totalRequests = expectedLimit + 10; // un po' oltre il limite per essere sicuri

  console.log(`   Expected limit (approx): ${expectedLimit} requests/window`);

  let successCount = 0;
  let rateLimitedCount = 0;

  for (let i = 1; i <= totalRequests; i++) {
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

        // Una volta verificato che il rate-limit scatta, possiamo fermarci
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

  console.log(`\n📊 Rate limit summary:`);
  console.log(`   Successful (201): ${successCount}`);
  console.log(`   Rate limited (429): ${rateLimitedCount}`);

  if (rateLimitedCount === 0) {
    console.error('\n❌ Rate limit did not trigger within the expected number of requests.');
    process.exit(1);
  }

  if (RATE_LIMIT_LIMIT > 0) {
    if (successCount > RATE_LIMIT_LIMIT + 2) {
      console.warn(
        `\n⚠️  More successful requests than expected limit (${successCount} > ${RATE_LIMIT_LIMIT}).`,
      );
    }
  }

  console.log('\n✅ Messages rate limit behaviour verified (429 received).');
}

runRateLimitTests().catch((err) => {
  console.error('\n❌ Messages rate limit tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
