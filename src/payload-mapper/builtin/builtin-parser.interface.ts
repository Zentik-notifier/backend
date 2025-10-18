import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';

export interface ParserOptions {
  userId?: string;
  headers?: Record<string, string>;
}

export interface IBuiltinParser {
  readonly name: string;
  readonly builtInType: PayloadMapperBuiltInType;
  readonly description: string;

  parse(payload: any, options?: ParserOptions): Promise<CreateMessageDto>;

  /**
   * Valida se il payload è compatibile con questo parser
   */
  validate(payload: any, options?: ParserOptions): Promise<boolean>;
}
