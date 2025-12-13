#!/usr/bin/env node

/**
 * E2E tests for bucket icon flows (creation & update)
 * with attachments enabled.
 *
 * Scenarios covered:
 * 1) Create bucket without icon -> auto-generated icon (attachment-based).
 * 2) Create bucket with HTTP icon URL -> icon downloaded & stored as attachment.
 * 3) Update existing bucket (color + icon) -> icon re-generated.
 *
 * Environment variables:
 * - BASE_URL  (e.g. http://localhost:3000/api/v1)
 * - TOKEN     (admin access token zat_...)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

async function fetchHttp(url, options = {}) {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        res.data = data;
        res.status = res.statusCode;
        resolve(res);
      });
    });
    req.on('error', reject);

    if (options.headers) {
      Object.keys(options.headers).forEach((key) => {
        req.setHeader(key, options.headers[key]);
      });
    }

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function graphqlRequest(query, variables, authToken) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = res.data ? JSON.parse(res.data) : {};
  return { httpStatus: res.status, payload };
}

function assertCondition(condition, message, details) {
  if (!condition) {
    console.error(`   ❌ ${message}`);
    if (details) {
      console.error(JSON.stringify(details, null, 2));
    }
    process.exit(1);
  }
}

async function fetchPublicAppConfig() {
  const res = await fetchHttp(`${BASE_URL}/public/app-config`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  assertCondition(res.status >= 200 && res.status < 300, 'Failed to fetch public app config', {
    status: res.status,
    body: res.data,
  });

  const payload = res.data ? JSON.parse(res.data) : {};
  return payload;
}

async function createBucket(input) {
  const mutation = `
    mutation CreateBucket($input: CreateBucketDto!) {
      createBucket(input: $input) {
        id
        name
        color
        icon
        iconUrl
        iconAttachmentUuid
      }
    }
  `;

  const result = await graphqlRequest(mutation, { input }, TOKEN);

  if (result.httpStatus < 200 || result.httpStatus >= 300 || result.payload.errors) {
    console.error('   ❌ Failed to create bucket:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const bucket = result.payload.data && result.payload.data.createBucket;
  assertCondition(bucket && bucket.id, 'createBucket did not return a valid bucket', result.payload);

  return bucket;
}

async function getBucket(id) {
  const query = `
    query GetBucket($id: String!) {
      bucket(id: $id) {
        id
        name
        color
        icon
        iconUrl
        iconAttachmentUuid
      }
    }
  `;

  const result = await graphqlRequest(query, { id }, TOKEN);

  if (result.httpStatus < 200 || result.httpStatus >= 300 || result.payload.errors) {
    console.error('   ❌ Failed to fetch bucket:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const bucket = result.payload.data && result.payload.data.bucket;
  assertCondition(bucket && bucket.id === id, 'bucket query did not return expected bucket', result.payload);

  return bucket;
}

async function updateBucket(id, input) {
  const mutation = `
    mutation UpdateBucket($id: String!, $input: UpdateBucketDto!) {
      updateBucket(id: $id, input: $input) {
        id
        name
        color
        icon
        iconUrl
        iconAttachmentUuid
      }
    }
  `;

  const result = await graphqlRequest(mutation, { id, input }, TOKEN);

  if (result.httpStatus < 200 || result.httpStatus >= 300 || result.payload.errors) {
    console.error('   ❌ Failed to update bucket:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const bucket = result.payload.data && result.payload.data.updateBucket;
  assertCondition(bucket && bucket.id === id, 'updateBucket did not return expected bucket', result.payload);

  return bucket;
}

async function scenarioCreateBucketWithoutIcon() {
  console.log('\n' + '─'.repeat(80));
  console.log('1) Create bucket WITHOUT icon (auto-generated attachment icon)');

  const name = `E2E Icon Bucket NoIcon ${Date.now()}`;

  const input = {
    name,
    description: 'E2E bucket without icon - should auto-generate',
    color: '#007AFF',
    isPublic: false,
    isProtected: false,
    generateIconWithInitials: true,
    generateMagicCode: false,
  };

  const created = await createBucket(input);
  console.log('   ✅ Bucket created:', created.id);

  const bucket = await getBucket(created.id);

  assertCondition(
    !!bucket.iconAttachmentUuid,
    'Bucket.iconAttachmentUuid should be set when attachments are enabled',
    bucket,
  );
  assertCondition(
    !!bucket.iconUrl,
    'Bucket.iconUrl should be set when attachments are enabled',
    bucket,
  );

  console.log('   ✅ Auto-generated icon (attachment) is present');
}

async function scenarioCreateBucketWithHttpIcon() {
  console.log('\n' + '─'.repeat(80));
  console.log('2) Create bucket WITH HTTP icon URL (icon downloaded & stored)');

  const name = `E2E Icon Bucket HttpUrl ${Date.now()}`;

  // Public placeholder image used for testing download & processing
  const iconUrl = 'https://via.placeholder.com/256.png?text=E2E';

  const input = {
    name,
    description: 'E2E bucket with HTTP icon URL',
    color: '#4CAF50',
    icon: iconUrl,
    isPublic: false,
    isProtected: false,
    generateIconWithInitials: true,
    generateMagicCode: false,
  };

  const created = await createBucket(input);
  console.log('   ✅ Bucket created:', created.id);

  const bucket = await getBucket(created.id);

  assertCondition(
    !!bucket.iconAttachmentUuid,
    'Bucket.iconAttachmentUuid should be set when icon URL is provided and attachments are enabled',
    bucket,
  );
  assertCondition(
    !!bucket.iconUrl,
    'Bucket.iconUrl should be set when icon URL is provided and attachments are enabled',
    bucket,
  );

  console.log('   ✅ HTTP icon URL processed into attachment-based icon');
}

async function scenarioUpdateBucketIconAndColor() {
  console.log('\n' + '─'.repeat(80));
  console.log('3) Update existing bucket (color + icon) -> icon re-generated');

  const name = `E2E Icon Bucket Update ${Date.now()}`;

  const input = {
    name,
    description: 'E2E bucket for update icon test',
    color: '#2196F3',
    isPublic: false,
    isProtected: false,
    generateIconWithInitials: true,
    generateMagicCode: false,
  };

  const created = await createBucket(input);
  console.log('   ✅ Initial bucket created:', created.id);

  const initial = await getBucket(created.id);
  const initialAttachment = initial.iconAttachmentUuid || null;
  const initialIconUrl = initial.iconUrl || null;

  // New color and icon URL
  const newColor = '#FF5722';
  const newIconUrl = 'https://via.placeholder.com/256.png?text=E2E-UPDATED';

  const updated = await updateBucket(created.id, {
    name: `${name} Updated`,
    color: newColor,
    icon: newIconUrl,
    generateIconWithInitials: true,
  });

  console.log('   ✅ Bucket updated:', updated.id);

  const bucket = await getBucket(created.id);

  assertCondition(
    !!bucket.iconAttachmentUuid,
    'Updated bucket.iconAttachmentUuid should be set',
    bucket,
  );
  assertCondition(
    !!bucket.iconUrl,
    'Updated bucket.iconUrl should be set',
    bucket,
  );

  if (initialAttachment) {
    assertCondition(
      bucket.iconAttachmentUuid !== initialAttachment,
      'iconAttachmentUuid should change after icon/color update',
      { before: initialAttachment, after: bucket.iconAttachmentUuid },
    );
  }

  if (initialIconUrl) {
    assertCondition(
      bucket.iconUrl !== initialIconUrl,
      'iconUrl should change after icon/color update',
      { before: initialIconUrl, after: bucket.iconUrl },
    );
  }

  console.log('   ✅ Bucket icon re-generated after update');
}

async function runBucketIconTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 BUCKET ICON E2E TESTS (attachments enabled)');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Admin token: ${TOKEN.substring(0, 20)}...`);

  const appConfig = await fetchPublicAppConfig();
  console.log('\n🌐 Public app config:', {
    uploadEnabled: appConfig.uploadEnabled,
    iconUploaderEnabled: appConfig.iconUploaderEnabled,
  });

  assertCondition(
    appConfig.uploadEnabled === true,
    'Attachments (uploadEnabled) must be enabled for these tests',
    appConfig,
  );

  console.log('\n🚀 Running scenarios...');

  await scenarioCreateBucketWithoutIcon();
  await scenarioCreateBucketWithHttpIcon();
  await scenarioUpdateBucketIconAndColor();

  console.log('\n✅ All bucket icon E2E checks passed.');
}

runBucketIconTests().catch((err) => {
  console.error('\n❌ Bucket icon E2E tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
