import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityExecution } from '../entities';
import { EntityExecutionService } from './entity-execution.service';

@Module({
  imports: [TypeOrmModule.forFeature([EntityExecution])],
  providers: [EntityExecutionService],
  exports: [EntityExecutionService],
})
export class EntityExecutionModule {}
