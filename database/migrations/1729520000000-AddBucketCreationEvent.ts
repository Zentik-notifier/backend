import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBucketCreationEvent1729520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE events_type_enum ADD VALUE IF NOT EXISTS 'BUCKET_CREATION';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values directly
    // You would need to recreate the enum type without the value
    // For simplicity, this migration is not reversible
    console.log('Cannot remove enum value BUCKET_CREATION - migration not reversible');
  }
}

