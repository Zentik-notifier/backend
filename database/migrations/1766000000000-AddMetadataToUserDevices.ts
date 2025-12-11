import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMetadataToUserDevices1766000000000 implements MigrationInterface {
  name = 'AddMetadataToUserDevices1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD COLUMN "metadata" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP COLUMN "metadata"`,
    );
  }
}
