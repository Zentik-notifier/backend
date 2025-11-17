import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePasswordNullable1731839520000 implements MigrationInterface {
  name = 'MakePasswordNullable1731839520000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make password column nullable for social login users
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`
    );

    // Change hasPassword default from true to false
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "hasPassword" SET DEFAULT false`
    );

    // Update existing users with null password to have hasPassword = false
    await queryRunner.query(
      `UPDATE "users" SET "hasPassword" = false WHERE "password" IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Set a default password for users without one (for rollback safety)
    await queryRunner.query(
      `UPDATE "users" SET "password" = '' WHERE "password" IS NULL`
    );

    // Revert hasPassword default back to true
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "hasPassword" SET DEFAULT true`
    );

    // Make password column NOT NULL again
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`
    );
  }
}
