import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExecutionStatus, ExecutionType } from '../entities';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { EntityExecutionService } from '../entity-execution/entity-execution.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { BuiltinParserService } from './builtin';
import { CreatePayloadMapperDto, UpdatePayloadMapperDto } from './dto';

/**
 * Interface for parser execution results
 */
interface ParserResult {
  result?: CreateMessageDto;
  status: ExecutionStatus;
  errors?: string;
  executionTimeMs: number;
}

@Injectable()
export class PayloadMapperService {
  constructor(
    @InjectRepository(PayloadMapper)
    private readonly payloadMapperRepository: Repository<PayloadMapper>,
    private readonly builtinParserService: BuiltinParserService,
    private readonly entityExecutionService: EntityExecutionService,
  ) {}

  async create(
    userId: string,
    createPayloadMapperDto: CreatePayloadMapperDto,
  ): Promise<PayloadMapper> {
    const payloadMapper = this.payloadMapperRepository.create({
      ...createPayloadMapperDto,
      userId,
      user: { id: userId },
    });

    const saved = await this.payloadMapperRepository.save(payloadMapper);
    return this.findOne(saved.id, userId);
  }

  async findAll(userId: string): Promise<PayloadMapper[]> {
    // Get user's payload mappers
    const userPayloadMappers = await this.payloadMapperRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const result: PayloadMapper[] = [...userPayloadMappers];

    const allBuiltinParsers = this.builtinParserService.getAllParsers();
    allBuiltinParsers.forEach((parser) => {
      // Create a virtual entry for the builtin parser
      const virtualBuiltin: PayloadMapper = {
        id: `builtin-${parser.type.toLowerCase()}`,
        builtInName: parser.type,
        name: parser.name,
        jsEvalFn: '', // Empty for builtin parsers
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: undefined, // Built-in parsers don't have a user
      };
      result.push(virtualBuiltin);
    });

    return result;
  }

  async findOne(id: string, userId: string): Promise<PayloadMapper> {
    // Check if it's a built-in mapper
    if (id.startsWith('builtin-')) {
      const builtinType = id.replace('builtin-', '').toUpperCase();
      const allBuiltinParsers = this.builtinParserService.getAllParsers();
      const parser = allBuiltinParsers.find(
        (p) => p.type.toString() === builtinType,
      );

      if (parser) {
        return {
          id,
          builtInName: parser.type,
          name: parser.name,
          jsEvalFn: '', // Empty for builtin parsers
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: undefined, // Built-in parsers don't have a user
        } as PayloadMapper;
      }
    }

    const payloadMapper = await this.payloadMapperRepository.findOne({
      where: [
        { id, userId },
        { name: id, userId },
      ],
      relations: ['user'],
    });

    if (!payloadMapper) {
      throw new NotFoundException('Payload mapper not found');
    }

    return payloadMapper;
  }

  async update(
    id: string,
    userId: string,
    updatePayloadMapperDto: UpdatePayloadMapperDto,
  ): Promise<PayloadMapper> {
    const payloadMapper = await this.findOne(id, userId);

    // Only allow updating user's own mappers, not built-in ones
    if (!payloadMapper.userId || payloadMapper.userId !== userId) {
      throw new ForbiddenException(
        'Cannot update built-in or other user mappers',
      );
    }

    Object.assign(payloadMapper, updatePayloadMapperDto);
    const saved = await this.payloadMapperRepository.save(payloadMapper);
    return this.findOne(saved.id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const payloadMapper = await this.findOne(id, userId);

    // Only allow deleting user's own mappers, not built-in ones
    if (!payloadMapper.userId || payloadMapper.userId !== userId) {
      throw new ForbiddenException(
        'Cannot delete built-in or other user mappers',
      );
    }

    await this.payloadMapperRepository.remove(payloadMapper);
  }

  /**
   * Transform payload using parser (builtin or user-created)
   */
  async transformPayload(
    parserName: string,
    payload: any,
    userId: string,
    bucketId: string,
  ): Promise<CreateMessageDto> {
    console.log(`[PayloadMapper] 🚀 transformPayload called for parser '${parserName}' by user ${userId}`);

    let parserResult: ParserResult;
    let parserInfo: { entityName: string; entityId?: string; parserType: 'builtin' | 'user' };

    try {
      // Check if it's a builtin parser
      if (this.builtinParserService.hasParser(parserName)) {
        console.log(`[PayloadMapper] 🔧 Using builtin parser '${parserName}'`);
        // Get the builtin parser to extract the builtInType
        const builtinParser = this.builtinParserService.getAllParsers().find(p => p.name === parserName);
        parserInfo = {
          entityName: builtinParser ? builtinParser.type : parserName,
          parserType: 'builtin'
        };
        parserResult = await this.transformWithBuiltinParser(
          parserName,
          payload,
          bucketId,
        );
      } else {
        // Look up user-created payload mapper by name or ID
        console.log(`[PayloadMapper] 🔍 Looking for user parser '${parserName}'`);
        const payloadMapper = await this.findUserPayloadMapperByNameOrId(
          parserName,
          userId,
        );
        if (!payloadMapper) {
          console.error(`[PayloadMapper] ❌ User parser '${parserName}' not found`);
          throw new NotFoundException(`User parser '${parserName}' not found`);
        }

        console.log(`[PayloadMapper] ✅ Found user parser '${payloadMapper.name}' (ID: ${payloadMapper.id})`);
        parserInfo = {
          entityName: payloadMapper.name,
          entityId: payloadMapper.id,
          parserType: 'user'
        };
        parserResult = await this.transformWithUserParser(
          payloadMapper,
          payload,
          bucketId,
        );
      }
    } catch (error: any) {
      console.error(`[PayloadMapper] ❌ transformPayload failed for parser '${parserName}':`, error.message);
      throw error; // Re-throw to maintain existing behavior
    }

    // Track the execution immediately after getting the result
    try {
      await this.entityExecutionService.create({
        type: ExecutionType.PAYLOAD_MAPPER,
        status: parserResult.status,
        entityName: parserInfo.entityName,
        entityId: parserInfo.parserType === 'user' ? parserInfo.entityId : `builtin-${parserName.toLowerCase()}`,
        userId,
        input: JSON.stringify({
          parserName,
          parserType: parserInfo.parserType,
          payload,
          bucketId,
        }),
        output: parserResult.result ? JSON.stringify(parserResult.result) : undefined,
        errors: parserResult.errors,
        durationMs: parserResult.executionTimeMs,
      });

      console.log(`[PayloadMapper] 💾 Execution tracked for ${parserInfo.parserType} parser '${parserName}' - Status: ${parserResult.status} (${parserResult.executionTimeMs}ms)`);

    } catch (trackingError) {
      // Log but don't throw - tracking shouldn't break the main flow
      console.error('[PayloadMapper] ❌ Failed to track payload mapper execution:', trackingError);
    }

    // Handle different execution statuses
    if (parserResult.status === ExecutionStatus.SKIPPED) {
      throw new Error(`Parser '${parserName}' was skipped - returned null/undefined`);
    }

    if (parserResult.status === ExecutionStatus.ERROR) {
      throw new Error(`Parser '${parserName}' execution failed: ${parserResult.errors}`);
    }

    if (!parserResult.result) {
      throw new Error(`Parser '${parserName}' returned no result`);
    }

    return parserResult.result;
  }

  /**
   * Find user payload mapper by name or ID
   */
  private async findUserPayloadMapperByNameOrId(
    nameOrId: string,
    userId: string,
  ): Promise<PayloadMapper | null> {
    // First try to find by ID
    try {
      return await this.findOne(nameOrId, userId);
    } catch (error) {
      // If not found by ID, try to find by name
      const payloadMappers = await this.payloadMapperRepository.find({
        where: { userId, name: nameOrId },
        relations: ['user'],
      });

      return payloadMappers.length > 0 ? payloadMappers[0] : null;
    }
  }

  /**
   * Transform payload using user-created parser
   */
  private async transformWithUserParser(
    payloadMapper: PayloadMapper,
    payload: any,
    bucketId: string,
  ): Promise<ParserResult> {
    const startTime = Date.now();
    let executionStatus: ExecutionStatus = ExecutionStatus.SUCCESS;
    let executionErrors: string | undefined;
    let result: CreateMessageDto | undefined;

    console.log(`[PayloadMapper] 🔄 Executing user parser '${payloadMapper.name}' (ID: ${payloadMapper.id})`);
    console.log(`[PayloadMapper] 📥 Input payload:`, JSON.stringify(payload, null, 2));
    console.log(`[PayloadMapper] 🪣 Bucket ID: ${bucketId}`);

    try {
      // Create a function from the stored JavaScript code
      console.log(`[PayloadMapper] ⚡ Evaluating JavaScript function for parser '${payloadMapper.name}'`);
      const userFunction = eval(payloadMapper.jsEvalFn);

      // Execute the user function with the payload
      console.log(`[PayloadMapper] 🚀 Executing parser function...`);
      const transformedPayload = userFunction(payload);

      // Check if result is null/undefined (SKIPPED status)
      if (transformedPayload === null || transformedPayload === undefined) {
        console.log(`[PayloadMapper] ⏭️ Parser '${payloadMapper.name}' returned null/undefined - marking as SKIPPED`);
        executionStatus = ExecutionStatus.SKIPPED;
        return {
          status: executionStatus,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Ensure the result is a valid CreateMessageDto structure
      if (!transformedPayload || typeof transformedPayload !== 'object') {
        throw new Error('User parser must return an object or null');
      }

      // Set the bucketId from the service parameter
      result = {
        ...transformedPayload,
        bucketId: bucketId,
      };

      console.log(`[PayloadMapper] ✅ User parser '${payloadMapper.name}' executed successfully`);
      console.log(`[PayloadMapper] 📤 Output result:`, JSON.stringify(result, null, 2));

    } catch (error: any) {
      executionStatus = ExecutionStatus.ERROR;
      executionErrors = error.message;

      console.error(`[PayloadMapper] ❌ Error executing user parser '${payloadMapper.name}':`, error.message);
      console.error(`[PayloadMapper] ❌ Error stack:`, error.stack);

      return {
        status: executionStatus,
        errors: executionErrors,
        executionTimeMs: Date.now() - startTime,
      };
    }

    return {
      result,
      status: executionStatus,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Transform payload using builtin parser
   */
  private async transformWithBuiltinParser(
    parserName: string,
    payload: any,
    bucketId: string,
  ): Promise<ParserResult> {
    const startTime = Date.now();
    let executionStatus: ExecutionStatus = ExecutionStatus.SUCCESS;
    let executionErrors: string | undefined;
    let result: CreateMessageDto | undefined;

    console.log(`[PayloadMapper] 🔄 Executing builtin parser '${parserName}'`);
    console.log(`[PayloadMapper] 📥 Input payload:`, JSON.stringify(payload, null, 2));
    console.log(`[PayloadMapper] 🪣 Bucket ID: ${bucketId}`);

    try {
      // Transform the payload using the builtin parser
      console.log(`[PayloadMapper] 🚀 Executing builtin parser '${parserName}'...`);
      const transformedPayload = this.builtinParserService.transformPayload(
        parserName,
        payload,
      );

      // Check if result is null/undefined (SKIPPED status)
      if (transformedPayload === null || transformedPayload === undefined) {
        console.log(`[PayloadMapper] ⏭️ Builtin parser '${parserName}' returned null/undefined - marking as SKIPPED`);
        executionStatus = ExecutionStatus.SKIPPED;
        return {
          status: executionStatus,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Ensure the result is a valid CreateMessageDto structure
      if (!transformedPayload || typeof transformedPayload !== 'object') {
        throw new Error('Builtin parser must return an object or null');
      }

      // Set the bucketId from the service parameter
      result = {
        ...transformedPayload,
        bucketId: bucketId,
      };

      console.log(`[PayloadMapper] ✅ Builtin parser '${parserName}' executed successfully`);
      console.log(`[PayloadMapper] 📤 Output result:`, JSON.stringify(result, null, 2));

    } catch (error: any) {
      executionStatus = ExecutionStatus.ERROR;
      executionErrors = error.message;

      console.error(`[PayloadMapper] ❌ Error executing builtin parser '${parserName}':`, error.message);
      console.error(`[PayloadMapper] ❌ Error stack:`, error.stack);

      return {
        status: executionStatus,
        errors: executionErrors,
        executionTimeMs: Date.now() - startTime,
      };
    }

    return {
      result,
      status: executionStatus,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
