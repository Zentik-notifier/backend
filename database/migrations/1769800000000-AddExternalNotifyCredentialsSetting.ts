import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds ExternalNotifyCredentials to user_setting_type_enum and drops auth columns from external_notify_systems.
 */
export class AddExternalNotifyCredentialsSetting1769800000000
  implements MigrationInterface
{
  name = 'AddExternalNotifyCredentialsSetting1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'user_setting_type_enum'
                       AND e.enumlabel = 'ExternalNotifyCredentials') THEN
        ALTER TYPE user_setting_type_enum ADD VALUE 'ExternalNotifyCredentials';
      END IF;
    END $$;`);

    await queryRunner.query(`
      ALTER TABLE "external_notify_systems"
      DROP COLUMN IF EXISTS "authUser",
      DROP COLUMN IF EXISTS "authPassword",
      DROP COLUMN IF EXISTS "authToken"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "external_notify_systems" ADD COLUMN IF NOT EXISTS "authUser" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_notify_systems" ADD COLUMN IF NOT EXISTS "authPassword" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_notify_systems" ADD COLUMN IF NOT EXISTS "authToken" varchar`,
    );
  }
}
