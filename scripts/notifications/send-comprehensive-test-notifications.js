/**
 * Complete script to send test notifications with all combinations of attachments and actions
 * Usage: node scripts/send-comprehensive-test-notifications.js
 */

const TOKEN = process.env.TOKEN || 'zat_ded1db02b4fc91e33ad9ff8aa3f0102c4eddbec1da9b33e51af70dd6d6ff1610';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DEFAULT_BUCKET_ID = process.env.DEFAULT_BUCKET_ID || '2dd0e29d-51c9-45d6-93b9-668b26c659e5';

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
        res.ok = res.statusCode >= 200 && res.statusCode < 300;
        res.status = res.statusCode;
        res.statusText = res.statusMessage;
        res.json = async () => {
          try {
            return JSON.parse(data);
          } catch (e) {
            throw new Error('Invalid JSON response');
          }
        };
        res.text = async () => data;
        resolve(res);
      });
    });
    req.on('error', reject);
    
    if (options.headers) {
      Object.keys(options.headers).forEach(key => {
        req.setHeader(key, options.headers[key]);
      });
    }
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Pool of random media URLs
const MEDIA_URLS = {
  images: [
    'https://picsum.photos/800/600?random=1',
    'https://picsum.photos/1200/800?random=2',
    'https://picsum.photos/600/900?random=3',
    'https://picsum.photos/1000/1000?random=4',
    'https://picsum.photos/1920/1080?random=5',
  ],
  gifs: [
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
    'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif',
    'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif',
    'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',
    'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
  ],
  videos: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  ],
  audio: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  ]
};

// Helper functions
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomMedia(type) {
  return getRandomItem(MEDIA_URLS[type]);
}

// Function to create a bucket
async function createBucket(name = 'Test Bucket') {
  try {
    console.log(`\n📦 Creating bucket: ${name}...`);
    const response = await fetch(`${BASE_URL}/buckets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        name: name,
        description: 'Bucket created automatically for testing',
        generateIconWithInitials: true,
        generateMagicCode: true
      })
    });

    if (response.statusCode >= 400) {
      const errorText = response.data || response.statusMessage;
      console.error('❌ Error creating bucket:', response.statusCode, response.statusMessage, errorText);
      return null;
    }

    const bucket = JSON.parse(response.data);
    console.log(`✅ Bucket created successfully: ${bucket.name} (${bucket.id})`);
    return bucket;
  } catch (error) {
    console.error('❌ Failed to create bucket:', error.message);
    return null;
  }
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

    if (response.statusCode >= 400) {
      console.error('❌ Error fetching buckets:', response.statusCode, response.statusMessage);
      return [];
    }

    const buckets = JSON.parse(response.data);
    console.log(`✅ Found ${buckets.length} buckets:`, buckets.map(b => `${b.name} (${b.id})`).join(', '));
    return buckets || [];
  } catch (error) {
    console.error('❌ Failed to fetch buckets:', error.message);
    return [];
  }
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
    title: 'Snooze 5min',
    icon: 'clock',
    destructive: false
  },
  snooze15: {
    type: 'SNOOZE',
    value: '15',
    title: 'Snooze 15min',
    icon: 'clock.fill',
    destructive: false
  },
  snooze30: {
    type: 'SNOOZE',
    value: '30',
    title: 'Snooze 30min',
    icon: 'clock.fill',
    destructive: false
  },
  snooze60: {
    type: 'SNOOZE',
    value: '60',
    title: 'Snooze 1h',
    icon: 'clock.badge',
    destructive: false
  },
  navigateGithub: {
    type: 'NAVIGATE',
    value: 'https://github.com',
    title: 'Open GitHub',
    icon: 'arrow.up.forward',
    destructive: false
  },
  navigateGoogle: {
    type: 'NAVIGATE',
    value: 'https://google.com',
    title: 'Open Google',
    icon: 'magnifyingglass',
    destructive: false
  },
  openNotification: {
    type: 'OPEN_NOTIFICATION',
    value: 'open',
    title: 'Open',
    icon: 'arrow.up.right.square',
    destructive: false
  }
};

// Genera le configurazioni delle notifiche
function generateNotifications(buckets) {
  const notifications = [];
  let counter = 1;

  // For each bucket, create notifications with different combinations
  buckets.forEach((bucket, bucketIndex) => {
    
    // 1. Single image + various actions
    notifications.push({
      title: `${counter++}. 📷 Single Image - Mark as Read`,
      body: `Testing single image attachment in ${bucket.name}`,
      subtitle: 'Image with mark as read action',
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('images'), mediaType: 'IMAGE' }
      ],
      actions: [ACTION_TEMPLATES.markAsRead]
    });

    notifications.push({
      title: `${counter++}. 📷 Single Image - Snooze Options`,
      body: `Beautiful image with snooze options in ${bucket.name}`,
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('images'), mediaType: 'IMAGE' }
      ],
      actions: [ACTION_TEMPLATES.snooze5, ACTION_TEMPLATES.snooze15, ACTION_TEMPLATES.snooze60]
    });

    notifications.push({
      title: `${counter++}. 📷 Single Image - Full Actions`,
      body: `Image with all action types in ${bucket.name}`,
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('images'), mediaType: 'IMAGE' }
      ],
      actions: [ACTION_TEMPLATES.markAsRead, ACTION_TEMPLATES.snooze15, ACTION_TEMPLATES.delete]
    });

    // 2. GIF + actions
    notifications.push({
      title: `${counter++}. 🎬 Animated GIF - Navigate`,
      body: `Funny GIF with navigation action in ${bucket.name}`,
      subtitle: 'Tap to open website',
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('gifs'), mediaType: 'GIF' }
      ],
      actions: [ACTION_TEMPLATES.navigateGithub, ACTION_TEMPLATES.markAsRead]
    });

    notifications.push({
      title: `${counter++}. 🎬 Animated GIF - Delete Only`,
      body: `GIF notification with delete action in ${bucket.name}`,
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('gifs'), mediaType: 'GIF' }
      ],
      actions: [ACTION_TEMPLATES.delete]
    });

    // 3. Video + actions
    notifications.push({
      title: `${counter++}. 🎥 Video Content - Snooze`,
      body: `Watch this video later from ${bucket.name}`,
      subtitle: 'Video notification with snooze',
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('videos'), mediaType: 'VIDEO' }
      ],
      actions: [ACTION_TEMPLATES.snooze30, ACTION_TEMPLATES.markAsRead]
    });

    notifications.push({
      title: `${counter++}. 🎥 Video Content - Open`,
      body: `Important video in ${bucket.name}`,
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('videos'), mediaType: 'VIDEO' }
      ],
      actions: [ACTION_TEMPLATES.openNotification, ACTION_TEMPLATES.delete]
    });

    // 4. Audio + actions
    notifications.push({
      title: `${counter++}. 🎵 Audio Message - Listen`,
      body: `New audio message in ${bucket.name}`,
      subtitle: 'Tap to play',
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('audio'), mediaType: 'AUDIO' }
      ],
      actions: [ACTION_TEMPLATES.markAsRead, ACTION_TEMPLATES.delete]
    });

    // 5. Multiple attachments (images)
    notifications.push({
      title: `${counter++}. 📷📷 Multiple Images - Gallery`,
      body: `Photo album from ${bucket.name}`,
      subtitle: `${Math.floor(Math.random() * 5) + 2} photos`,
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('images'), mediaType: 'IMAGE' },
        { url: getRandomMedia('images'), mediaType: 'IMAGE' },
        { url: getRandomMedia('images'), mediaType: 'IMAGE' }
      ],
      actions: [ACTION_TEMPLATES.markAsRead, ACTION_TEMPLATES.delete]
    });

    // 6. Mixed media (image + GIF)
    notifications.push({
      title: `${counter++}. 📷🎬 Mixed Media - Image & GIF`,
      body: `Mixed content from ${bucket.name}`,
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('images'), mediaType: 'IMAGE' },
        { url: getRandomMedia('gifs'), mediaType: 'GIF' }
      ],
      actions: [ACTION_TEMPLATES.snooze15, ACTION_TEMPLATES.markAsRead, ACTION_TEMPLATES.delete]
    });

    // 7. No attachments - Text only with various actions
    notifications.push({
      title: `${counter++}. 📝 Text Only - Full Actions`,
      body: `Important text message in ${bucket.name} without any media attachments`,
      subtitle: 'Text notification',
      bucketId: bucket.id,
      attachments: [],
      actions: [ACTION_TEMPLATES.markAsRead, ACTION_TEMPLATES.snooze15, ACTION_TEMPLATES.navigateGoogle, ACTION_TEMPLATES.delete]
    });

    notifications.push({
      title: `${counter++}. 📝 Text Only - No Actions`,
      body: `Simple notification from ${bucket.name} - tap to open`,
      bucketId: bucket.id,
      attachments: [],
      actions: []
    });

    // 8. Critical notification without actions (only for some buckets)
    if (bucketIndex % 2 === 0) {
      notifications.push({
        title: `${counter++}. ⚠️ Critical Alert - No Dismiss`,
        body: `Critical alert from ${bucket.name} that requires attention`,
        subtitle: 'Urgent',
        bucketId: bucket.id,
        deliveryType: 'CRITICAL',
        attachments: [
          { url: getRandomMedia('images'), mediaType: 'IMAGE' }
        ],
        actions: [ACTION_TEMPLATES.openNotification]
      });
    }

    // 9. Silent notification
    if (bucketIndex % 3 === 0) {
      notifications.push({
        title: `${counter++}. 🔕 Silent Update`,
        body: `Background sync completed for ${bucket.name}`,
        bucketId: bucket.id,
        deliveryType: 'SILENT',
        attachments: [],
        actions: [ACTION_TEMPLATES.markAsRead]
      });
    }

    // 10. Rich content with many actions
    notifications.push({
      title: `${counter++}. 🎯 Rich Content - All Options`,
      body: `Complete notification from ${bucket.name} with all features`,
      subtitle: 'Full featured notification',
      bucketId: bucket.id,
      attachments: [
        { url: getRandomMedia('images'), mediaType: 'IMAGE' },
        { url: getRandomMedia('gifs'), mediaType: 'GIF' },
        { url: getRandomMedia('videos'), mediaType: 'VIDEO' }
      ],
      actions: [
        ACTION_TEMPLATES.openNotification,
        ACTION_TEMPLATES.markAsRead,
        ACTION_TEMPLATES.snooze30,
        ACTION_TEMPLATES.delete
      ]
    });
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

    if (response.statusCode >= 400) {
      const errorText = response.data || response.statusMessage;
      console.error(`❌ Error sending notification ${index + 1}/${total}:`, response.statusCode, response.statusMessage, errorText);
      return false;
    }

    const result = JSON.parse(response.data);
    const attachmentInfo = config.attachments.length > 0 
      ? ` [${config.attachments.map(a => a.mediaType).join(', ')}]` 
      : '';
    const actionInfo = config.actions.length > 0 
      ? ` {${config.actions.length} actions}` 
      : ' {no actions}';
    
    console.log(`✅ ${index + 1}/${total} sent:${attachmentInfo}${actionInfo} - ${config.title.substring(0, 50)}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send notification ${index + 1}/${total}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting comprehensive notification test...');
  console.log('━'.repeat(80));
  
  // Step 1: Use default bucket ID if specified, otherwise fetch buckets
  let buckets = [];
  
  if (DEFAULT_BUCKET_ID) {
    console.log(`\n📦 STEP 1: Using specified bucket ID: ${DEFAULT_BUCKET_ID}`);
    // Try to fetch bucket info, but use default ID even if fetch fails
    const allBuckets = await fetchBuckets();
    const foundBucket = allBuckets.find(b => b.id === DEFAULT_BUCKET_ID);
    if (foundBucket) {
      buckets = [foundBucket];
      console.log(`✅ Found bucket: ${foundBucket.name} (${foundBucket.id})`);
    } else {
      buckets = [{ id: DEFAULT_BUCKET_ID, name: 'Specified Test Bucket' }];
      console.log(`⚠️  Bucket not found in list, but will use ID: ${DEFAULT_BUCKET_ID}`);
    }
  } else {
    console.log('\n📦 STEP 1: Fetching available buckets...');
    buckets = await fetchBuckets();

    // If no buckets found, create one automatically
    if (buckets.length === 0) {
      console.log('\n⚠️  No buckets found. Creating a test bucket...');
      const newBucket = await createBucket('Test Notifications');
      
      if (newBucket) {
        buckets = [newBucket];
        console.log('✅ Using newly created bucket for testing');
      } else {
        console.error('\n❌ Failed to create bucket. Please create at least one bucket manually.');
        console.log('💡 You can create buckets via the API or admin interface.');
        process.exit(1);
      }
    }
  }

  console.log(`✅ Successfully loaded ${buckets.length} bucket(s)`);
  buckets.forEach((bucket, i) => {
    console.log(`   ${i + 1}. ${bucket.name} (ID: ${bucket.id})`);
  });

  // Step 2: Generate notifications
  console.log('━'.repeat(80));
  console.log('📋 STEP 2: Generating test notifications...');
  const notifications = generateNotifications(buckets);
  console.log(`✅ Generated ${notifications.length} test notifications`);
  
  // Statistics
  const stats = {
    withImages: notifications.filter(n => n.attachments.some(a => a.mediaType === 'IMAGE')).length,
    withGifs: notifications.filter(n => n.attachments.some(a => a.mediaType === 'GIF')).length,
    withVideos: notifications.filter(n => n.attachments.some(a => a.mediaType === 'VIDEO')).length,
    withAudio: notifications.filter(n => n.attachments.some(a => a.mediaType === 'AUDIO')).length,
    textOnly: notifications.filter(n => n.attachments.length === 0).length,
    withActions: notifications.filter(n => n.actions.length > 0).length,
    noActions: notifications.filter(n => n.actions.length === 0).length,
    multipleAttachments: notifications.filter(n => n.attachments.length > 1).length
  };

  console.log('\n📊 Notification breakdown:');
  console.log(`   📷 With images: ${stats.withImages}`);
  console.log(`   🎬 With GIFs: ${stats.withGifs}`);
  console.log(`   🎥 With videos: ${stats.withVideos}`);
  console.log(`   🎵 With audio: ${stats.withAudio}`);
  console.log(`   📝 Text only: ${stats.textOnly}`);
  console.log(`   🔗 Multiple attachments: ${stats.multipleAttachments}`);
  console.log(`   ⚡ With actions: ${stats.withActions}`);
  console.log(`   ⭕ No actions: ${stats.noActions}`);

  // Step 3: Send notifications
  console.log('━'.repeat(80));
  console.log('📤 STEP 3: Sending notifications...');

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
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Final summary
  console.log('━'.repeat(80));
  console.log('📊 FINAL SUMMARY:');
  console.log(`   ✅ Successfully sent: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📱 Total notifications: ${notifications.length}`);
  console.log(`   📦 Buckets used: ${buckets.length}`);
  
  const successRate = ((successCount / notifications.length) * 100).toFixed(1);
  console.log(`   📈 Success rate: ${successRate}%`);
  console.log('━'.repeat(80));
  console.log('✨ Test completed! Check your device for notifications.');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Script failed with error:', error);
  console.error(error.stack);
  process.exit(1);
});
