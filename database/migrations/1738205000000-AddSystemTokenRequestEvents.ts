import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemTokenRequestEvents1738205000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'events_type_enum') THEN
          CREATE TYPE events_type_enum AS ENUM ();
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TYPE events_type_enum ADD VALUE IF NOT EXISTS 'SYSTEM_TOKEN_REQUEST_CREATED';
    `);
    await queryRunner.query(`
      ALTER TYPE events_type_enum ADD VALUE IF NOT EXISTS 'SYSTEM_TOKEN_REQUEST_APPROVED';
    `);
    await queryRunner.query(`
      ALTER TYPE events_type_enum ADD VALUE IF NOT EXISTS 'SYSTEM_TOKEN_REQUEST_DECLINED';
    `);
  }

  public async down(): Promise<void> {
    // Irreversible in PostgreSQL
    console.log('Cannot remove enum values from events_type_enum - not reversible');
  }
}


