import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreLogsOnFsSetting1769300000000
  implements MigrationInterface
{
  name = 'AddStoreLogsOnFsSetting1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'server_setting_type_enum'
                       AND e.enumlabel = 'StoreLogsOnFs') THEN
        ALTER TYPE server_setting_type_enum ADD VALUE 'StoreLogsOnFs';
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // No safe down migration for removing enum values
  }
}
