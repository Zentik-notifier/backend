import 'reflect-metadata';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
  process.env.JWT_REFRESH_TOKEN_EXPIRATION = '7d';

  // Database configuration for tests
  process.env.DB_TYPE = 'sqlite';
  process.env.DB_DATABASE = ':memory:';
  process.env.DB_SYNCHRONIZE = 'true';

  // Push notification test configuration
  process.env.PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED = 'false';
  process.env.PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER = '';
  process.env.PUSH_PASSTHROUGH_TOKEN = '';

  // Attachments configuration
  process.env.ATTACHMENTS_STORAGE_PATH = './test-storage';
  process.env.ATTACHMENTS_MAX_FILE_SIZE = '10485760';
  process.env.ATTACHMENTS_ALLOWED_MIME_TYPES =
    'image/jpeg,image/png,image/gif,video/mp4,audio/mpeg,application/pdf,text/plain';

  // Messages configuration
  process.env.MESSAGES_MAX_AGE = '0';
});

afterAll(() => {
  // Clean up after all tests
  jest.clearAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
