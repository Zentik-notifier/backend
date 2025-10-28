import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemAccessTokenRequests1738100000000 implements MigrationInterface {
  name = 'CreateSystemAccessTokenRequests1738100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for status if not exists (PostgreSQL)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_access_token_request_status') THEN
          CREATE TYPE system_access_token_request_status AS ENUM ('pending', 'approved', 'declined');
        END IF;
      END$$;
    `);

    // Create table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_access_token_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "systemAccessTokenId" UUID NULL REFERENCES system_access_tokens(id) ON DELETE SET NULL,
        "plainTextToken" TEXT NULL,
        "maxRequests" INTEGER NOT NULL,
        status system_access_token_request_status NOT NULL DEFAULT 'pending',
        description TEXT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_satr_user_id ON system_access_token_requests("userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_satr_token_id ON system_access_token_requests("systemAccessTokenId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_satr_status ON system_access_token_requests(status);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_satr_created_at ON system_access_token_requests("createdAt");
    `);

    // Ensure updatedAt trigger exists on table (requires update_updated_at_column function from previous migrations)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_system_access_token_requests_updated_at'
        ) THEN
          CREATE TRIGGER update_system_access_token_requests_updated_at
          BEFORE UPDATE ON system_access_token_requests
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_system_access_token_requests_updated_at ON system_access_token_requests;
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS system_access_token_requests;
    `);

    // Drop enum type if exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_access_token_request_status') THEN
          DROP TYPE system_access_token_request_status;
        END IF;
      END$$;
    `);
  }
}


