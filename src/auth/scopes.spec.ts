import {
  AccessTokenScope,
  canCreateMessageInBucket,
  createMessageBucketScope,
  isValidScope
} from './dto/auth.dto';

describe('Access Token Scopes', () => {
  describe('canCreateMessageInBucket', () => {
    describe('Token with specific bucket scope', () => {
      it('should allow message creation in the specified bucket', () => {
        const tokenScopes = [createMessageBucketScope('bucket-123')];

        expect(canCreateMessageInBucket(tokenScopes, 'bucket-123')).toBe(true);
      });

      it('should deny message creation in a different bucket', () => {
        const tokenScopes = [createMessageBucketScope('bucket-123')];

        expect(canCreateMessageInBucket(tokenScopes, 'bucket-456')).toBe(false);
      });

      it('should deny message creation in any other bucket', () => {
        const tokenScopes = [createMessageBucketScope('bucket-123')];

        // Try different bucket IDs
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-456')).toBe(false);
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-789')).toBe(false);
        expect(canCreateMessageInBucket(tokenScopes, 'prod-bucket')).toBe(false);
      });

      it('should support multiple bucket scopes', () => {
        const tokenScopes = [
          createMessageBucketScope('bucket-123'),
          createMessageBucketScope('bucket-456'),
        ];

        // Can create in bucket-123
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-123')).toBe(true);

        // Can create in bucket-456
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-456')).toBe(true);

        // Cannot create in bucket-789
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-789')).toBe(false);
      });
    });

    describe('Token with empty scopes (admin)', () => {
      it('should allow message creation in any bucket with empty array', () => {
        const tokenScopes: string[] = [];

        expect(canCreateMessageInBucket(tokenScopes, 'bucket-123')).toBe(true);
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-456')).toBe(true);
        expect(canCreateMessageInBucket(tokenScopes, 'bucket-789')).toBe(true);
        expect(canCreateMessageInBucket(tokenScopes, 'any-bucket-id')).toBe(true);
      });

      it('should allow all operations with empty scopes', () => {
        const tokenScopes: string[] = [];

        // Create in different buckets
        expect(canCreateMessageInBucket(tokenScopes, 'ci-bucket')).toBe(true);
        expect(canCreateMessageInBucket(tokenScopes, 'prod-bucket')).toBe(true);
        expect(canCreateMessageInBucket(tokenScopes, 'test-bucket')).toBe(true);
      });
    });

    describe('Token with invalid scopes', () => {
      it('should deny message creation with invalid scope format', () => {
        const tokenScopes = ['invalid-scope'];

        expect(canCreateMessageInBucket(tokenScopes, 'bucket-123')).toBe(false);
      });

      it('should deny message creation with wrong bucket scope', () => {
        const tokenScopes = ['message-bucket-creation:wrong-bucket'];

        expect(canCreateMessageInBucket(tokenScopes, 'bucket-123')).toBe(false);
      });
    });
  });

  describe('createMessageBucketScope', () => {
    it('should create correctly scoped token for bucket', () => {
      const scope = createMessageBucketScope('bucket-123');
      expect(scope).toBe('message-bucket-creation:bucket-123');
    });

    it('should create scoped token for different bucket IDs', () => {
      expect(createMessageBucketScope('bucket-1')).toBe('message-bucket-creation:bucket-1');
      expect(createMessageBucketScope('ci-bucket')).toBe('message-bucket-creation:ci-bucket');
      expect(createMessageBucketScope('prod-bucket')).toBe('message-bucket-creation:prod-bucket');
    });
  });

  describe('isValidScope', () => {
    it('should validate message bucket creation scopes', () => {
      expect(isValidScope('message-bucket-creation:bucket-123')).toBe(true);
      expect(isValidScope('message-bucket-creation:bucket-456')).toBe(true);
      expect(isValidScope('message-bucket-creation:any-bucket-id')).toBe(true);
    });

    it('should reject invalid scopes', () => {
      expect(isValidScope('invalid')).toBe(false);
      expect(isValidScope('admin')).toBe(false); // Admin is represented by empty array, not a scope
      expect(isValidScope('messages')).toBe(false);
      expect(isValidScope('buckets')).toBe(false);
      expect(isValidScope('message-bucket-creation')).toBe(false); // Missing bucket ID
      expect(isValidScope('message-bucket-creation:bucket-123:extra')).toBe(false); // Too many parts
      expect(isValidScope('')).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('CI/CD token with specific bucket access', () => {
      const tokenScopes = [createMessageBucketScope('ci-bucket')];

      // Can send messages to ci-bucket
      expect(canCreateMessageInBucket(tokenScopes, 'ci-bucket')).toBe(true);

      // Cannot send messages to production bucket
      expect(canCreateMessageInBucket(tokenScopes, 'prod-bucket')).toBe(false);

      // Cannot send messages to dev bucket
      expect(canCreateMessageInBucket(tokenScopes, 'dev-bucket')).toBe(false);
    });

    it('Production webhook token with production bucket only', () => {
      const tokenScopes = [createMessageBucketScope('prod-alerts')];

      // Can send to prod-alerts
      expect(canCreateMessageInBucket(tokenScopes, 'prod-alerts')).toBe(true);

      // Cannot send to other buckets
      expect(canCreateMessageInBucket(tokenScopes, 'dev-alerts')).toBe(false);
      expect(canCreateMessageInBucket(tokenScopes, 'test-alerts')).toBe(false);
    });

    it('Admin token (empty scopes) for internal automation', () => {
      const tokenScopes: string[] = [];

      // Can send to any bucket
      expect(canCreateMessageInBucket(tokenScopes, 'ci-bucket')).toBe(true);
      expect(canCreateMessageInBucket(tokenScopes, 'prod-bucket')).toBe(true);
      expect(canCreateMessageInBucket(tokenScopes, 'dev-bucket')).toBe(true);
      expect(canCreateMessageInBucket(tokenScopes, 'any-bucket')).toBe(true);
    });

    it('Multi-environment token with multiple bucket scopes', () => {
      const tokenScopes = [
        createMessageBucketScope('staging-alerts'),
        createMessageBucketScope('dev-alerts'),
      ];

      // Can send to staging and dev
      expect(canCreateMessageInBucket(tokenScopes, 'staging-alerts')).toBe(true);
      expect(canCreateMessageInBucket(tokenScopes, 'dev-alerts')).toBe(true);

      // Cannot send to production
      expect(canCreateMessageInBucket(tokenScopes, 'prod-alerts')).toBe(false);
    });
  });
});

