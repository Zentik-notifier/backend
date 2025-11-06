import { API_PREFIX } from 'src/common/services/url-builder.service';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add iconUrl column to buckets table and populate it for existing records
 */
export class AddIconUrlToBuckets1762423000000 implements MigrationInterface {
  name = 'AddIconUrlToBuckets1762423000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'buckets' 
        AND column_name = 'iconUrl';
    `);

    if (columnExists.length > 0) {
      console.log('✅ iconUrl column already exists in buckets, skipping migration');
      return;
    }

    console.log('🔄 Adding iconUrl column to buckets table...');

    // Add the iconUrl column
    await queryRunner.query(`
      ALTER TABLE "buckets" 
      ADD COLUMN "iconUrl" VARCHAR;
    `);

    console.log('✅ iconUrl column added successfully');

    // Get PUBLIC_BACKEND_URL from environment or use default
    const baseUrl = process.env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

    // Update iconUrl for existing buckets
    console.log('🔄 Populating iconUrl for existing buckets...');

    // For buckets with iconAttachmentUuid, set iconUrl to the attachment public URL
    const bucketsWithAttachment = await queryRunner.query(`
      SELECT id, "iconAttachmentUuid" FROM "buckets" 
      WHERE "iconAttachmentUuid" IS NOT NULL;
    `);

    console.log(`Found ${bucketsWithAttachment.length} buckets with attachment`);

    for (const bucket of bucketsWithAttachment) {
      const iconUrl = `${baseUrl}${API_PREFIX}/attachments/${bucket.iconAttachmentUuid}/download/public`;
      await queryRunner.query(`
        UPDATE "buckets" 
        SET "iconUrl" = $1 
        WHERE id = $2;
      `, [iconUrl, bucket.id]);
    }

    // For buckets with icon (original URL) but no attachment, copy the icon URL
    const bucketsWithIconOnly = await queryRunner.query(`
      SELECT id, icon FROM "buckets" 
      WHERE icon IS NOT NULL AND "iconAttachmentUuid" IS NULL;
    `);

    console.log(`Found ${bucketsWithIconOnly.length} buckets with icon URL only`);

    for (const bucket of bucketsWithIconOnly) {
      await queryRunner.query(`
        UPDATE "buckets" 
        SET "iconUrl" = $1 
        WHERE id = $2;
      `, [bucket.icon, bucket.id]);
    }

    console.log(`✅ Populated iconUrl for ${bucketsWithAttachment.length + bucketsWithIconOnly.length} buckets`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the column
    await queryRunner.query(`
      ALTER TABLE "buckets" DROP COLUMN IF EXISTS "iconUrl";
    `);

    console.log('✅ Rolled back iconUrl column from buckets');
  }
}

