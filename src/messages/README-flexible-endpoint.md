# Flexible Message Creation Endpoint

The main message creation endpoint (`POST /messages`) now supports multiple content types and data sources, allowing you to combine data from different sources in a single request.

## Supported Content Types

- `application/json` - JSON payload in request body
- `application/x-www-form-urlencoded` - Form data in request body
- `text/plain` - Plain text in request body

## Data Source Priority

Data sources are combined in the following order of precedence (highest to lowest):

1. **Headers** (`x-message-*`) - Highest precedence
2. **Path Parameters** - Second highest precedence
3. **Query Parameters** - Third highest precedence
4. **Request Body** - Lowest precedence

## Usage Examples

### 1. JSON Body Only (Traditional)
```bash
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World",
    "body": "This is a test message",
    "bucketId": "bucket-123",
    "deliveryType": "IMMEDIATE"
  }'
```

### 2. Headers Only
```bash
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-message-title: Hello World" \
  -H "x-message-body: This is a test message" \
  -H "x-message-bucket-id: bucket-123" \
  -H "x-message-delivery-type: NORMAL"
```

### 3. Query Parameters Only
```bash
curl -X POST "http://localhost:3000/messages?title=Hello%20World&body=This%20is%20a%20test%20message&bucketId=bucket-123&deliveryType=NORMAL" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Mixed Sources (Body + Headers)
```bash
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-message-subtitle: Override from header" \
  -H "x-message-sound: custom-sound.wav" \
  -d '{
    "title": "Hello World",
    "body": "This is a test message",
    "bucketId": "bucket-123",
    "deliveryType": "NORMAL",
    "subtitle": "This will be overridden"
  }'
```

### 5. Form Data + Headers
```bash
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "x-message-sound: notification.wav" \
  -d "title=Hello%20World&body=Test%20message&bucketId=bucket-123&deliveryType=NORMAL"
```

### 6. Complex Objects via Headers
```bash
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-message-title: Message with Actions" \
  -H "x-message-bucket-id: bucket-123" \
  -H "x-message-delivery-type: NORMAL" \
  -H "x-message-actions: [{\"type\":\"NAVIGATE\",\"value\":\"https://example.com\",\"destructive\":false,\"icon\":\"link\",\"title\":\"Open Link\"}]" \
  -H "x-message-attachments: [{\"mediaType\":\"IMAGE\",\"name\":\"image.jpg\",\"url\":\"https://example.com/image.jpg\"}]"
```

## Header Naming Convention

All message-related headers must start with `x-message-` followed by the field name in kebab-case:

- `x-message-title` → `title`
- `x-message-bucket-id` → `bucketId`
- `x-message-delivery-type` → `deliveryType`
- `x-message-add-mark-as-read-action` → `addMarkAsReadAction`

## Data Type Handling

### Booleans
Boolean values in headers and query parameters are automatically converted:
- `"true"`, `"1"`, `"yes"` → `true`
- `"false"`, `"0"`, `"no"` → `false`

### Arrays
Array values can be provided as comma-separated strings:
- `"5,15,30"` → `[5, 15, 30]`

### Complex Objects
Complex objects (attachments, actions, tapAction) can be provided as JSON strings in headers or query parameters.

## Validation

The endpoint uses the same validation rules as the traditional JSON endpoint. All required fields must be provided from at least one data source.

## Benefits

1. **Flexibility**: Choose the most convenient data source for your use case
2. **Integration**: Easy integration with systems that prefer different data formats
3. **Override Capability**: Use headers to override specific fields from the body
4. **Content Type Support**: Works with various content types and data formats
5. **Backward Compatibility**: Existing JSON-only implementations continue to work

## Error Handling

- **400 Bad Request**: Invalid data or missing required fields
- **401 Unauthorized**: Missing or invalid authentication token
- **500 Internal Server Error**: Server-side processing error

## Notes

- Headers take the highest precedence and can override any data from other sources
- The endpoint automatically handles type conversions for common data types
- Complex objects should be provided as JSON strings when using headers or query parameters
- All existing message creation logic and validation rules are preserved