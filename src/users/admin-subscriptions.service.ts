import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import { User } from '../entities/user.entity';
import { UserRole } from './users.types';
import {
  CreateAdminSubscriptionDto,
  UpdateAdminSubscriptionDto,
} from './dto/admin-subscription.dto';

@Injectable()
export class AdminSubscriptionsService {
  private readonly logger = new Logger(AdminSubscriptionsService.name);

  constructor(
    @InjectRepository(AdminSubscription)
    private readonly adminSubscriptionsRepository: Repository<AdminSubscription>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    createDto: CreateAdminSubscriptionDto,
  ): Promise<AdminSubscription> {
    // Verify user is admin
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin users can create subscriptions');
    }

    // Check if subscription already exists
    const existing = await this.adminSubscriptionsRepository.findOne({
      where: { userId },
    });

    if (existing) {
      // Update existing subscription
      existing.eventTypes = createDto.eventTypes;
      const updated = await this.adminSubscriptionsRepository.save(existing);
      this.logger.log(
        `Admin subscription updated for user ${userId}: ${createDto.eventTypes.join(', ')}`,
      );
      return updated;
    }

    // Create new subscription
    const subscription = this.adminSubscriptionsRepository.create({
      userId,
      eventTypes: createDto.eventTypes,
    });

    const saved = await this.adminSubscriptionsRepository.save(subscription);
    this.logger.log(
      `Admin subscription created for user ${userId}: ${createDto.eventTypes.join(', ')}`,
    );
    return saved;
  }

  async findAll(): Promise<AdminSubscription[]> {
    return this.adminSubscriptionsRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AdminSubscription> {
    const subscription = await this.adminSubscriptionsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!subscription) {
      throw new NotFoundException('Admin subscription not found');
    }

    return subscription;
  }

  async findByUserId(userId: string): Promise<AdminSubscription | null> {
    return this.adminSubscriptionsRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async update(
    id: string,
    updateDto: UpdateAdminSubscriptionDto,
  ): Promise<AdminSubscription> {
    const subscription = await this.findOne(id);

    subscription.eventTypes = updateDto.eventTypes;
    const updated = await this.adminSubscriptionsRepository.save(subscription);

    this.logger.log(
      `Admin subscription updated: ${id} - ${updateDto.eventTypes.join(', ')}`,
    );
    return updated;
  }

  async remove(id: string): Promise<void> {
    const subscription = await this.findOne(id);
    await this.adminSubscriptionsRepository.remove(subscription);
    this.logger.log(`Admin subscription removed: ${id}`);
  }

  async getSubscribedAdminsForEventType(eventType: string): Promise<User[]> {
    const subscriptions = await this.adminSubscriptionsRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.user', 'user')
      .where(':eventType = ANY(subscription.eventTypes)', { eventType })
      .andWhere('user.role = :role', { role: UserRole.ADMIN })
      .getMany();

    return subscriptions.map((sub) => sub.user);
  }
}
