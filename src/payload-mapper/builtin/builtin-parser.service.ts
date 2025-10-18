import { Injectable, NotFoundException } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { AuthentikParser } from './authentik.parser';
import { ServarrParser } from './servarr.parser';
import { RailwayParser } from './railway.parser';
import { GitHubParser } from './github.parser';
import { ExpoParser } from './expo.parser';
import { BuiltinParserLoggerService } from './builtin-parser-logger.service';

@Injectable()
export class BuiltinParserService {
  private readonly parsers: Map<PayloadMapperBuiltInType, IBuiltinParser> =
    new Map();
  private readonly parsersByName: Map<string, IBuiltinParser> = new Map();

  constructor(
    private readonly authentikParser: AuthentikParser,
    private readonly servarrParser: ServarrParser,
    private readonly railwayParser: RailwayParser,
    private readonly githubParser: GitHubParser,
    private readonly expoParser: ExpoParser,
    private readonly loggerService: BuiltinParserLoggerService,
  ) {
    this.registerParsers();
    this.loggerService.logInitialization(this.parsers);
  }

  private registerParsers(): void {
    // Register parsers by type
    this.parsers.set(
      PayloadMapperBuiltInType.ZENTIK_AUTHENTIK,
      this.authentikParser,
    );
    this.parsers.set(
      PayloadMapperBuiltInType.ZENTIK_SERVARR,
      this.servarrParser,
    );
    this.parsers.set(
      PayloadMapperBuiltInType.ZENTIK_RAILWAY,
      this.railwayParser,
    );
    this.parsers.set(
      PayloadMapperBuiltInType.ZENTIK_GITHUB,
      this.githubParser,
    );
    this.parsers.set(
      PayloadMapperBuiltInType.ZENTIK_EXPO,
      this.expoParser,
    );

    // Register parsers also by name (for endpoint compatibility)
    this.parsersByName.set('authentik', this.authentikParser);
    this.parsersByName.set('Authentik', this.authentikParser);
    this.parsersByName.set('servarr', this.servarrParser);
    this.parsersByName.set('Servarr', this.servarrParser);
    this.parsersByName.set('railway', this.railwayParser);
    this.parsersByName.set('Railway', this.railwayParser);
    this.parsersByName.set('ZentikRailway', this.railwayParser);
    this.parsersByName.set('github', this.githubParser);
    this.parsersByName.set('GitHub', this.githubParser);
    this.parsersByName.set('ZentikGitHub', this.githubParser);
    this.parsersByName.set('expo', this.expoParser);
    this.parsersByName.set('Expo', this.expoParser);
    this.parsersByName.set('ZentikExpo', this.expoParser);
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
        (type) => type.toLowerCase() === parserName.toLowerCase(),
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
  getAllParsers(): Array<{
    name: string;
    type: PayloadMapperBuiltInType;
    description: string;
  }> {
    return Array.from(this.parsers.values()).map((parser) => ({
      name: parser.name,
      type: parser.builtInType,
      description: parser.description,
    }));
  }

  /**
   * Transforms a payload using the specified parser
   */
  async transformPayload(parserName: string, payload: any, options?: ParserOptions): Promise<CreateMessageDto> {
    const parser = this.getParser(parserName);

    const isValid = await parser.validate(payload, options);
    if (!isValid) {
      throw new Error(
        `Invalid payload for parser ${parserName}: ${JSON.stringify(payload)}`,
      );
    }

    return await parser.parse(payload, options);
  }

  /**
   * Validates a payload for a specific parser
   */
  async validatePayload(parserName: string, payload: any, options?: ParserOptions): Promise<boolean> {
    try {
      const parser = this.getParser(parserName);
      return await parser.validate(payload, options);
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
