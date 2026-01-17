import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisableUserTrackingSetting1768638868000
  implements MigrationInterface
{
  name = 'AddDisableUserTrackingSetting1768638868000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'user_setting_type_enum'
                       AND e.enumlabel = 'DisableUserTracking') THEN
        ALTER TYPE user_setting_type_enum ADD VALUE 'DisableUserTracking';
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // No safe down migration for removing enum values
  }
}
