/**
 * Script to send bulk test notifications (500 notifications) for testing mass upload chunked
 * Usage: node scripts/send-bulk-test-notifications.js
 * 
 * Environment variables:
 * - TOKEN: Access token (default: uses hardcoded token)
 * - BASE_URL: API base URL (default: http://localhost:3000/api/v1)
 * - COUNT: Number of notifications to send (default: 500)
 * - DELAY_MS: Delay between notifications in ms (default: 50)
 */

const TOKEN = process.env.TOKEN || 'zat_9652cc52d3e899326a70adb2059d96647d3a3ec4464b470c7cefe9784325737c';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const COUNT = parseInt(process.env.COUNT || '500', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '50', 10);
const BUCKET_ID = process.env.BUCKET_ID;
const BUCKET_NAME = process.env.BUCKET_NAME;
const VERBOSE_ERRORS = process.env.VERBOSE_ERRORS === 'true';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to fetch available buckets
async function fetchBuckets() {
    try {
        const response = await fetch(`${BASE_URL}/buckets`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        if (!response.ok) {
            console.error('❌ Error fetching buckets:', response.statusText);
            return [];
        }

        const buckets = await response.json();
        return buckets || [];
    } catch (error) {
        console.error('❌ Failed to fetch buckets:', error.message);
        return [];
    }
}

// Function to choose a random bucket
function getRandomBucket(buckets) {
    if (!buckets || buckets.length === 0) return null;
    return buckets[Math.floor(Math.random() * buckets.length)];
}

function pickBucket(buckets) {
    if (!buckets || buckets.length === 0) return null;
    if (BUCKET_ID) {
        return buckets.find((b) => b?.id === BUCKET_ID) || null;
    }
    if (BUCKET_NAME) {
        return buckets.find((b) => b?.name === BUCKET_NAME) || null;
    }
    return getRandomBucket(buckets);
}

// Generate notification configs
function generateNotificationConfig(index) {
    const actions = [
        { type: 'MARK_AS_READ', value: 'mark_as_read', title: 'Mark as Read', icon: 'checkmark.circle', destructive: false },
        { type: 'DELETE', value: 'delete', title: 'Delete', icon: 'trash', destructive: true },
        { type: 'SNOOZE', value: '15', title: 'Snooze 15min', icon: 'clock.fill', destructive: false }
    ];
    
    // Vary actions based on index
    const actionCount = (index % 3) + 1;
    const selectedActions = actions.slice(0, actionCount);
    
    return {
        title: `Test Notification #${index + 1}`,
        body: `This is test notification number ${index + 1} of ${COUNT}. Generated for bulk upload testing.`,
        actions: selectedActions
    };
}

async function sendMessage(config, index, bucket) {
    if (!bucket) {
        console.error(`❌ No bucket available for notification ${index + 1}`);
        return false;
    }

    const payload = {
        title: config.title,
        body: config.body,
        actions: config.actions,
        bucketId: bucket.id,
        addMarkAsReadAction: false,
        addDeleteAction: false,
        addSnoozeAction: false,
        addOpenAction: false
    };

    try {
        const response = await fetch(`${BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (VERBOSE_ERRORS) {
                console.error(
                    `❌ Error sending message ${index + 1} (bucketId=${bucket?.id || 'N/A'} name=${bucket?.name || 'N/A'}):`,
                    response.statusText,
                    errorText
                );
            }
            return { ok: false, status: response.status, errorText };
        }

        const result = await response.json();
        const message = result?.message ?? result;
        
        // Log every 50th notification to avoid spam
        if ((index + 1) % 50 === 0 || index === 0) {
            console.log(`✅ Message ${index + 1}/${COUNT} sent: ${config.title} (ID: ${message?.id || 'N/A'})`);
        }
        
        return { ok: true };
    } catch (error) {
        if (VERBOSE_ERRORS) {
            console.error(`❌ Failed to send message ${index + 1}:`, error.message);
        }
        return { ok: false, status: -1, errorText: error.message };
    }
}

async function main() {
    console.log(`🚀 Starting to send ${COUNT} test notifications...\n`);
    console.log(`📡 Using API: ${BASE_URL}`);
    console.log(`⏱️  Delay between notifications: ${DELAY_MS}ms\n`);
    
    // Fetch available buckets first
    console.log('📦 Fetching available buckets...');
    const buckets = await fetchBuckets();

    if (buckets.length === 0) {
        console.log('⚠️  No buckets found, cannot send messages without a bucket');
        console.log('💡 Please create at least one bucket first');
        process.exit(1);
    } else {
        console.log(`✅ Found ${buckets.length} buckets: ${buckets.map(b => b.name).join(', ')}\n`);
    }
    
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();

    // Send notifications in batches with progress updates
    for (let i = 0; i < COUNT; i++) {
        // Pick a bucket for each notification (optional fixed bucket via env)
        const config = generateNotificationConfig(i);
        let success = false;
        let lastFailure = null;

        // Retry with different buckets on access/not-found errors
        for (let attempt = 0; attempt < 3; attempt++) {
            const bucket = pickBucket(buckets);
            const result = await sendMessage(config, i, bucket);
            if (result === true || result?.ok === true) {
                success = true;
                break;
            }

            lastFailure = {
                status: result?.status,
                bucketId: bucket?.id,
                bucketName: bucket?.name,
                errorText: result?.errorText,
            };

            // 403/404: likely no access or stale bucket entry; try again with another bucket.
            if (result?.status === 403 || result?.status === 404) {
                continue;
            }

            // Other errors: don't spam retries.
            break;
        }

        if (!success && lastFailure) {
            console.error(
                `❌ Error sending message ${i + 1} after retries (bucketId=${lastFailure.bucketId || 'N/A'} name=${lastFailure.bucketName || 'N/A'}):`,
                lastFailure.errorText || `status=${lastFailure.status}`
            );
        }

        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Wait between messages to avoid rate limiting
        if (i < COUNT - 1) {
            await sleep(DELAY_MS);
        }
        
        // Progress update every 100 notifications
        if ((i + 1) % 100 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = ((i + 1) / elapsed).toFixed(1);
            console.log(`📊 Progress: ${i + 1}/${COUNT} (${((i + 1) / COUNT * 100).toFixed(1)}%) - Rate: ${rate} msg/s`);
        }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = (successCount / totalTime).toFixed(1);
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📱 Total: ${COUNT}`);
    console.log(`   ⏱️  Total time: ${totalTime}s`);
    console.log(`   📈 Average rate: ${avgRate} msg/s`);
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
