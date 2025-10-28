import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScopesToSystemAccessTokens1738101000000 implements MigrationInterface {
  name = 'AddScopesToSystemAccessTokens1738101000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add scopes column as text[] with default empty array on Postgres
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='system_access_tokens' AND column_name='scopes'
        ) THEN
          ALTER TABLE system_access_tokens ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_system_access_tokens_scopes ON system_access_tokens USING GIN (scopes);
    `);

    // Add requesterIdentifier column (stable identifier: IP/hostname/fingerprint) with index
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='system_access_tokens' AND column_name='requesterIdentifier'
        ) THEN
          ALTER TABLE system_access_tokens ADD COLUMN "requesterIdentifier" TEXT NULL;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_system_access_tokens_requester_identifier ON system_access_tokens("requesterIdentifier");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_system_access_tokens_scopes;
    `);
    await queryRunner.query(`
      ALTER TABLE system_access_tokens DROP COLUMN IF EXISTS scopes;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_system_access_tokens_requester_identifier;
    `);
    await queryRunner.query(`
      ALTER TABLE system_access_tokens DROP COLUMN IF EXISTS "requesterIdentifier";
    `);
  }
}


