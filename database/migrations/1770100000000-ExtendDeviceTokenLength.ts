import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendDeviceTokenLength1770100000000 implements MigrationInterface {
  name = 'ExtendDeviceTokenLength1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" ALTER COLUMN "deviceToken" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" ALTER COLUMN "deviceToken" TYPE character varying(255)`,
    );
  }
}
