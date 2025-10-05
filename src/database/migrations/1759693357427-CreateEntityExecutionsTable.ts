import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntityExecutionsTable1759693357427
  implements MigrationInterface
{
  name = 'CreateEntityExecutionsTable1759693357427';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create execution type enum
    await queryRunner.query(`
            CREATE TYPE "execution_type_enum" AS ENUM('WEBHOOK', 'PAYLOAD_MAPPER')
        `);

    // Create execution status enum
    await queryRunner.query(`
            CREATE TYPE "execution_status_enum" AS ENUM('SUCCESS', 'ERROR', 'TIMEOUT')
        `);

    // Create entity_executions table
    await queryRunner.query(`
            CREATE TABLE "entity_executions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "type" "execution_type_enum" NOT NULL,
                "status" "execution_status_enum" NOT NULL,
                "entityName" character varying(255),
                "entityId" uuid,
                "userId" uuid NOT NULL,
                "input" text NOT NULL,
                "output" text,
                "errors" text,
                "durationMs" bigint,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_entity_executions" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraint to users table
    await queryRunner.query(`
            ALTER TABLE "entity_executions" ADD CONSTRAINT "FK_entity_executions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "entity_executions" DROP CONSTRAINT "FK_entity_executions_user"
        `);

    // Drop table
    await queryRunner.query(`DROP TABLE "entity_executions"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "execution_status_enum"`);
    await queryRunner.query(`DROP TYPE "execution_type_enum"`);
  }
}
