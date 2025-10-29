import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemTokenUsageStats1738208000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE server_setting_type_enum ADD VALUE IF NOT EXISTS 'SystemTokenUsageStats';
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing enum values directly
    console.log('Cannot remove enum value SystemTokenUsageStats - migration not reversible');
  }
}

