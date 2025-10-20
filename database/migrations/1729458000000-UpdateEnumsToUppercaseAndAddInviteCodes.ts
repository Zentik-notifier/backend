import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEnumsToUppercaseAndAddInviteCodes1729458000000
  implements MigrationInterface
{
  name = 'UpdateEnumsToUppercaseAndAddInviteCodes1729458000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create update_updated_at_column function if it doesn't exist
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create invite_codes table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(255) UNIQUE NOT NULL,
        "resourceType" VARCHAR(50) NOT NULL,
        "resourceId" UUID NOT NULL,
        "createdBy" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permissions text NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "usageCount" INTEGER DEFAULT 0 NOT NULL,
        "maxUses" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add inviteCodeId column to entity_permissions if it doesn't exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'entity_permissions' AND column_name = 'inviteCodeId'
        ) THEN
          ALTER TABLE entity_permissions ADD COLUMN "inviteCodeId" UUID;
        END IF;
      END $$;
    `);

    // Create indexes for invite_codes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invite_codes_resource_type ON invite_codes("resourceType");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invite_codes_resource_id ON invite_codes("resourceId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON invite_codes("createdBy");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invite_codes_resource_type_id ON invite_codes("resourceType", "resourceId");
    `);

    // Add index for inviteCodeId in entity_permissions
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_permissions_invite_code_id ON entity_permissions("inviteCodeId");
    `);

    // Create trigger for invite_codes updated_at
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_invite_codes_updated_at'
        ) THEN
          CREATE TRIGGER update_invite_codes_updated_at 
          BEFORE UPDATE ON invite_codes
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);

    // Update resourceType values from lowercase to uppercase in entity_permissions
    await queryRunner.query(`
      UPDATE entity_permissions 
      SET "resourceType" = UPPER("resourceType")
      WHERE "resourceType" IN ('bucket', 'user_webhook');
    `);

    // Update resourceType values from lowercase to uppercase in invite_codes
    await queryRunner.query(`
      UPDATE invite_codes 
      SET "resourceType" = UPPER("resourceType")
      WHERE "resourceType" IN ('bucket', 'user_webhook');
    `);

    // Update permissions values from lowercase to uppercase in entity_permissions
    // Permissions are stored as simple-array (comma-separated)
    await queryRunner.query(`
      UPDATE entity_permissions
      SET permissions = UPPER(permissions);
    `);

    // Update permissions values from lowercase to uppercase in invite_codes
    await queryRunner.query(`
      UPDATE invite_codes
      SET permissions = UPPER(permissions);
    `);

    // Add foreign key constraint for inviteCodeId
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_entity_permissions_invite_code'
        ) THEN
          ALTER TABLE entity_permissions
          ADD CONSTRAINT fk_entity_permissions_invite_code
          FOREIGN KEY ("inviteCodeId") REFERENCES invite_codes(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert permissions values to lowercase in invite_codes
    await queryRunner.query(`
      UPDATE invite_codes
      SET permissions = LOWER(permissions);
    `);

    // Revert permissions values to lowercase in entity_permissions
    await queryRunner.query(`
      UPDATE entity_permissions
      SET permissions = LOWER(permissions);
    `);

    // Revert resourceType values to lowercase in invite_codes
    await queryRunner.query(`
      UPDATE invite_codes 
      SET "resourceType" = LOWER("resourceType")
      WHERE "resourceType" IN ('BUCKET', 'USER_WEBHOOK');
    `);

    // Revert resourceType values to lowercase in entity_permissions
    await queryRunner.query(`
      UPDATE entity_permissions 
      SET "resourceType" = LOWER("resourceType")
      WHERE "resourceType" IN ('BUCKET', 'USER_WEBHOOK');
    `);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE entity_permissions
      DROP CONSTRAINT IF EXISTS fk_entity_permissions_invite_code;
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_entity_permissions_invite_code_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_invite_codes_resource_type_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_invite_codes_created_by;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_invite_codes_resource_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_invite_codes_resource_type;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_invite_codes_code;
    `);

    // Drop trigger
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_invite_codes_updated_at ON invite_codes;
    `);

    // Drop inviteCodeId column
    await queryRunner.query(`
      ALTER TABLE entity_permissions DROP COLUMN IF EXISTS "inviteCodeId";
    `);

    // Drop invite_codes table
    await queryRunner.query(`
      DROP TABLE IF EXISTS invite_codes;
    `);
  }
}

