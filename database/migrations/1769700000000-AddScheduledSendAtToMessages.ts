import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledSendAtToMessages1769700000000
  implements MigrationInterface
{
  name = 'AddScheduledSendAtToMessages1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const col = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'scheduledSendAt'
    `);
    if (col.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "messages" ADD COLUMN "scheduledSendAt" TIMESTAMP WITH TIME ZONE NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages" DROP COLUMN IF EXISTS "scheduledSendAt"
    `);
  }
}
