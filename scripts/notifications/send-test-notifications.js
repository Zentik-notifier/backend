/**
 * Script to send 10 test notifications with different action combinations
 * Usage: node scripts/send-test-notifications.js
 */

const TOKEN = 'zat_0a8606faa990b38bf30a6b99720a9173331da64dfce3976c2c4c85b75be35d97';
const BASE_URL = 'http://192.168.1.193:3000/api/v1';

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

// Configurations for 10 notifications with different action combinations
const notifications = [
    {
        title: '1. Mark as Read',
        body: 'Notification with only Mark as Read action',
        actions: [
            {
                type: 'MARK_AS_READ',
                value: 'mark_as_read',
                title: 'Mark as Read',
                icon: 'checkmark.circle',
                destructive: false
            }
        ]
    },
    {
        title: '2. Delete Only',
        body: 'Notification with only Delete action',
        actions: [
            {
                type: 'DELETE',
                value: 'delete',
                title: 'Delete',
                icon: 'trash',
                destructive: true
            }
        ]
    },
    {
        title: '3. Mark + Delete',
        body: 'Notification with Mark as Read and Delete actions',
        actions: [
            {
                type: 'MARK_AS_READ',
                value: 'mark_as_read',
                title: 'Mark as Read',
                icon: 'checkmark.circle',
                destructive: false
            },
            {
                type: 'DELETE',
                value: 'delete',
                title: 'Delete',
                icon: 'trash',
                destructive: true
            }
        ]
    },
    {
        title: '4. Snooze 15min',
        body: 'Notification with Snooze 15 minutes action',
        actions: [
            {
                type: 'SNOOZE',
                value: '15',
                title: 'Snooze 15min',
                icon: 'clock.fill',
                destructive: false
            }
        ]
    },
    {
        title: '5. Snooze Options',
        body: 'Notification with multiple snooze durations',
        actions: [
            {
                type: 'SNOOZE',
                value: '5',
                title: 'Snooze 5min',
                icon: 'clock',
                destructive: false
            },
            {
                type: 'SNOOZE',
                value: '30',
                title: 'Snooze 30min',
                icon: 'clock.fill',
                destructive: false
            },
            {
                type: 'SNOOZE',
                value: '60',
                title: 'Snooze 1h',
                icon: 'clock.badge',
                destructive: false
            }
        ]
    },
    {
        title: '6. Navigate Action',
        body: 'Notification with Navigate to URL action',
        actions: [
            {
                type: 'NAVIGATE',
                value: 'https://github.com',
                title: 'Open GitHub',
                icon: 'arrow.up.forward',
                destructive: false
            },
            {
                type: 'MARK_AS_READ',
                value: 'mark_as_read',
                title: 'Mark as Read',
                icon: 'checkmark.circle',
                destructive: false
            }
        ]
    },
    {
        title: '7. Full Suite',
        body: 'Notification with all common actions',
        actions: [
            {
                type: 'MARK_AS_READ',
                value: 'mark_as_read',
                title: 'Mark as Read',
                icon: 'checkmark.circle',
                destructive: false
            },
            {
                type: 'SNOOZE',
                value: '15',
                title: 'Snooze 15min',
                icon: 'clock.fill',
                destructive: false
            },
            {
                type: 'DELETE',
                value: 'delete',
                title: 'Delete',
                icon: 'trash',
                destructive: true
            }
        ]
    },
    {
        title: '8. Multiple Actions',
        body: 'Notification with multiple different actions',
        actions: [
            {
                type: 'DELETE',
                value: 'delete',
                title: 'Delete',
                icon: 'trash',
                destructive: true
            },
            {
                type: 'MARK_AS_READ',
                value: 'mark_as_read',
                title: 'Mark as Read',
                icon: 'checkmark.circle',
                destructive: false
            }
        ]
    },
    {
        title: '9. Open Notification',
        body: 'Notification with Open action',
        actions: [
            {
                type: 'OPEN_NOTIFICATION',
                value: 'open',
                title: 'Open',
                icon: 'arrow.up.right.square',
                destructive: false
            }
        ]
    },
    {
        title: '10. No Actions',
        body: 'Notification without any actions (tap to open only)',
        actions: []
    }
];

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
            console.error(`❌ Error sending message ${index + 1}:`, response.statusText, errorText);
            return false;
        }

        const result = await response.json();
        const message = result?.message ?? result;
        console.log(
            `✅ Message ${index + 1} sent: ${config.title} (ID: ${message?.id || 'N/A'})`,
        );
        return true;
    } catch (error) {
        console.error(`❌ Failed to send message ${index + 1}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting to send 10 test messages...\n');    // Fetch available buckets first
    console.log('📦 Fetching available buckets...');
    const buckets = await fetchBuckets();

    if (buckets.length === 0) {
        console.log('⚠️  No buckets found, cannot send messages without a bucket');
        console.log('💡 Please create at least one bucket first');
        process.exit(1);
    } else {
        console.log(`✅ Found ${buckets.length} buckets: ${buckets.map(b => b.name).join(', ')}\n`);
    } let successCount = 0;
    let failCount = 0;

    const notificationsToSend = notifications.slice(0, 1); // Ensure we only send 10 notifications
    for (let i = 0; i < notificationsToSend.length; i++) {
        // Pick a random bucket for each notification
        const randomBucket = getRandomBucket(buckets);

        if (randomBucket) {
            console.log(`📦 Using bucket: ${randomBucket.name} (${randomBucket.id})`);
        }

        const success = await sendMessage(notifications[i], i, randomBucket);

        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Wait 500ms between messages to avoid rate limiting
        if (i < notifications.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📱 Total: ${notifications.length}`);
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
