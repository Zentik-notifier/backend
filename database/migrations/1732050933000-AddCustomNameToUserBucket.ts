import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomNameToUserBucket1732050933000 implements MigrationInterface {
  name = 'AddCustomNameToUserBucket1732050933000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_buckets" ADD "customName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_buckets" DROP COLUMN "customName"`,
    );
  }
}
