import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChangelogRemoteServerSetting1768000000000
  implements MigrationInterface
{
  name = 'AddChangelogRemoteServerSetting1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'server_setting_type_enum'
                       AND e.enumlabel = 'ChangelogRemoteServer') THEN
        ALTER TYPE server_setting_type_enum ADD VALUE 'ChangelogRemoteServer';
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // No safe down migration for removing enum values
  }
}
