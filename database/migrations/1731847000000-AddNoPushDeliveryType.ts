import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoPushDeliveryType1731847000000 implements MigrationInterface {
  name = 'AddNoPushDeliveryType1731847000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'NO_PUSH' to the deliveryType enum
    await queryRunner.query(
      `ALTER TYPE "messages_deliverytype_enum" ADD VALUE 'NO_PUSH'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values directly
    // We need to recreate the enum without 'NO_PUSH'
    
    // Create a temporary enum without NO_PUSH
    await queryRunner.query(
      `CREATE TYPE "messages_deliverytype_enum_old" AS ENUM ('SILENT', 'NORMAL', 'CRITICAL')`
    );

    // Update messages table to use the old enum
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "deliveryType" TYPE "messages_deliverytype_enum_old" USING "deliveryType"::text::"messages_deliverytype_enum_old"`
    );

    // Drop the new enum
    await queryRunner.query(
      `DROP TYPE "messages_deliverytype_enum"`
    );

    // Rename the old enum back
    await queryRunner.query(
      `ALTER TYPE "messages_deliverytype_enum_old" RENAME TO "messages_deliverytype_enum"`
    );
  }
}
