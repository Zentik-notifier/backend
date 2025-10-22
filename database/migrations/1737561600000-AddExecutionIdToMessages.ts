import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExecutionIdToMessages1737561600000 implements MigrationInterface {
  name = 'AddExecutionIdToMessages1737561600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'executionId',
        type: 'varchar',
        isNullable: true,
        comment: 'ID of the entity execution that generated this message',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('messages', 'executionId');
  }
}
