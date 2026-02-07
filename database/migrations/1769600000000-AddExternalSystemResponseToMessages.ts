import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalSystemResponseToMessages1769600000000
  implements MigrationInterface
{
  name = 'AddExternalSystemResponseToMessages1769600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const col = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'externalSystemResponse'
    `);
    if (col.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "messages" ADD COLUMN "externalSystemResponse" json NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages" DROP COLUMN IF EXISTS "externalSystemResponse"
    `);
  }
}
