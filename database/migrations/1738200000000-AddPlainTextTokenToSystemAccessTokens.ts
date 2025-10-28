import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPlainTextTokenToSystemAccessTokens1738200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'system_access_tokens',
      new TableColumn({
        name: 'token',
        type: 'text',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('system_access_tokens', 'token');
  }
}


