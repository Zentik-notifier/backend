import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create external_notify_systems table (type, name, baseUrl, iconUrl, color, auth)
 * and link buckets via externalNotifySystemId + externalSystemChannel (channel is per-bucket).
 */
export class AddExternalNotifyEndpointsAndBucketLink1769400000000
  implements MigrationInterface
{
  name = 'AddExternalNotifyEndpointsAndBucketLink1769400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'external_notify_system_type_enum'
    `);
    if (enumExists.length === 0) {
      await queryRunner.query(`
        CREATE TYPE "external_notify_system_type_enum" AS ENUM ('NTFY', 'Gotify')
      `);
    }

    const tableExists = await queryRunner.query(`
      SELECT to_regclass('public.external_notify_systems') AS reg
    `);
    if (!tableExists[0]?.reg) {
      await queryRunner.query(`
        CREATE TABLE "external_notify_systems" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "type" "external_notify_system_type_enum" NOT NULL DEFAULT 'NTFY',
          "name" character varying NOT NULL,
          "baseUrl" character varying NOT NULL,
          "iconUrl" character varying,
          "color" character varying,
          "authUser" character varying,
          "authPassword" character varying,
          "authToken" character varying,
          "userId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_external_notify_systems" PRIMARY KEY ("id"),
          CONSTRAINT "FK_external_notify_systems_user" FOREIGN KEY ("userId")
            REFERENCES "users"("id") ON DELETE CASCADE
        )
      `);
    } else {
      const channelColExists = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'external_notify_systems' AND column_name = 'channel'
      `);
      if (channelColExists.length > 0) {
        await queryRunner.query(`
          ALTER TABLE "external_notify_systems" DROP COLUMN "channel"
        `);
      }
      const typeColExists = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'external_notify_systems' AND column_name = 'type'
      `);
      if (typeColExists.length === 0) {
        await queryRunner.query(`
          ALTER TABLE "external_notify_systems"
          ADD COLUMN "type" "external_notify_system_type_enum" NOT NULL DEFAULT 'NTFY'
        `);
      }
      for (const col of ['authUser', 'authPassword', 'authToken']) {
        const exists = await queryRunner.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'external_notify_systems' AND column_name = $1
        `, [col]);
        if (exists.length === 0) {
          await queryRunner.query(`
            ALTER TABLE "external_notify_systems" ADD COLUMN "${col}" character varying
          `);
        }
      }
    }

    const idColExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'buckets' AND column_name = 'externalNotifySystemId';
    `);
    if (idColExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "buckets"
        ADD COLUMN "externalNotifySystemId" uuid NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "buckets"
        ADD CONSTRAINT "FK_buckets_external_notify_system"
        FOREIGN KEY ("externalNotifySystemId")
        REFERENCES "external_notify_systems"("id")
        ON DELETE SET NULL
      `);
    }
    const channelColExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'buckets' AND column_name = 'externalSystemChannel';
    `);
    if (channelColExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "buckets"
        ADD COLUMN "externalSystemChannel" character varying NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "buckets"
      DROP CONSTRAINT IF EXISTS "FK_buckets_external_notify_system"
    `);
    await queryRunner.query(`
      ALTER TABLE "buckets"
      DROP COLUMN IF EXISTS "externalNotifySystemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "buckets"
      DROP COLUMN IF EXISTS "externalSystemChannel"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "external_notify_systems"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "external_notify_system_type_enum"`);
  }
}
