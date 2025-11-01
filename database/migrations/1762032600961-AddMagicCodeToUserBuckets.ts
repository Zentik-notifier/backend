import { MigrationInterface, QueryRunner } from 'typeorm';
import { generateMagicCode } from '../../src/common/utils/code-generation.utils';

/**
 * Add magicCode column to user_buckets table and generate codes for existing records
 */
export class AddMagicCodeToUserBuckets1762032600961 implements MigrationInterface {
  name = 'AddMagicCodeToUserBuckets1762032600961';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'user_buckets' 
        AND column_name = 'magicCode';
    `);

    if (columnExists.length > 0) {
      console.log('✅ magicCode column already exists in user_buckets, skipping migration');
      return;
    }

    console.log('🔄 Adding magicCode column to user_buckets table...');

    // Add the magicCode column
    await queryRunner.query(`
      ALTER TABLE "user_buckets" 
      ADD COLUMN "magicCode" VARCHAR;
    `);

    console.log('✅ magicCode column added successfully');

    // Add unique constraint to magicCode
    console.log('🔄 Adding unique constraint to magicCode...');
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_buckets_magicCode" ON "user_buckets" ("magicCode");
    `);
    console.log('✅ Unique constraint added successfully');

    // Generate magic codes for all existing user_buckets records
    console.log('🔄 Generating magic codes for existing user_buckets...');
    
    // Get all existing user_buckets without a magicCode
    const existingRecords = await queryRunner.query(`
      SELECT id FROM "user_buckets" WHERE "magicCode" IS NULL;
    `);

    console.log(`Found ${existingRecords.length} user_buckets records to update`);

    // Generate and update magic codes
    for (const record of existingRecords) {
      let magicCode: string;
      let attempts = 0;
      const maxAttempts = 10;

      // Ensure we generate a unique magic code
      do {
        magicCode = generateMagicCode();
        attempts++;

        // Check if this magicCode already exists
        const exists = await queryRunner.query(`
          SELECT id FROM "user_buckets" WHERE "magicCode" = $1;
        `, [magicCode]);

        if (exists.length === 0) {
          break; // Found a unique code
        }

        if (attempts >= maxAttempts) {
          throw new Error('Failed to generate unique magic code after maximum attempts');
        }
      } while (attempts < maxAttempts);

      // Update the record with the new magic code
      await queryRunner.query(`
        UPDATE "user_buckets" 
        SET "magicCode" = $1 
        WHERE id = $2;
      `, [magicCode, record.id]);
    }

    console.log(`✅ Generated magic codes for ${existingRecords.length} user_buckets records`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove unique index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_buckets_magicCode";
    `);

    // Remove the column
    await queryRunner.query(`
      ALTER TABLE "user_buckets" DROP COLUMN IF EXISTS "magicCode";
    `);

    console.log('✅ Rolled back magicCode column from user_buckets');
  }
}

