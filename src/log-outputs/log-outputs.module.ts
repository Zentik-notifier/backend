import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LogOutput } from '../entities/log-output.entity';
import { LogOutputsService } from './log-outputs.service';
import { LogOutputsResolver } from './log-outputs.resolver';
import { LogOutputsController } from './log-outputs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LogOutput]),
    forwardRef(() => AuthModule),
  ],
  controllers: [LogOutputsController],
  providers: [LogOutputsService, LogOutputsResolver],
  exports: [LogOutputsService],
})
export class LogOutputsModule {}
