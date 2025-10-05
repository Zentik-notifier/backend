import { Injectable, Logger } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';

@Injectable()
export class BuiltinParserLoggerService {
  private readonly logger = new Logger(BuiltinParserLoggerService.name);

  logInitialization(
    parsers: Map<PayloadMapperBuiltInType, IBuiltinParser>,
  ): void {
    this.logger.log('🚀 Initializing builtin payload parsers...');

    const parserCount = parsers.size;
    this.logger.log(
      `📦 Found ${parserCount} builtin parser${parserCount !== 1 ? 's' : ''}:`,
    );

    parsers.forEach((parser, type) => {
      this.logger.log(`  ✅ ${parser.name} (${type}) - ${parser.description}`);
    });

    this.logger.log('🎯 Builtin parsers initialization completed');
  }
}
