import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFailedCallsToSystemAccessToken1769100000000 implements MigrationInterface {
  name = 'AddFailedCallsToSystemAccessToken1769100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('system_access_tokens');
    if (!hasTable) return;

    const table = await queryRunner.getTable('system_access_tokens');

    if (!table?.findColumnByName('failedCalls')) {
      await queryRunner.addColumn(
        'system_access_tokens',
        new TableColumn({
          name: 'failedCalls',
          type: 'int',
          isNullable: false,
          default: 0,
        }),
      );
    }

    if (!table?.findColumnByName('totalFailedCalls')) {
      await queryRunner.addColumn(
        'system_access_tokens',
        new TableColumn({
          name: 'totalFailedCalls',
          type: 'int',
          isNullable: false,
          default: 0,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('system_access_tokens');
    if (!hasTable) return;

    const table = await queryRunner.getTable('system_access_tokens');

    if (table?.findColumnByName('totalFailedCalls')) {
      await queryRunner.dropColumn('system_access_tokens', 'totalFailedCalls');
    }

    if (table?.findColumnByName('failedCalls')) {
      await queryRunner.dropColumn('system_access_tokens', 'failedCalls');
    }
  }
}
