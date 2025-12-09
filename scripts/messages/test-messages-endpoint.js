const request = require('supertest');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

if (!BUCKET_ID) {
  console.error('❌ BUCKET_ID environment variable is required');
  process.exit(1);
}

async function runTests() {
  console.log(`\n🧪 Testing Messages Endpoint (${BASE_URL}/messages)...`);
  
  const agent = request(BASE_URL);

  try {
    // 1. JSON Request
    console.log('\n1️⃣  Testing JSON Request...');
    const jsonRes = await agent
      .post('/messages')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        title: 'JSON Test',
        body: 'This is a JSON test message',
        priority: 'high',
        bucketId: BUCKET_ID,
        deliveryType: 'NORMAL'
      })
      .expect(201);
    
    console.log('   ✅ JSON Request passed');
    // console.log('   Response:', jsonRes.body);

    // 2. Multipart Request with File
    console.log('\n2️⃣  Testing Multipart Request with File...');
    const filePath = path.join(__dirname, '../../assets/Zentik.png');
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`Test asset not found at ${filePath}`);
    }

    // Note: bucketId must be in query for multipart requests because Guards run before FileInterceptor
    try {
      const fileRes = await agent
        .post(`/messages/with-attachment?bucketId=${BUCKET_ID}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .field('title', 'Multipart File Test')
        .field('body', 'This is a multipart test with file')
        .field('deliveryType', 'NORMAL')
        .field('bucketId', BUCKET_ID)
        .field('attachmentOptions', JSON.stringify({ mediaType: 'IMAGE' }))
        .attach('file', filePath);

      if (fileRes.status !== 201) {
        console.error('   ❌ Multipart Request with File failed');
        console.error('   Status:', fileRes.status);
        console.error('   Body:', JSON.stringify(fileRes.body, null, 2));
        process.exit(1);
      }
      console.log('   ✅ Multipart Request with File passed');
    } catch (err) {
      throw err;
    }

    // 3. URL Encoded Request
    console.log('\n3️⃣  Testing URL Encoded Request...');
    const urlEncodedRes = await agent
      .post('/messages')
      .set('Authorization', `Bearer ${TOKEN}`)
      .type('form')
      .send({
        title: 'URL Encoded Test',
        body: 'This is a URL encoded test message',
        bucketId: BUCKET_ID,
        deliveryType: 'NORMAL'
      })
      .expect(201);

    console.log('   ✅ URL Encoded Request passed');
    // console.log('   Response:', urlEncodedRes.body);

    // 4. Headers Mapping
    console.log('\n4️⃣  Testing Headers Mapping...');
    const headerRes = await agent
      .post('/messages')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('x-message-title', 'Header Title')
      .set('x-message-body', 'Header Body')
      .set('x-message-priority', 'low')
      .send({
        bucketId: BUCKET_ID,
        deliveryType: 'NORMAL'
      }) // Empty body, should take from headers
      .expect(201);

    console.log('   ✅ Headers Mapping passed');
    // console.log('   Response:', headerRes.body);

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Body:', error.response.body);
    }
    process.exit(1);
  }
}

runTests();
