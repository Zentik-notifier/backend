import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServerFilesDirectoryToServerSettingsEnum1761999935000 implements MigrationInterface {
  name = 'AddServerFilesDirectoryToServerSettingsEnum1761999935000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'server_setting_type_enum' AND e.enumlabel = 'ServerFilesDirectory'
        ) THEN
          ALTER TYPE server_setting_type_enum ADD VALUE 'ServerFilesDirectory';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL non consente di rimuovere facilmente valori enum; lasciamo il valore.
  }
}

