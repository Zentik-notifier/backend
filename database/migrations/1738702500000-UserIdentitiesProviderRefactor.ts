import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Merge of prior steps:
 * - Ensure oauth_provider_type_enum exists and includes DISCORD/APPLE/APPLE_SIGNIN
 * - Add providerType enum column to user_identities (if missing)
 * - Backfill providerType from legacy text provider
 * - Drop unique(provider, providerId) if exists and drop providerId
 * - Add unique(userId, providerType)
 * - Drop legacy provider text column
 */
export class UserIdentitiesProviderRefactor1738702500000 implements MigrationInterface {
  name = 'UserIdentitiesProviderRefactor1738702500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ensure enum exists and contains required labels (idempotent)
    await queryRunner.query(`DO $$
    BEGIN
      BEGIN
        CREATE TYPE oauth_provider_type_enum AS ENUM ('GITHUB', 'GOOGLE', 'DISCORD', 'APPLE', 'APPLE_SIGNIN', 'LOCAL', 'CUSTOM');
      EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN ALTER TYPE "oauth_provider_type_enum" ADD VALUE 'DISCORD'; EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN ALTER TYPE "oauth_provider_type_enum" ADD VALUE 'APPLE'; EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN ALTER TYPE "oauth_provider_type_enum" ADD VALUE 'APPLE_SIGNIN'; EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN ALTER TYPE "oauth_provider_type_enum" ADD VALUE 'LOCAL'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END$$;`);

    // 2) Add providerType column if not exists
    await queryRunner.query(
      `ALTER TABLE "user_identities" ADD COLUMN IF NOT EXISTS "providerType" oauth_provider_type_enum NULL`
    );

    // 2b) Add metadata column if not exists
    await queryRunner.query(
      `ALTER TABLE "user_identities" ADD COLUMN IF NOT EXISTS "metadata" text NULL`
    );

    // 3) Backfill providerType from legacy text provider when null (only if legacy column exists)
    await queryRunner.query(`DO $$
    DECLARE col_exists BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_identities' AND column_name='provider'
      ) INTO col_exists;
      IF col_exists THEN
        UPDATE "user_identities" SET "providerType" = CASE lower(provider)
          WHEN 'github' THEN 'GITHUB'::oauth_provider_type_enum
          WHEN 'google' THEN 'GOOGLE'::oauth_provider_type_enum
          WHEN 'discord' THEN 'DISCORD'::oauth_provider_type_enum
          WHEN 'apple' THEN 'APPLE'::oauth_provider_type_enum
          WHEN 'apple_signin' THEN 'APPLE_SIGNIN'::oauth_provider_type_enum
          WHEN 'custom' THEN 'CUSTOM'::oauth_provider_type_enum
          ELSE "providerType" END
        WHERE "providerType" IS NULL AND provider IS NOT NULL;
      END IF;
    END$$;`);

    // 4) Drop unique (provider, providerId) if exists
    await queryRunner.query(`DO $$
    DECLARE cname text;
    BEGIN
      SELECT conname INTO cname FROM pg_constraint 
      WHERE conrelid = 'user_identities'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%(provider, providerId)%';
      IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE "user_identities" DROP CONSTRAINT %I', cname); END IF;
    END$$;`);

    // 5) Drop providerId column if exists
    await queryRunner.query(`ALTER TABLE "user_identities" DROP COLUMN IF EXISTS "providerId"`);

    // 6) Add unique on (userId, providerType) if missing (check by name)
    await queryRunner.query(`DO $$
    DECLARE cname text;
    BEGIN
      SELECT conname INTO cname FROM pg_constraint 
      WHERE conrelid = 'user_identities'::regclass AND conname = 'user_identities_user_provider_type_unique';
      IF cname IS NULL THEN
        EXECUTE 'ALTER TABLE "user_identities" ADD CONSTRAINT user_identities_user_provider_type_unique UNIQUE ("userId", "providerType")';
      END IF;
    END$$;`);

    // 7) Drop legacy provider text column if exists
    await queryRunner.query(`ALTER TABLE "user_identities" DROP COLUMN IF EXISTS provider`);

    // 8) Drop legacy index on provider if exists
    await queryRunner.query(`DO $$
    DECLARE idx TEXT;
    BEGIN
      SELECT indexname INTO idx FROM pg_indexes WHERE tablename='user_identities' AND indexname='idx_user_identities_provider';
      IF idx IS NOT NULL THEN EXECUTE 'DROP INDEX ' || idx; END IF;
    END$$;`);

    // 9) Normalize existing user_sessions.loginProvider values to enum labels (idempotent)
    // First try enum-style update (works if column already enum), swallow errors if not
    await queryRunner.query(`DO $$
    BEGIN
      BEGIN
        UPDATE "user_sessions" SET "loginProvider" = CASE lower(COALESCE("loginProvider"::text, ''))
          WHEN 'github' THEN 'GITHUB'::oauth_provider_type_enum
          WHEN 'google' THEN 'GOOGLE'::oauth_provider_type_enum
          WHEN 'discord' THEN 'DISCORD'::oauth_provider_type_enum
          WHEN 'apple' THEN 'APPLE'::oauth_provider_type_enum
          WHEN 'applemobile' THEN 'APPLE_SIGNIN'::oauth_provider_type_enum
          WHEN 'apple_signin' THEN 'APPLE_SIGNIN'::oauth_provider_type_enum
          WHEN 'local' THEN 'LOCAL'::oauth_provider_type_enum
          WHEN 'custom' THEN 'CUSTOM'::oauth_provider_type_enum
          ELSE NULL END;
      EXCEPTION WHEN others THEN
        -- Fallback: if column is still varchar, just uppercase normalized values
        UPDATE "user_sessions" SET "loginProvider" = CASE lower(COALESCE("loginProvider", ''))
          WHEN 'github' THEN 'GITHUB'
          WHEN 'google' THEN 'GOOGLE'
          WHEN 'discord' THEN 'DISCORD'
          WHEN 'apple' THEN 'APPLE'
          WHEN 'applemobile' THEN 'APPLE_SIGNIN'
          WHEN 'apple_signin' THEN 'APPLE_SIGNIN'
          WHEN 'local' THEN 'LOCAL'
          WHEN 'custom' THEN 'CUSTOM'
          ELSE NULL END;
      END;
    END$$;`);

    // 10) Convert user_sessions.loginProvider column to enum type with mapping (idempotent)
    try {
      await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "loginProvider" TYPE oauth_provider_type_enum USING (
        CASE lower(COALESCE("loginProvider", ''))
          WHEN 'github' THEN 'GITHUB'::oauth_provider_type_enum
          WHEN 'google' THEN 'GOOGLE'::oauth_provider_type_enum
          WHEN 'discord' THEN 'DISCORD'::oauth_provider_type_enum
          WHEN 'apple' THEN 'APPLE'::oauth_provider_type_enum
          WHEN 'applemobile' THEN 'APPLE_SIGNIN'::oauth_provider_type_enum
          WHEN 'apple_signin' THEN 'APPLE_SIGNIN'::oauth_provider_type_enum
          WHEN 'local' THEN 'LOCAL'::oauth_provider_type_enum
          WHEN 'custom' THEN 'CUSTOM'::oauth_provider_type_enum
          ELSE NULL END
      )`);
    } catch (e) {
      // ignore if already enum
    }

    // 11) oauth_providers: drop providerId column and related unique constraints if present
    await queryRunner.query(`DO $$
    DECLARE cname text;
    BEGIN
      FOR cname IN
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'oauth_providers'::regclass
          AND contype = 'u'
          AND (pg_get_constraintdef(oid) LIKE '%(providerid)%' OR pg_get_constraintdef(oid) LIKE '%(type, providerid)%')
      LOOP
        EXECUTE format('ALTER TABLE "oauth_providers" DROP CONSTRAINT %I', cname);
      END LOOP;
    END$$;`);
    await queryRunner.query(`ALTER TABLE "oauth_providers" DROP COLUMN IF EXISTS "providerId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best effort: re-add provider text and providerId and drop new unique
    await queryRunner.query(`ALTER TABLE "user_identities" ADD COLUMN IF NOT EXISTS provider VARCHAR(50)`);
    await queryRunner.query(`ALTER TABLE "user_identities" ADD COLUMN IF NOT EXISTS "providerId" text`);
    await queryRunner.query(`DO $$
    BEGIN
      BEGIN
        ALTER TABLE "user_identities" DROP CONSTRAINT IF EXISTS user_identities_user_provider_type_unique;
      EXCEPTION WHEN undefined_object THEN NULL; END;
    END$$;`);

    // Re-add providerId to oauth_providers (no constraints)
    await queryRunner.query(`ALTER TABLE "oauth_providers" ADD COLUMN IF NOT EXISTS "providerId" text`);
  }
}


