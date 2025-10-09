import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogOutput, LogOutputType } from '../entities/log-output.entity';
import { CreateLogOutputDto, UpdateLogOutputDto } from './dto/log-output.dto';

@Injectable()
export class LogOutputsService {
  private readonly logger = new Logger(LogOutputsService.name);

  constructor(
    @InjectRepository(LogOutput)
    private readonly logOutputRepository: Repository<LogOutput>,
  ) {}

  /**
   * Get all log outputs
   */
  async findAll(): Promise<LogOutput[]> {
    return this.logOutputRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all enabled log outputs
   */
  async findAllEnabled(): Promise<LogOutput[]> {
    return this.logOutputRepository.find({
      where: { isEnabled: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific log output by ID
   */
  async findOne(id: string): Promise<LogOutput> {
    const logOutput = await this.logOutputRepository.findOne({
      where: { id },
    });

    if (!logOutput) {
      throw new NotFoundException(`Log output with ID ${id} not found`);
    }

    return logOutput;
  }

  /**
   * Create a new log output
   */
  async create(dto: CreateLogOutputDto): Promise<LogOutput> {
    // Validate type-specific fields
    this.validateLogOutputDto(dto);

    const logOutput = this.logOutputRepository.create(dto);
    const saved = await this.logOutputRepository.save(logOutput);

    this.logger.log(`Created log output: ${saved.name} (${saved.type})`);
    return saved;
  }

  /**
   * Update an existing log output
   */
  async update(id: string, dto: UpdateLogOutputDto): Promise<LogOutput> {
    const logOutput = await this.findOne(id);

    // Validate type-specific fields if they're being updated
    if (dto.promtailUrl || dto.syslogHost) {
      this.validateLogOutputDto({ ...logOutput, ...dto } as any);
    }

    Object.assign(logOutput, dto);
    const updated = await this.logOutputRepository.save(logOutput);

    this.logger.log(`Updated log output: ${updated.name}`);
    return updated;
  }

  /**
   * Delete a log output
   */
  async remove(id: string): Promise<boolean> {
    const logOutput = await this.findOne(id);
    await this.logOutputRepository.remove(logOutput);

    this.logger.log(`Deleted log output: ${logOutput.name}`);
    return true;
  }

  /**
   * Validate that required fields are present based on log output type
   */
  private validateLogOutputDto(dto: CreateLogOutputDto | any): void {
    if (dto.type === LogOutputType.PROMTAIL) {
      if (!dto.promtailUrl) {
        throw new BadRequestException(
          'Promtail URL is required for PROMTAIL type',
        );
      }
    } else if (dto.type === LogOutputType.SYSLOG) {
      if (!dto.syslogHost) {
        throw new BadRequestException(
          'Syslog host is required for SYSLOG type',
        );
      }
      if (!dto.syslogPort) {
        throw new BadRequestException(
          'Syslog port is required for SYSLOG type',
        );
      }
    }
  }
}
