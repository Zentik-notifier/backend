import { Injectable, NotFoundException } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { AuthentikParser } from './authentik.parser';
import { ServarrParser } from './servarr.parser';
import { BuiltinParserLoggerService } from './builtin-parser-logger.service';

@Injectable()
export class BuiltinParserService {
  private readonly parsers: Map<PayloadMapperBuiltInType, IBuiltinParser> = new Map();
  private readonly parsersByName: Map<string, IBuiltinParser> = new Map();

  constructor(
    private readonly authentikParser: AuthentikParser,
    private readonly servarrParser: ServarrParser,
    private readonly loggerService: BuiltinParserLoggerService,
  ) {
    this.registerParsers();
    this.loggerService.logInitialization(this.parsers);
  }

  private registerParsers(): void {
    // Register parsers by type
    this.parsers.set(PayloadMapperBuiltInType.ZentikAuthentik, this.authentikParser);
    this.parsers.set(PayloadMapperBuiltInType.ZentikServarr, this.servarrParser);
    
    // Register parsers also by name (for endpoint compatibility)
    this.parsersByName.set('authentik', this.authentikParser);
    this.parsersByName.set('Authentik', this.authentikParser);
    this.parsersByName.set('servarr', this.servarrParser);
    this.parsersByName.set('Servarr', this.servarrParser);
  }

  /**
   * Finds a parser by name or type
   */
  getParser(parserName: string): IBuiltinParser {
    // First try by exact name
    let parser = this.parsersByName.get(parserName);
    
    if (!parser) {
      // Then try by enum type
      const builtInType = Object.values(PayloadMapperBuiltInType).find(
        type => type.toLowerCase() === parserName.toLowerCase()
      );
      
      if (builtInType) {
        parser = this.parsers.get(builtInType);
      }
    }

    if (!parser) {
      throw new NotFoundException(`Builtin parser not found: ${parserName}`);
    }

    return parser;
  }

  /**
   * Gets all available parsers
   */
  getAllParsers(): Array<{ name: string; type: PayloadMapperBuiltInType; description: string }> {
    return Array.from(this.parsers.values()).map(parser => ({
      name: parser.name,
      type: parser.builtInType,
      description: parser.description,
    }));
  }

  /**
   * Transforms a payload using the specified parser
   */
  transformPayload(parserName: string, payload: any): CreateMessageDto {
    const parser = this.getParser(parserName);
    
    if (!parser.validate(payload)) {
      throw new Error(`Invalid payload for parser ${parserName}`);
    }

    return parser.parse(payload);
  }

  /**
   * Validates a payload for a specific parser
   */
  validatePayload(parserName: string, payload: any): boolean {
    try {
      const parser = this.getParser(parserName);
      return parser.validate(payload);
    } catch {
      return false;
    }
  }

  /**
   * Checks if a parser exists
   */
  hasParser(parserName: string): boolean {
    try {
      this.getParser(parserName);
      return true;
    } catch {
      return false;
    }
  }
}
