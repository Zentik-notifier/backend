import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTagsToMessages1770200000000 implements MigrationInterface {
  name = 'AddTagsToMessages1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const col = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'tags'`,
    );
    if (col.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "tags" text[]`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "tags"`,
    );
  }
}
