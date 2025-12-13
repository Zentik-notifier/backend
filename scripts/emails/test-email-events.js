/**
 * E2E script to validate EMAIL_SENT / EMAIL_FAILED events
 * for core auth email flows (registration + password reset).
 *
 * It relies on EMAIL_MOCK_MODE to avoid sending real emails,
 * similar to IOS_APN_MOCK_MODE for APNs.
 *
 * Expected env vars:
 * - BASE_URL: base API URL (default: http://localhost:3000/api/v1)
 * - TOKEN: admin access token (for /events endpoints)
 * - EMAIL_MOCK_MODE: 'success' or 'fail'
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const EMAIL_MOCK_MODE = (process.env.EMAIL_MOCK_MODE || '').toLowerCase();

if (!TOKEN) {
  console.error('❌ TOKEN env variable is required (admin access token)');
  process.exit(1);
}

if (!EMAIL_MOCK_MODE || !['success', 'fail'].includes(EMAIL_MOCK_MODE)) {
  console.error(
    "❌ EMAIL_MOCK_MODE must be set to either 'success' or 'fail'",
  );
  process.exit(1);
}

function fetchHttp(url, options = {}) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(urlObj, options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
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

async function graphqlRequest(query, variables) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.statusCode === 401) {
    console.warn(
      '⚠️ batchUpdateServerSettings unauthorized (401). TOKEN is likely a system access token. Skipping settings update and relying on existing EMAIL_ENABLED / EMAIL_MOCK_MODE.',
    );
    return;
  }

  if (res.statusCode >= 400) {
    console.error(`❌ GraphQL HTTP error: ${res.statusCode} ${res.statusMessage}`);
    console.error('Response:', res.data);
    throw new Error(`GraphQL HTTP error ${res.statusCode}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    console.error('❌ GraphQL errors:', JSON.stringify(payload.errors, null, 2));
    throw new Error('GraphQL returned errors');
  }

  return payload.data;
}

async function fetchPublicAppConfig() {
  const res = await fetchHttp(`${BASE_URL}/public/app-config`);
  if (res.statusCode >= 400) {
    console.error(
      `❌ Failed to fetch public app-config: ${res.statusCode} ${res.statusMessage}`,
    );
    throw new Error('Failed to fetch public app-config');
  }

  return JSON.parse(res.data || '{}');
}

async function fetchEventsByType(type) {
  const url = `${BASE_URL}/events/by-type?type=${encodeURIComponent(
    type,
  )}&page=1&limit=100`;

  const res = await fetchHttp(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  if (res.statusCode >= 400) {
    console.error(
      `❌ Failed to fetch events by type ${type}: ${res.statusCode} ${res.statusMessage}`,
    );
    console.error('Response:', res.data);
    throw new Error(`Failed to fetch events of type ${type}`);
  }

  const json = JSON.parse(res.data || '{}');
  // Controller may return either an array or an object with { events, total, ... }
  if (Array.isArray(json)) {
    return json;
  }
  if (Array.isArray(json.events)) {
    return json.events;
  }
  return [];
}

async function registerTestUser(email) {
  const mutation = `
    mutation Register($input: RegisterDto!) {
      register(input: $input) {
        user {
          id
          email
          username
        }
        emailConfirmationRequired
      }
    }
  `;

  const variables = {
    input: {
      email,
      username: `e2e_user_${Date.now().toString(36)}`,
      password: 'E2eTestPassword123!',
      firstName: 'E2E',
      lastName: 'User',
      locale: 'en-EN',
    },
  };

  const data = await graphqlRequest(mutation, variables);
  const user = data?.register?.user;
  if (!user?.id) {
    throw new Error('Registration did not return a user');
  }

  console.log(
    `✅ Registered test user: id=${user.id}, email=${user.email}, emailConfirmationRequired=${data.register.emailConfirmationRequired}`,
  );
  return user;
}

async function requestPasswordReset(email) {
  const mutation = `
    mutation RequestPasswordReset($input: RequestPasswordResetDto!) {
      requestPasswordReset(input: $input) {
        success
        message
      }
    }
  `;

  const variables = {
    input: {
      email,
      locale: 'en-EN',
    },
  };

  const data = await graphqlRequest(mutation, variables);
  console.log(
    `🔁 requestPasswordReset for ${email}: success=${data.requestPasswordReset.success}, message="${data.requestPasswordReset.message}"`,
  );
}

function countEventsForEmail(events, email) {
  return events.filter(
    (e) => e.additionalInfo && e.additionalInfo.to === email,
  );
}

async function getAdminJwt() {
  const adminUsers = process.env.ADMIN_USERS;
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;

  if (!adminUsers || !adminPassword) {
    console.warn(
      '⚠️ ADMIN_USERS or ADMIN_DEFAULT_PASSWORD not set; skipping admin login and relying on existing EMAIL_ENABLED / EMAIL_MOCK_MODE.',
    );
    return null;
  }

  const identifier = adminUsers.split(',').map((s) => s.trim())[0];
  if (!identifier) {
    console.warn('⚠️ ADMIN_USERS is empty; skipping admin login.');
    return null;
  }

  console.log(`🔐 Logging in admin as ${identifier} to obtain JWT...`);

  const res = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password: adminPassword }),
  });

  if (res.statusCode >= 400) {
    console.warn(
      `⚠️ Admin login failed (${res.statusCode}). Skipping settings update and relying on existing EMAIL_ENABLED / EMAIL_MOCK_MODE. Response: ${res.data}`,
    );
    return null;
  }

  const payload = JSON.parse(res.data || '{}');
  const jwt = payload.accessToken;
  if (!jwt) {
    console.warn('⚠️ Admin login response missing accessToken; skipping settings update.');
    return null;
  }

  return jwt;
}

async function ensureEmailSettingsEnabled() {
  console.log('⚙️ Ensuring email-related server settings are enabled via GraphQL...');

  const mutation = `
    mutation BatchUpdate($settings: [BatchUpdateSettingInput!]!) {
      batchUpdateServerSettings(settings: $settings) {
        configType
        valueBool
        valueText
      }
    }
  `;

  const variables = {
    settings: [
      {
        configType: 'EmailEnabled',
        valueBool: true,
      },
    ],
  };

  const adminJwt = await getAdminJwt();
  if (!adminJwt) {
    return;
  }

  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminJwt}`,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (res.statusCode >= 400) {
    console.error(`❌ Failed to batchUpdateServerSettings: ${res.statusCode} ${res.statusMessage}`);
    console.error('Response:', res.data);
    throw new Error('Failed to batchUpdateServerSettings');
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    const unauth = payload.errors.some(
      (err) =>
        err.extensions?.code === 'UNAUTHENTICATED' ||
        err.extensions?.originalError?.statusCode === 401,
    );
    if (unauth) {
      console.warn(
        '⚠️ batchUpdateServerSettings is UNAUTHENTICATED. Skipping settings update and relying on existing EMAIL_ENABLED / EMAIL_MOCK_MODE.',
      );
      return;
    }

    console.error('❌ GraphQL errors in batchUpdateServerSettings:', JSON.stringify(payload.errors, null, 2));
    throw new Error('batchUpdateServerSettings returned errors');
  }

  console.log('✅ Email-related server settings updated:', payload.data?.batchUpdateServerSettings);
}

async function main() {
  console.log('🚀 Starting EMAIL events E2E test');
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`EMAIL_MOCK_MODE=${EMAIL_MOCK_MODE}`);

  // Ensure EmailEnabled=true so that public app-config and flows behave as expected
  await ensureEmailSettingsEnabled();

  const appConfig = await fetchPublicAppConfig();
  console.log(
    `ℹ️ publicAppConfig: emailEnabled=${appConfig.emailEnabled}, systemTokenRequestsEnabled=${appConfig.systemTokenRequestsEnabled}`,
  );

  if (!appConfig.emailEnabled) {
    console.warn(
      '⚠️ emailEnabled=false from public app-config. Continuing because EMAIL_MOCK_MODE is set; test will fail later if EMAIL_SENT/EMAIL_FAILED events are missing.',
    );
  }

  const initialSent = await fetchEventsByType('EMAIL_SENT');
  const initialFailed = await fetchEventsByType('EMAIL_FAILED');
  console.log(
    `📊 Initial events: EMAIL_SENT=${initialSent.length}, EMAIL_FAILED=${initialFailed.length}`,
  );

  const testEmail = `e2e-email-${Date.now()}@example.com`;
  console.log(`📧 Using test email: ${testEmail}`);

  // 1) Register new user (triggers confirmation email if emailEnabled)
  await registerTestUser(testEmail);

  // 2) Request password reset for that user (triggers reset email)
  await requestPasswordReset(testEmail);

  // Small delay to ensure events are persisted
  await new Promise((resolve) => setTimeout(resolve, 500));

  const finalSent = await fetchEventsByType('EMAIL_SENT');
  const finalFailed = await fetchEventsByType('EMAIL_FAILED');

  console.log(
    `📊 Final events: EMAIL_SENT=${finalSent.length}, EMAIL_FAILED=${finalFailed.length}`,
  );

  const sentDelta = finalSent.length - initialSent.length;
  const failedDelta = finalFailed.length - initialFailed.length;

  const sentForEmail = countEventsForEmail(finalSent, testEmail);
  const failedForEmail = countEventsForEmail(finalFailed, testEmail);

  console.log(
    `📈 Deltas: EMAIL_SENT +${sentDelta}, EMAIL_FAILED +${failedDelta}`,
  );
  console.log(
    `📧 Events for ${testEmail}: EMAIL_SENT=${sentForEmail.length}, EMAIL_FAILED=${failedForEmail.length}`,
  );

  if (EMAIL_MOCK_MODE === 'success') {
    if (sentForEmail.length < 2) {
      console.error(
        '❌ Expected at least 2 EMAIL_SENT events for test email (registration + password reset) in success mock mode',
      );
      process.exit(1);
    }
    if (failedForEmail.length > 0) {
      console.error(
        '❌ Expected 0 EMAIL_FAILED events for test email in success mock mode',
      );
      process.exit(1);
    }
    console.log('✅ EMAIL_SENT/EMAIL_FAILED events look correct for success mock mode.');
  } else if (EMAIL_MOCK_MODE === 'fail') {
    if (failedForEmail.length < 2) {
      console.error(
        '❌ Expected at least 2 EMAIL_FAILED events for test email (registration + password reset) in fail mock mode',
      );
      process.exit(1);
    }
    if (sentForEmail.length > 0) {
      console.error(
        '❌ Expected 0 EMAIL_SENT events for test email in fail mock mode',
      );
      process.exit(1);
    }
    console.log('✅ EMAIL_SENT/EMAIL_FAILED events look correct for fail mock mode.');
  }

  console.log('🎉 EMAIL events E2E test completed successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ EMAIL events E2E test failed with unexpected error:', err);
  process.exit(1);
});
