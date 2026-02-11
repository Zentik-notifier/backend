import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileMediaTypeAndMimeToAttachments1770000000000
  implements MigrationInterface
{
  name = 'AddFileMediaTypeAndMimeToAttachments1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.driver.options.type as string;

    if (dbType === 'postgres') {
      const enumHasFile = await queryRunner.query(`
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'attachments_mediatype_enum' AND e.enumlabel = 'FILE';
      `);
      if (enumHasFile.length === 0) {
        await queryRunner.query(`
          ALTER TYPE "attachments_mediatype_enum" ADD VALUE 'FILE';
        `);
      }

      const columnExists = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attachments' 
          AND column_name = 'mime';
      `);

      if (columnExists.length === 0) {
        await queryRunner.query(`
          ALTER TABLE "attachments" ADD COLUMN "mime" VARCHAR;
        `);
      }
    } else if (dbType === 'sqlite') {
      const table = await queryRunner.getTable('attachments');
      const hasMime = table?.columns.some((c) => c.name === 'mime');
      if (!hasMime) {
        await queryRunner.query(`
          ALTER TABLE "attachments" ADD COLUMN "mime" VARCHAR;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.driver.options.type as string;

    if (dbType === 'postgres') {
      await queryRunner.query(`
        ALTER TABLE "attachments" DROP COLUMN IF EXISTS "mime";
      `);
    } else if (dbType === 'sqlite') {
      const table = await queryRunner.getTable('attachments');
      const hasMime = table?.columns.some((c) => c.name === 'mime');
      if (hasMime) {
        await queryRunner.query(`
          CREATE TABLE "attachments_temp" (
            "id" uuid PRIMARY KEY,
            "filename" varchar NOT NULL,
            "filepath" varchar NOT NULL,
            "originalFilename" varchar,
            "size" bigint,
            "mediaType" varchar,
            "messageId" varchar,
            "userId" uuid NOT NULL,
            "createdAt" datetime NOT NULL,
            "updatedAt" datetime NOT NULL
          );
          INSERT INTO "attachments_temp" ("id","filename","filepath","originalFilename","size","mediaType","messageId","userId","createdAt","updatedAt")
          SELECT "id","filename","filepath","originalFilename","size","mediaType","messageId","userId","createdAt","updatedAt" FROM "attachments";
          DROP TABLE "attachments";
          ALTER TABLE "attachments_temp" RENAME TO "attachments";
        `);
      }
    }
  }
}
