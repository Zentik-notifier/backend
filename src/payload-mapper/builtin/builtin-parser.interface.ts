import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';

export interface IBuiltinParser {
  readonly name: string;
  readonly builtInType: PayloadMapperBuiltInType;
  readonly description: string;

  parse(payload: any): CreateMessageDto;

  /**
   * Valida se il payload è compatibile con questo parser
   */
  validate(payload: any): boolean;
}
