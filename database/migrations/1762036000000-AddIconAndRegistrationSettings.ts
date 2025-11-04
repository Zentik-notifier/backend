import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIconAndRegistrationSettings1762036000000 implements MigrationInterface {
  name = 'AddIconAndRegistrationSettings1762036000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values if not exists
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'server_setting_type_enum'
                       AND e.enumlabel = 'IconUploaderEnabled') THEN
        ALTER TYPE server_setting_type_enum ADD VALUE 'IconUploaderEnabled';
      END IF;
    END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'server_setting_type_enum'
                       AND e.enumlabel = 'LocalRegistrationEnabled') THEN
        ALTER TYPE server_setting_type_enum ADD VALUE 'LocalRegistrationEnabled';
      END IF;
    END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t
                     JOIN pg_enum e ON t.oid = e.enumtypid
                     WHERE t.typname = 'server_setting_type_enum'
                       AND e.enumlabel = 'SocialRegistrationEnabled') THEN
        ALTER TYPE server_setting_type_enum ADD VALUE 'SocialRegistrationEnabled';
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // No safe down migration for removing enum values
  }
}


