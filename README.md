# Zentik Backend

Zentik is a modern platform for managing notifications, messages, and real-time communications. This repository contains the backend of the platform, built with NestJS, TypeORM, and GraphQL.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Core Modules](#core-modules)
  - [Attachments System](#attachments-system)
  - [Push Notifications](#push-notifications)
  - [Messages & Notifications](#messages--notifications)
  - [OAuth Providers](#oauth-providers)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## 🔍 Overview

Zentik is a platform for managing notifications and real-time communications, designed to be extensible, scalable, and secure. The backend is built with NestJS and provides REST and GraphQL APIs for interaction with mobile and web clients.

### Key Features:

- **Multi-platform notification management**: iOS (APNs), Android (FCM), and Web (WebPush)
- **Multimedia attachments support**: images, videos, audio
- **Advanced authentication system**: JWT, OAuth, and system tokens
- **GraphQL and REST APIs**: complete support for both paradigms
- **Modular architecture**: easily extensible and customizable

## 🧰 Prerequisites

- Node.js (v16+)
- PostgreSQL (v13+)

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/zentik.git
cd zentik/backend

# Install dependencies
npm install

# Copy the example .env file
cp .env.example .env

# Edit the .env file with your configurations

# Start the server in development mode
npm run start:dev
```

## ⚙️ Configuration

The backend configuration is done primarily through environment variables. Copy the `.env.example` file to `.env` and customize the variables according to your needs.

### Main environment variables:

```
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=zentik

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=1d

# Attachments
ATTACHMENTS_MAX_AGE=30d
ATTACHMENTS_DELETE_CRON_JOB=0 0 * * * *

# Push Notifications
PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED=false
APN_KEY_ID=your_apn_key_id
APN_TEAM_ID=your_apn_team_id
APN_PRIVATE_KEY_PATH=./keys/apn-key.p8
APN_BUNDLE_ID=com.example.zentik
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 📦 Core Modules

### Messages & Notifications

The messages module provides a flexible API for creating and managing notifications with support for multiple content types and data sources.

#### Flexible Message Creation

The main message creation endpoint (`POST /messages`) now supports multiple content types and data sources, allowing you to combine data from different sources in a single request.

**Supported Content Types:**
- `application/json` - JSON payload in request body
- `application/x-www-form-urlencoded` - Form data in request body
- `text/plain` - Plain text in request body

**Data Source Priority (highest to lowest):**
1. **Headers** (`x-message-*`) - Highest precedence
2. **Path Parameters** - Second highest precedence
3. **Query Parameters** - Third highest precedence
4. **Request Body** - Lowest precedence

**Example Usage:**

```bash
# Headers only
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-message-title: Hello World" \
  -H "x-message-body: This is a test message" \
  -H "x-message-bucket-id: bucket-123" \
  -H "x-message-delivery-type: NORMAL"

# Mixed sources (Body + Headers)
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-message-subtitle: Override from header" \
  -H "x-message-sound: custom-sound.wav" \
  -d '{
    "title": "Hello World",
    "body": "This is a test message",
    "bucketId": "bucket-123",
    "deliveryType": "NORMAL"
  }'
```

For complete documentation, see [README-flexible-endpoint.md](src/messages/README-flexible-endpoint.md).

### Attachments System

The attachments management module allows you to upload, store, and manage multimedia files associated with messages.

#### Cleanup Configuration

Attachments can be configured to be automatically deleted after a certain period of time. This is useful for saving storage space and complying with data retention policies.

```env
# Maximum attachment retention time
# Supported formats: number (seconds), Xs (seconds), Xm (minutes), Xh (hours), Xd (days)
ATTACHMENTS_MAX_AGE=30d

# Cleanup job schedule (cron format)
# Default: every hour
ATTACHMENTS_DELETE_CRON_JOB=0 0 * * * *
```

The `AttachmentsCleanupScheduler` service manages automatic attachment cleanup based on the configuration:

### Push Notifications

Zentik supports sending push notifications to iOS devices (APNs), Android devices (FCM), and web browsers (WebPush).

#### Local Configuration

To send notifications directly from the server:

```env
# Disable passthrough
PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED=false

# APNs configuration for iOS
APN_KEY_ID=your_apn_key_id
APN_TEAM_ID=your_apn_team_id
APN_PRIVATE_KEY_PATH=./keys/apn-key.p8
APN_BUNDLE_ID=com.example.zentik
APN_PRODUCTION=true  # false for development environment

# Firebase configuration for Android
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

#### Passthrough Configuration

To delegate notification sending to an external server:

```env
# Enable passthrough
PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED=true
PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER=https://your-push-server.com
PUSH_PASSTHROUGH_TOKEN=your_auth_token
```

#### iOS Encryption

For iOS devices, Zentik supports end-to-end encryption of notification payloads:

1. The iOS device generates an RSA key pair
2. The public key is sent to the server during device registration
3. The server encrypts sensitive notification data with the public key
4. Only the target device can decrypt the content with its private key

```swift
// Example iOS decryption (see docs/ios-client-decryption.swift)
func decryptNotificationContent(encryptedData: String) -> NotificationContent? {
    guard let privateKey = loadPrivateKey() else { return nil }
    
    // Decrypt using the device's private key
    let decryptedData = RSAUtils.decrypt(encryptedData, with: privateKey)
    
    // Parse the decrypted JSON
    return try? JSONDecoder().decode(NotificationContent.self, from: decryptedData)
}
```

### Messages & Notifications

The messages and notifications system is the heart of Zentik. Messages are content created by users, while notifications are delivery instances of messages to specific devices.

#### Message Lifecycle

Messages have a configurable lifecycle and can be automatically deleted when they are no longer needed:

```env
# Message cleanup job schedule (cron format)
MESSAGES_DELETE_CRON_JOB=0 0 * * * *
```

The `MessagesCleanupScheduler` service manages automatic cleanup of messages that have been completely read by all recipients:

```typescript
async handleCleanup() {
  this.logger.log('Cron started: delete fully-read messages');
  try {
    const { deletedMessages } = await this.messagesService.deleteMessagesFullyRead();
    this.logger.log(`Cron completed: deleted ${deletedMessages} message(s)`);
  } catch (error) {
    this.logger.error('Cron failed', error as any);
  }
}
```

#### Notifications with Attachments

Notifications can include multimedia attachments. The system supports:

- Images (JPEG, PNG, GIF)
- Videos (MP4, MOV)
- Audio (MP3, WAV)
- Documents (PDF, DOCX)

### OAuth Providers

Zentik supports authentication through various OAuth providers, with dynamic configuration via database.

#### Predefined Providers

The system automatically initializes the most common OAuth providers:

- GitHub
- Google

#### Custom Providers

You can configure custom OAuth providers through the administration interface.

## 📚 API Documentation

The API documentation is available in OpenAPI/Swagger and GraphQL Schema formats:

- REST API: `/api/docs` (in development)
- GraphQL Playground: `/graphql` (in development)
- GraphQL Schema: `/schema.gql`

## 📄 License

This project is licensed under the terms of the [MIT License](LICENSE).
