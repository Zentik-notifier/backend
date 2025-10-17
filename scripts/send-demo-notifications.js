/**
 * Script to send realistic demo notifications for screenshots and videos
 * Includes about 20 notifications that emulate common app usage scenarios
 * Usage: node scripts/send-demo-notifications.js
 */

const TOKEN = 'zat_fb43d111e46a2e10bbb1af12f0f7c89685840558b0e21e1791433161b802990c';
const BASE_URL = 'http://192.168.1.193:3000/api/v1';

// Realistic and diverse media URLs for demos - using verified working URLs
const DEMO_MEDIA = {
  // Messaging
  whatsapp: [
    'https://picsum.photos/400/400?random=1', // Chat screenshot
    'https://picsum.photos/400/400?random=2', // Message UI
    'https://picsum.photos/400/400?random=3'  // Conversation
  ],
  instagram: [
    'https://picsum.photos/400/400?random=4', // Instagram post
    'https://picsum.photos/400/400?random=5', // Instagram story
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif' // Instagram like animation
  ],
  email: [
    'https://picsum.photos/400/400?random=6', // Email interface
    'https://picsum.photos/400/400?random=7', // Inbox
    'https://picsum.photos/400/400?random=8'  // Email notification
  ],
  // E-commerce
  amazon: [
    'https://picsum.photos/400/400?random=9', // Package delivery
    'https://picsum.photos/400/400?random=10', // Shopping cart
    'https://picsum.photos/400/400?random=11', // Products
    'https://picsum.photos/400/400?random=12'  // Order confirmation
  ],
  // Productivity
  calendar: [
    'https://picsum.photos/400/400?random=13', // Calendar app
    'https://picsum.photos/400/400?random=14', // Meeting room
    'https://picsum.photos/400/400?random=15'  // Schedule
  ],
  todo: [
    'https://picsum.photos/400/400?random=16', // Task list
    'https://picsum.photos/400/400?random=17', // Checklist
    'https://picsum.photos/400/400?random=18', // Project board
    'https://picsum.photos/400/400?random=19'  // Kanban
  ],
  // News & Entertainment
  news: [
    'https://picsum.photos/400/400?random=20', // Newspaper
    'https://picsum.photos/400/400?random=21', // Breaking news
    'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif', // News ticker
    'https://picsum.photos/400/400?random=22'  // Headlines
  ],
  gaming: [
    'https://picsum.photos/400/400?random=23', // Gaming setup
    'https://picsum.photos/400/400?random=24', // Game controller
    'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif', // Gaming animation
    'https://picsum.photos/400/400?random=25'  // Game interface
  ],
  // Video content - using reliable video sources
  videos: [
    'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
    'https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_1mb.mp4',
    'https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_2mb.mp4'
  ],
  // System & Updates
  system: [
    'https://picsum.photos/400/400?random=26', // Update icon
    'https://picsum.photos/400/400?random=27', // System notification
    'https://picsum.photos/400/400?random=28', // Settings
    'https://picsum.photos/400/400?random=29'  // Software update
  ]
};

// Helper functions
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getMediaForCategory(category) {
  return getRandomItem(DEMO_MEDIA[category]);
}

// Common action templates
const ACTION_TEMPLATES = {
  markAsRead: {
    type: 'MARK_AS_READ',
    value: 'mark_as_read',
    title: 'Mark as Read',
    icon: 'checkmark.circle',
    destructive: false
  },
  delete: {
    type: 'DELETE',
    value: 'delete',
    title: 'Delete',
    icon: 'trash',
    destructive: true
  },
  snooze5: {
    type: 'SNOOZE',
    value: '5',
    title: 'Remind in 5 min',
    icon: 'clock',
    destructive: false
  },
  snooze15: {
    type: 'SNOOZE',
    value: '15',
    title: 'Remind in 15 min',
    icon: 'clock.fill',
    destructive: false
  },
  reply: {
    type: 'OPEN_NOTIFICATION',
    value: 'reply',
    title: 'Reply',
    icon: 'arrowshape.turn.up.left',
    destructive: false
  },
  view: {
    type: 'OPEN_NOTIFICATION',
    value: 'view',
    title: 'View',
    icon: 'eye',
    destructive: false
  },
  openApp: {
    type: 'OPEN_NOTIFICATION',
    value: 'open',
    title: 'Open App',
    icon: 'arrow.up.right.square',
    destructive: false
  },
  navigateWeb: {
    type: 'NAVIGATE',
    value: 'https://example.com',
    title: 'Open in Browser',
    icon: 'safari',
    destructive: false
  }
};

// Function to fetch available buckets (only those with bucketIcon)
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

    const allBuckets = await response.json();
    // Filter only buckets that have an icon
    const bucketsWithIcons = allBuckets.filter(bucket => bucket.icon && bucket.icon.trim() !== '');

    console.log(`✅ Found ${bucketsWithIcons.length} buckets with icons (out of ${allBuckets.length} total):`,
      bucketsWithIcons.map(b => `${b.name} (${b.id})`).join(', '));
    return bucketsWithIcons || [];
  } catch (error) {
    console.error('❌ Failed to fetch buckets:', error.message);
    return [];
  }
}

// Generate 20 realistic demo notifications
function generateDemoNotifications(buckets) {
  const notifications = [];

  // Choose random buckets to distribute notifications
  const bucket1 = buckets[0] || buckets[Math.floor(Math.random() * buckets.length)];
  const bucket2 = buckets[1] || buckets[Math.floor(Math.random() * buckets.length)];
  const bucket3 = buckets[2] || buckets[Math.floor(Math.random() * buckets.length)];

  // 1-4. MESSAGING
  notifications.push({
    title: 'Hey! Pizza tonight?',
    body: 'Marco: "Hey! What are you doing tonight? Want to grab some pizza?" 🍕',
    subtitle: '2 unread messages',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('whatsapp'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.reply, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'Call Grandma Today!',
    body: 'Mom: "Remember to call grandma today! It\'s her birthday 🎂"',
    subtitle: 'Important message',
    bucketId: bucket1.id,
    attachments: [],
    actions: [ACTION_TEMPLATES.markAsRead, ACTION_TEMPLATES.snooze15]
  });

  notifications.push({
    title: 'Order #12345 Shipped',
    body: 'Your order has been shipped! Expected delivery tomorrow',
    subtitle: 'amazon.com',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('email'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'New Message from Sarah',
    body: 'Sarah: "The project presentation is ready for review. Can we meet tomorrow?"',
    subtitle: 'Work chat',
    bucketId: bucket3.id,
    attachments: [],
    actions: [ACTION_TEMPLATES.reply, ACTION_TEMPLATES.markAsRead]
  });

  // 5-8. SOCIAL MEDIA
  notifications.push({
    title: 'You were tagged in a photo',
    body: 'luca_photographer tagged you in a photo from last weekend',
    subtitle: '2 hours ago',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('instagram'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: '@elonmusk replied to your tweet!',
    body: 'Elon Musk replied to your tweet about SpaceX',
    subtitle: 'Breaking news',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('news'), mediaType: 'GIF' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: '15 people liked your photo',
    body: 'Your weekend photo got 15 likes and 3 comments',
    subtitle: 'Profile picture updated',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('instagram'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'New connection request',
    body: 'Sara Johnson wants to connect with you',
    subtitle: 'Digital Marketing Expert',
    bucketId: bucket2.id,
    attachments: [],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  // 9-12. E-COMMERCE
  notifications.push({
    title: 'Your order has shipped!',
    body: 'Order #AMZ-789012 has been shipped. Track your package here.',
    subtitle: 'Expected delivery: Tomorrow',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('amazon'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'You won the auction!',
    body: 'Congratulations! You won the auction for "iPhone 15 Pro Max - 256GB"',
    subtitle: 'Final bid: $1,150',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('amazon'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'Your order is ready!',
    body: 'Your Domino\'s order is ready for pickup. Please arrive within 30 minutes.',
    subtitle: 'Order #DP-456789',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('amazon'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.snooze15]
  });

  notifications.push({
    title: 'Payment approved',
    body: 'Transaction approved: $50.00 at Starbucks Downtown',
    subtitle: 'Available balance: $2,340.67',
    bucketId: bucket2.id,
    attachments: [],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  // 13-16. PRODUCTIVITY
  notifications.push({
    title: 'Team meeting in 15 minutes',
    body: 'Development team standup meeting starts in 15 minutes',
    subtitle: 'Conference Room - Floor 3',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('calendar'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.snooze5]
  });

  notifications.push({
    title: 'Task due today',
    body: 'Deadline today: "Complete Alpha project presentation"',
    subtitle: '3 tasks remaining',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('todo'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.snooze15]
  });

  notifications.push({
    title: 'Team mentioned in #project-beta',
    body: 'Marco mentioned the team in #project-beta channel',
    subtitle: 'Urgent release discussion',
    bucketId: bucket1.id,
    attachments: [],
    actions: [ACTION_TEMPLATES.openApp, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'Card moved to In Progress',
    body: '"Implement OAuth login" card moved to "In Progress"',
    subtitle: 'Mobile App Project',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('todo'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  // 17-20. NEWS & SYSTEM
  notifications.push({
    title: 'Breaking: New economic plan announced',
    body: 'Government unveils $100 billion economic recovery plan',
    subtitle: 'Politics - Breaking news',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('news'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'Stranger Things Season 4 available!',
    body: 'New season of Stranger Things is now available to watch',
    subtitle: '4 new episodes',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('videos'), mediaType: 'VIDEO' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.snooze15]
  });

  notifications.push({
    title: 'New achievement unlocked!',
    body: 'You unlocked "First Victory" achievement in Call of Duty Mobile',
    subtitle: '100 points earned',
    bucketId: bucket1.id,
    attachments: [
      { url: getMediaForCategory('gaming'), mediaType: 'GIF' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.markAsRead]
  });

  notifications.push({
    title: 'iOS 17.2 Update Available',
    body: 'iOS 17.2 is now available with security improvements and bug fixes',
    subtitle: 'Security & Performance',
    bucketId: bucket2.id,
    attachments: [
      { url: getMediaForCategory('system'), mediaType: 'IMAGE' }
    ],
    actions: [ACTION_TEMPLATES.view, ACTION_TEMPLATES.snooze15]
  });

  return notifications;
}

// Function to send a notification
async function sendNotification(config, index, total) {
  const payload = {
    title: config.title,
    body: config.body,
    subtitle: config.subtitle,
    bucketId: config.bucketId,
    deliveryType: config.deliveryType || 'NORMAL',
    attachments: config.attachments || [],
    actions: config.actions || [],
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
      console.error(`❌ Error sending notification ${index + 1}/${total}:`, response.statusText, errorText);
      return false;
    }

    const result = await response.json();
    const attachmentInfo = config.attachments.length > 0
      ? ` [${config.attachments.map(a => a.mediaType).join(', ')}]`
      : '';
    const actionInfo = config.actions.length > 0
      ? ` {${config.actions.length} actions}`
      : ' {no actions}';

    console.log(`✅ ${index + 1}/${total} sent:${attachmentInfo}${actionInfo} - ${config.title}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send notification ${index + 1}/${total}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting demo notifications...\n');
  console.log('━'.repeat(80));

  // Step 1: Fetch buckets
  console.log('\n📦 STEP 1: Fetching available buckets...');
  const buckets = await fetchBuckets();

  if (buckets.length === 0) {
    console.error('\n❌ No buckets found! Create at least one bucket with an icon first.');
    console.log('💡 You can create buckets via the API or admin interface.');
    process.exit(1);
  }

  console.log(`\n✅ Successfully loaded ${buckets.length} bucket(s) with icons`);
  buckets.forEach((bucket, i) => {
    console.log(`   ${i + 1}. ${bucket.name} (ID: ${bucket.id})`);
  });

  // Step 2: Generate notifications
  console.log('\n━'.repeat(80));
  console.log('\n📋 STEP 2: Generating demo notifications...');
  const notifications = generateDemoNotifications(buckets);
  console.log(`\n✅ Generated ${notifications.length} demo notifications`);

  // Step 3: Send notifications
  console.log('\n━'.repeat(80));
  console.log('\n📤 STEP 3: Sending notifications...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < notifications.length; i++) {
    const success = await sendNotification(notifications[i], i, notifications.length);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Wait between messages to avoid rate limiting
    if (i < notifications.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Final summary
  console.log('\n━'.repeat(80));
  console.log('\n📊 FINAL SUMMARY:');
  console.log(`   ✅ Successfully sent: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📱 Total notifications: ${notifications.length}`);
  console.log(`   📦 Buckets used: ${buckets.length}`);

  const successRate = ((successCount / notifications.length) * 100).toFixed(1);
  console.log(`   📈 Success rate: ${successRate}%`);

  console.log('\n━'.repeat(80));
  console.log('\n✨ Demo completed! Check your device for notifications.\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Script failed with error:', error);
  console.error(error.stack);
  process.exit(1);
});

