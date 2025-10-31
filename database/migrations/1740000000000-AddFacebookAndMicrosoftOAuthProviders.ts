import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add FACEBOOK and MICROSOFT to oauth_provider_type_enum
 */
export class AddFacebookAndMicrosoftOAuthProviders1740000000000 implements MigrationInterface {
  name = 'AddFacebookAndMicrosoftOAuthProviders1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add FACEBOOK and MICROSOFT to oauth_provider_type_enum (idempotent)
    await queryRunner.query(`DO $$
    BEGIN
      BEGIN ALTER TYPE "oauth_provider_type_enum" ADD VALUE 'FACEBOOK'; EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN ALTER TYPE "oauth_provider_type_enum" ADD VALUE 'MICROSOFT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values directly
    // This would require recreating the enum without the values
    // For safety, we'll leave the migration as non-reversible
  }
}

