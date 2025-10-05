import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityExecution, ExecutionType, ExecutionStatus } from '../entities';

@Injectable()
export class EntityExecutionService {
  constructor(
    @InjectRepository(EntityExecution)
    private readonly entityExecutionRepository: Repository<EntityExecution>,
  ) {}

  /**
   * Create a new entity execution record
   */
  async create(executionData: {
    type: ExecutionType;
    status: ExecutionStatus;
    entityName?: string;
    entityId?: string;
    userId: string;
    input: string;
    output?: string;
    errors?: string;
    durationMs?: number;
  }): Promise<EntityExecution> {
    const execution = this.entityExecutionRepository.create({
      type: executionData.type,
      status: executionData.status,
      entityName: executionData.entityName,
      entityId: executionData.entityId,
      userId: executionData.userId,
      input: executionData.input,
      output: executionData.output,
      errors: executionData.errors,
      durationMs: executionData.durationMs,
    });

    return this.entityExecutionRepository.save(execution);
  }

  /**
   * Find executions by user ID
   */
  async findByUserId(userId: string): Promise<EntityExecution[]> {
    return this.entityExecutionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find executions by type
   */
  async findByType(
    type: ExecutionType,
    userId?: string,
  ): Promise<EntityExecution[]> {
    const where: any = { type };
    if (userId) {
      where.userId = userId;
    }

    return this.entityExecutionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find executions by status
   */
  async findByStatus(
    status: ExecutionStatus,
    userId?: string,
  ): Promise<EntityExecution[]> {
    const where: any = { status };
    if (userId) {
      where.userId = userId;
    }

    return this.entityExecutionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find executions by type and optionally by entity ID
   */
  async findByTypeAndEntity(
    type: ExecutionType,
    entityId?: string,
    userId?: string,
  ): Promise<EntityExecution[]> {
    const where: any = { type };
    if (entityId) {
      where.entityId = entityId;
    }
    if (userId) {
      where.userId = userId;
    }

    return this.entityExecutionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one execution by ID
   */
  async findOne(id: string, userId?: string): Promise<EntityExecution | null> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    return this.entityExecutionRepository.findOne({ where });
  }

  /**
   * Delete executions older than specified days
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.entityExecutionRepository
      .createQueryBuilder()
      .delete()
      .from(EntityExecution)
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Get execution statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    byType: Record<ExecutionType, number>;
    byStatus: Record<ExecutionStatus, number>;
    recentExecutions: EntityExecution[];
  }> {
    const executions = await this.entityExecutionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const total = executions.length;
    const byType = executions.reduce(
      (acc, execution) => {
        acc[execution.type] = (acc[execution.type] || 0) + 1;
        return acc;
      },
      {} as Record<ExecutionType, number>,
    );

    const byStatus = executions.reduce(
      (acc, execution) => {
        acc[execution.status] = (acc[execution.status] || 0) + 1;
        return acc;
      },
      {} as Record<ExecutionStatus, number>,
    );

    return {
      total,
      byType,
      byStatus,
      recentExecutions: executions.slice(0, 5), // Last 5 executions
    };
  }
}
