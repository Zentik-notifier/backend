import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add preset column to buckets table
 */
export class AddPresetToBuckets1762500000000 implements MigrationInterface {
  name = 'AddPresetToBuckets1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'buckets' 
        AND column_name = 'preset';
    `);

    if (columnExists.length > 0) {
      console.log('✅ preset column already exists in buckets, skipping migration');
      return;
    }

    console.log('🔄 Adding preset column to buckets table...');

    // Add the preset column
    await queryRunner.query(`
      ALTER TABLE "buckets" 
      ADD COLUMN "preset" VARCHAR;
    `);

    console.log('✅ preset column added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the column
    await queryRunner.query(`
      ALTER TABLE "buckets" DROP COLUMN IF EXISTS "preset";
    `);

    console.log('✅ Rolled back preset column from buckets');
  }
}
