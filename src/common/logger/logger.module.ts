import { Module, Global } from '@nestjs/common';
import { DatabaseLoggerService } from './database-logger.service';
import { ServerManagerModule } from '../../server-manager/server-manager.module';

@Global()
@Module({
  imports: [ServerManagerModule],
  providers: [DatabaseLoggerService],
  exports: [DatabaseLoggerService],
})
export class LoggerModule {}
