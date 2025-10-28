import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServerStableIdentifierToServerSettingsEnum1738104000000 implements MigrationInterface {
  name = 'AddServerStableIdentifierToServerSettingsEnum1738104000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'server_setting_type_enum' AND e.enumlabel = 'ServerStableIdentifier'
        ) THEN
          ALTER TYPE server_setting_type_enum ADD VALUE 'ServerStableIdentifier';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres non consente di rimuovere facilmente valori enum; lasciamo il valore.
  }
}


