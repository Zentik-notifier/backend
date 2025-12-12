/**
 * E2E test script for iOS APNs delivery scenarios.
 *
 * Scenarios covered (one after the other):
 *  1) Normal payload (expected: encrypted send, no PayloadTooLarge).
 *  2) PayloadTooLarge with retry enabled (UnencryptOnBigPayload = true).
 *  3) PayloadTooLarge with retry enabled but still too large -> selfDownload.
 *  4) PayloadTooLarge with retry disabled (UnencryptOnBigPayload = false) -> selfDownload.
 *
 * The goal is to:
 *  - Send a notification that reaches at least one iOS device for the current user.
 *  - For each scenario, check that:
 *      - Events NOTIFICATION / NOTIFICATION_FAILED are created with the expected metadata.
 *      - EntityExecution of type NOTIFICATION exists with providerResponse and flags.
 *
 * NOTE:
 *  - This script does NOT change server environment variables. You must run the backend
 *    with the desired `IOS_APN_MOCK_MODE` (or real APNs) before executing it.
 *  - To make scenarios deterministic, you can run the script multiple times while
 *    switching `IOS_APN_MOCK_MODE` between `success` and `payloadtoolarge` on the server.
 *  - TOKEN must belong to a user that has at least one iOS device registered.
 *
 * Environment variables:
 *  - BASE_URL   (default: http://localhost:3000/api/v1)
 *  - TOKEN      (required; JWT for the test user, ideally admin for /events)
 *  - BUCKET_ID  (optional; bucket where messages will be created)
 *  - DEVICE_ID  (optional; specific userDevice.id to target; otherwise first IOS device)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;
const DEVICE_ID = process.env.DEVICE_ID;
const IOS_APN_MOCK_MODE = process.env.IOS_APN_MOCK_MODE || 'unknown';

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required');
    process.exit(1);
}

const IOS_SCENARIOS = {
    NORMAL: 'NORMAL_PAYLOAD',
    RETRY_SUCCESS: 'PAYLOAD_TOO_LARGE_RETRY_SUCCESS',
    RETRY_SELF_DOWNLOAD: 'PAYLOAD_TOO_LARGE_RETRY_SELF_DOWNLOAD',
    NO_RETRY_SELF_DOWNLOAD: 'PAYLOAD_TOO_LARGE_NO_RETRY_SELF_DOWNLOAD',
};

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

async function graphqlRequest(query, variables, authToken = TOKEN, deviceTokenHeader) {
    const res = await fetchHttp(`${BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            ...(deviceTokenHeader
                ? { devicetoken: deviceTokenHeader }
                : {}),
        },
        body: JSON.stringify({ query, variables }),
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(`GraphQL HTTP error: ${res.status} - ${res.data || res.statusText}`);
    }

    const payload = JSON.parse(res.data || '{}');
    if (payload.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
    }

    return payload.data;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveBucketId() {
    if (BUCKET_ID) {
        console.log(`📦 Using BUCKET_ID from env: ${BUCKET_ID}`);
        return BUCKET_ID;
    }

    console.log('📦 Fetching available buckets via REST...');
    const res = await fetchHttp(`${BASE_URL}/buckets`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
        },
    });

    if (res.status < 200 || res.status >= 300) {
        console.error('❌ Failed to fetch buckets:', res.status, res.data || res.statusText);
        process.exit(1);
    }

    const buckets = JSON.parse(res.data || '[]');
    if (!Array.isArray(buckets) || buckets.length === 0) {
        console.error('❌ No buckets found. Please create at least one bucket.');
        process.exit(1);
    }

    const bucket = buckets[0];
    console.log(`📦 Using first bucket: ${bucket.name} (${bucket.id})`);
    return bucket.id;
}

async function resolveIosDevice() {
    console.log('📱 Fetching user devices via GraphQL...');
    const query = `
    query GetUserDevices {
      userDevices {
        id
        deviceName
        platform
                deviceToken
      }
    }
  `;

    let data = await graphqlRequest(query, {});
    let devices = data.userDevices || [];

    if (!devices.length) {
        console.warn('⚠️  No devices found for current user. Registering a test iOS device...');
        await registerTestIosDevice();
        data = await graphqlRequest(query, {});
        devices = data.userDevices || [];
    }

    if (!devices.length) {
        console.error('❌ Still no devices found after registering a test device.');
        process.exit(1);
    }

    let iosDevice = null;

    if (DEVICE_ID) {
        iosDevice = devices.find((d) => d.id === DEVICE_ID);
        if (!iosDevice) {
            console.error(`❌ DEVICE_ID ${DEVICE_ID} not found among user devices.`);
            process.exit(1);
        }
        if (iosDevice.platform !== 'IOS') {
            console.warn(`⚠️ DEVICE_ID ${DEVICE_ID} is not IOS (platform=${iosDevice.platform}).`);
        }
    } else {
        iosDevice = devices.find((d) => d.platform === 'IOS');
    }

    if (!iosDevice) {
        console.warn('⚠️  No IOS device found, creating one explicitly...');
        await registerTestIosDevice();
        data = await graphqlRequest(query, {});
        devices = data.userDevices || [];
        iosDevice = devices.find((d) => d.platform === 'IOS');
    }

    if (!iosDevice) {
        console.error('❌ No IOS device available for current user even after registration.');
        console.log('   Devices:', devices.map((d) => `${d.id} (${d.platform})`).join(', '));
        process.exit(1);
    }

    console.log(`📱 Using iOS device: ${iosDevice.deviceName || iosDevice.id} (${iosDevice.id})`);
    return iosDevice;
}

async function registerTestIosDevice() {
    const mutation = `
    mutation RegisterTestDevice($input: RegisterDeviceDto!) {
      registerDevice(input: $input) {
        id
        deviceName
        platform
      }
    }
  `;

    const variables = {
        input: {
            deviceName: 'CI iOS Device',
            deviceModel: 'iPhone Simulator',
            osVersion: '17.0',
            platform: 'IOS',
            deviceToken: 'ci-ios-mock-token',
        },
    };

    try {
        console.log('   ➕ Registering CI test iOS device via GraphQL...');
        const data = await graphqlRequest(mutation, variables);
        const device = data.registerDevice;
        console.log(`   ✅ Registered test device: ${device.id} (${device.platform})`);
        return device;
    } catch (e) {
        console.error('❌ Failed to register CI test iOS device:', e.message);
        throw e;
    }
}

async function setUnencryptOnBigPayload(deviceId, enabled) {
    console.log(`⚙️  Setting UnencryptOnBigPayload=${enabled} for device ${deviceId}...`);
    const mutation = `
    mutation SetUnencryptOnBigPayload($deviceId: String!, $enabled: Boolean!) {
      upsertUserSetting(input: {
        configType: UnencryptOnBigPayload,
        deviceId: $deviceId,
        valueBool: $enabled
      }) {
        configType
        valueBool
        deviceId
      }
    }
  `;

    const data = await graphqlRequest(mutation, { deviceId, enabled });
    const setting = data.upsertUserSetting;
    console.log(`   ✅ User setting updated: ${setting.configType} = ${setting.valueBool}`);
    return setting;
}

async function createMessage(bucketId, scenarioName, bodySize) {
    const baseTitle = `[APNs E2E] ${scenarioName}`;
    const baseBody = `Scenario ${scenarioName} at ${new Date().toISOString()}`;
    const extra = bodySize && bodySize > 0 ? 'X'.repeat(bodySize) : '';

    const payload = {
        bucketId,
        title: baseTitle,
        body: `${baseBody}\n${extra}`,
    };

    console.log(`✉️  Creating message for scenario ${scenarioName}...`);
    const res = await fetchHttp(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(payload),
    });

    if (res.status < 200 || res.status >= 300) {
        console.error('❌ Failed to create message:', res.status, res.data || res.statusText);
        throw new Error('Failed to create message');
    }

    const message = JSON.parse(res.data || '{}');
    console.log(`   ✅ Message created: id=${message.id}, title="${message.title}"`);
    return message;
}

async function waitForNotificationForMessage(messageId, deviceId, deviceToken, timeoutMs = 30000) {
    const started = Date.now();
    const pollInterval = 1000;

    console.log(`⏱  Waiting for notification for message ${messageId} on device ${deviceId}...`);

    const query = `
    query GetNotificationsForUser {
      notifications {
        id
        userDeviceId
        createdAt
        userDevice {
          id
          platform
          deviceName
        }
        message {
          id
          title
        }
      }
    }
  `;

    while (Date.now() - started < timeoutMs) {
        const data = await graphqlRequest(query, {}, TOKEN, deviceToken);
        const notifications = data.notifications || [];

        const match = notifications.find(
            (n) => n.message && n.message.id === messageId && n.userDeviceId === deviceId,
        );

        if (match) {
            console.log(
                `   ✅ Found notification ${match.id} for message ${messageId} on device ${deviceId}`,
            );
            return match;
        }

        await sleep(pollInterval);
    }

    console.warn('⚠️  No notification found within timeout window');
    return null;
}

async function fetchExecutionsForNotification(notificationId) {
    const query = `
    query GetExecutions($entityId: String) {
      getEntityExecutions(input: { type: NOTIFICATION, entityId: $entityId }) {
        id
        status
        errors
        output
        createdAt
      }
    }
  `;

    const data = await graphqlRequest(query, { entityId: notificationId });
    return data.getEntityExecutions || [];
}

async function fetchEventsForNotification(notificationId) {
    const query = `
    query EventsForNotification($notificationId: String!) {
      events(query: { objectId: $notificationId, limit: 50, page: 1 }) {
        events {
          id
          type
          createdAt
          additionalInfo
        }
      }
    }
  `;

    const data = await graphqlRequest(query, { notificationId });
    return (data.events && data.events.events) || [];
}

function extractExecutionMeta(executions) {
    if (!executions.length) return null;

    // Take the most recent execution
    const latest = executions
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    let outputJson = null;
    try {
        outputJson = latest.output ? JSON.parse(latest.output) : null;
    } catch (e) {
        console.warn('⚠️  Failed to parse execution.output JSON:', e.message);
    }

    const providerResponse = outputJson && outputJson.providerResponse ? outputJson.providerResponse : {};

    return {
        execution: latest,
        retryWithoutEncEnabled: !!(outputJson && outputJson.retryWithoutEncEnabled),
        providerResponse,
        flags: {
            payloadTooLargeDetected: !!providerResponse.payloadTooLargeDetected,
            retryAttempted: !!providerResponse.retryAttempted,
            sentWithEncryption: !!providerResponse.sentWithEncryption,
            sentWithoutEncryption: !!providerResponse.sentWithoutEncryption,
            sentWithSelfDownload: !!providerResponse.sentWithSelfDownload,
        },
    };
}

function summarizeScenario(scenarioKey, name, notification, executions, events) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📘 Scenario: ${name}`);
    console.log(`   Notification ID: ${notification ? notification.id : 'N/A'}`);

    if (!notification) {
        console.log('   ⚠️  No notification found for this scenario.');
        throw new Error(`Scenario ${scenarioKey}: expected a notification but none was found`);
    }

    const meta = extractExecutionMeta(executions);

    if (!executions.length) {
        console.log('   ⚠️  No EntityExecution records found.');
    } else {
        console.log(`   🧾 Executions: ${executions.length}`);
        console.log(
            `   ▶ Latest execution status: ${meta.execution.status}, errors: ${meta.execution.errors || 'none'}`,
        );

        console.log('   🔍 Provider response flags:');
        console.log(
            `      payloadTooLargeDetected=${meta.flags.payloadTooLargeDetected}, retryAttempted=${meta.flags.retryAttempted}`,
        );
        console.log(
            `      sentWithEncryption=${meta.flags.sentWithEncryption}, sentWithoutEncryption=${meta.flags.sentWithoutEncryption}, sentWithSelfDownload=${meta.flags.sentWithSelfDownload}`,
        );
        console.log(
            `      retryWithoutEncEnabled=${meta.retryWithoutEncEnabled}`,
        );
    }

    const notificationEvents = events.filter((e) => e.type === 'NOTIFICATION');
    const failedEvents = events.filter((e) => e.type === 'NOTIFICATION_FAILED');

    console.log('   📡 Events:');
    console.log(`      NOTIFICATION: ${notificationEvents.length}`);
    console.log(`      NOTIFICATION_FAILED: ${failedEvents.length}`);

    const lastNotif =
        notificationEvents.length > 0
            ? notificationEvents[notificationEvents.length - 1]
            : null;
    const lastFailed =
        failedEvents.length > 0 ? failedEvents[failedEvents.length - 1] : null;

    if (lastNotif) {
        console.log('   ℹ️  Last NOTIFICATION.additionalInfo:');
        console.log(`      ${JSON.stringify(lastNotif.additionalInfo || {}, null, 2)}`);
    }
    if (lastFailed) {
        console.log('   ℹ️  Last NOTIFICATION_FAILED.additionalInfo:');
        console.log(`      ${JSON.stringify(lastFailed.additionalInfo || {}, null, 2)}`);
    }

    // Strict assertions on flags and events per scenario / mock mode
    if (!meta) {
        throw new Error(`Scenario ${scenarioKey}: missing execution metadata`);
    }

    const mode = (IOS_APN_MOCK_MODE || '').toLowerCase();

    const isRetryScenario =
        scenarioKey === 'SCENARIO_2_RETRY_SUCCESS' ||
        scenarioKey === 'SCENARIO_3_RETRY_SELF_DOWNLOAD';

    // retryWithoutEncEnabled must mirror user setting (UnencryptOnBigPayload)
    if (meta.retryWithoutEncEnabled !== isRetryScenario) {
        throw new Error(
            `Scenario ${scenarioKey}: expected retryWithoutEncEnabled=${isRetryScenario} but got ${meta.retryWithoutEncEnabled}`,
        );
    }

    if (mode === 'success') {
        // In success mock mode no PayloadTooLarge / selfDownload should be observed
        if (meta.flags.payloadTooLargeDetected) {
            throw new Error(
                `Scenario ${scenarioKey} [success]: expected payloadTooLargeDetected=false`,
            );
        }
        if (meta.flags.sentWithSelfDownload) {
            throw new Error(
                `Scenario ${scenarioKey} [success]: expected sentWithSelfDownload=false`,
            );
        }
        if (failedEvents.length > 0) {
            throw new Error(
                `Scenario ${scenarioKey} [success]: expected NOTIFICATION_FAILED=0 but got ${failedEvents.length}`,
            );
        }
        if (notificationEvents.length === 0) {
            throw new Error(
                `Scenario ${scenarioKey} [success]: expected at least 1 NOTIFICATION event`,
            );
        }
    } else if (mode === 'payloadtoolarge') {
        // In payloadtoolarge mock mode we always simulate PayloadTooLarge
        if (!meta.flags.payloadTooLargeDetected) {
            throw new Error(
                `Scenario ${scenarioKey} [payloadtoolarge]: expected payloadTooLargeDetected=true`,
            );
        }
        if (!meta.flags.sentWithSelfDownload) {
            throw new Error(
                `Scenario ${scenarioKey} [payloadtoolarge]: expected sentWithSelfDownload=true`,
            );
        }
        if (notificationEvents.length === 0) {
            throw new Error(
                `Scenario ${scenarioKey} [payloadtoolarge]: expected at least 1 NOTIFICATION event`,
            );
        }
        if (failedEvents.length === 0) {
            throw new Error(
                `Scenario ${scenarioKey} [payloadtoolarge]: expected at least 1 NOTIFICATION_FAILED event`,
            );
        }

        const expectedSentWithoutEnc = isRetryScenario;
        if (meta.flags.sentWithoutEncryption !== expectedSentWithoutEnc) {
            throw new Error(
                `Scenario ${scenarioKey} [payloadtoolarge]: expected sentWithoutEncryption=${expectedSentWithoutEnc} but got ${meta.flags.sentWithoutEncryption}`,
            );
        }
    }
}

async function runScenarioNormal(bucketId, device) {
    console.log('\n=== Scenario 1: Normal payload (no PayloadTooLarge expected) ===');

    // For this scenario the retry flag is not critical, but we can disable it.
    await setUnencryptOnBigPayload(device.id, false);

    const message = await createMessage(bucketId, IOS_SCENARIOS.NORMAL, 512);
    const notification = await waitForNotificationForMessage(message.id, device.id, device.deviceToken);

    if (!notification) {
        summarizeScenario('SCENARIO_1_NORMAL', 'Scenario 1 - NORMAL', null, [], []);
        return;
    }

    const executions = await fetchExecutionsForNotification(notification.id);
    const events = await fetchEventsForNotification(notification.id);

    summarizeScenario('SCENARIO_1_NORMAL', 'Scenario 1 - NORMAL', notification, executions, events);
}

async function runScenarioPayloadTooLargeRetrySuccess(bucketId, device) {
    console.log('\n=== Scenario 2: PayloadTooLarge with retry enabled (expected retry success) ===');

    await setUnencryptOnBigPayload(device.id, true);

    // Medium-large body to try to trigger PayloadTooLarge when encrypted,
    // but potentially succeed when retried without encryption (depends on APNs / mock).
    const message = await createMessage(bucketId, IOS_SCENARIOS.RETRY_SUCCESS, 4096);
    const notification = await waitForNotificationForMessage(message.id, device.id, device.deviceToken);

    if (!notification) {
        summarizeScenario('SCENARIO_2_RETRY_SUCCESS', 'Scenario 2 - RETRY_SUCCESS', null, [], []);
        return;
    }

    const executions = await fetchExecutionsForNotification(notification.id);
    const events = await fetchEventsForNotification(notification.id);

    summarizeScenario('SCENARIO_2_RETRY_SUCCESS', 'Scenario 2 - RETRY_SUCCESS', notification, executions, events);
}

async function runScenarioPayloadTooLargeRetrySelfDownload(bucketId, device) {
    console.log('\n=== Scenario 3: PayloadTooLarge with retry enabled but still too large -> selfDownload ===');

    await setUnencryptOnBigPayload(device.id, true);

    // Larger body to increase probability that both encrypted and unencrypted
    // payloads exceed APNs limit, forcing selfDownload fallback.
    const message = await createMessage(bucketId, IOS_SCENARIOS.RETRY_SELF_DOWNLOAD, 16384);
    const notification = await waitForNotificationForMessage(message.id, device.id, device.deviceToken);

    if (!notification) {
        summarizeScenario('SCENARIO_3_RETRY_SELF_DOWNLOAD', 'Scenario 3 - RETRY_SELF_DOWNLOAD', null, [], []);
        return;
    }

    const executions = await fetchExecutionsForNotification(notification.id);
    const events = await fetchEventsForNotification(notification.id);

    summarizeScenario('SCENARIO_3_RETRY_SELF_DOWNLOAD', 'Scenario 3 - RETRY_SELF_DOWNLOAD', notification, executions, events);
}

async function runScenarioPayloadTooLargeNoRetrySelfDownload(bucketId, device) {
    console.log('\n=== Scenario 4: PayloadTooLarge with retry disabled -> selfDownload ===');

    await setUnencryptOnBigPayload(device.id, false);

    const message = await createMessage(bucketId, IOS_SCENARIOS.NO_RETRY_SELF_DOWNLOAD, 8192);
    const notification = await waitForNotificationForMessage(message.id, device.id, device.deviceToken);

    if (!notification) {
        summarizeScenario('SCENARIO_4_NO_RETRY_SELF_DOWNLOAD', 'Scenario 4 - NO_RETRY_SELF_DOWNLOAD', null, [], []);
        return;
    }

    const executions = await fetchExecutionsForNotification(notification.id);
    const events = await fetchEventsForNotification(notification.id);

    summarizeScenario('SCENARIO_4_NO_RETRY_SELF_DOWNLOAD', 'Scenario 4 - NO_RETRY_SELF_DOWNLOAD', notification, executions, events);
}

async function main() {
    console.log('🚀 Starting iOS APNs E2E scenarios test...');
    console.log(`   BASE_URL = ${BASE_URL}`);
    console.log(`   BUCKET_ID = ${BUCKET_ID || '(auto)'}`);
    console.log(`   DEVICE_ID = ${DEVICE_ID || '(auto IOS device)'}`);
    console.log(`   IOS_APN_MOCK_MODE = ${IOS_APN_MOCK_MODE}`);
    console.log('   NOTE: Ensure backend is running and IOS_APN_MOCK_MODE is configured as desired.');

    const bucketId = await resolveBucketId();
    const iosDevice = await resolveIosDevice();

    await runScenarioNormal(bucketId, iosDevice);
    await runScenarioPayloadTooLargeRetrySuccess(bucketId, iosDevice);
    await runScenarioPayloadTooLargeRetrySelfDownload(bucketId, iosDevice);
    await runScenarioPayloadTooLargeNoRetrySelfDownload(bucketId, iosDevice);

    console.log('\n✅ All scenarios executed. Review the logs above (and server logs) for details.');
}

main().catch((err) => {
    console.error('\n❌ Script failed with error:', err);
    console.error(err.stack);
    process.exit(1);
});
