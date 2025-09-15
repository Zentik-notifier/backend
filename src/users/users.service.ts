import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { generateRSAKeyPair } from '../common/utils/cryptoUtils';
import { Bucket } from '../entities/bucket.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import { SystemAccessToken } from '../system-access-token/system-access-token.entity';
import { UserSetting, UserSettingType } from '../entities/user-setting.entity';
import {
  DevicePlatform,
  RegisterDeviceDto,
  UpdateDeviceTokenDto,
  UpdateUserDeviceDto,
} from './dto';
import { UserRole } from './users.types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDevicesRepository: Repository<UserDevice>,
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(SystemAccessToken)
    private readonly systemAccessTokensRepository: Repository<SystemAccessToken>,
    @InjectRepository(UserSetting)
    private readonly userSettingsRepository: Repository<UserSetting>,
    private readonly eventTrackingService: EventTrackingService,
  ) {}

  async findOne(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['devices', 'buckets', 'identities'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByIdentifier(identifier: {
    userId?: string;
    email?: string;
    username?: string;
  }): Promise<User> {
    let user: User | null = null;

    if (identifier.userId) {
      user = await this.usersRepository.findOne({
        where: { id: identifier.userId },
        relations: ['identities'],
      });
    } else if (identifier.email) {
      user = await this.usersRepository.findOne({
        where: { email: identifier.email },
        relations: ['identities'],
      });
    } else if (identifier.username) {
      user = await this.usersRepository.findOne({
        where: { username: identifier.username },
        relations: ['identities'],
      });
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['devices', 'buckets', 'identities'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = role;
    return this.usersRepository.save(user);
  }

  async registerDevice(
    userId: string,
    registerDeviceDto: RegisterDeviceDto,
  ): Promise<UserDevice> {
    // Check if user exists
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if device already exists for this user
    const existingDevice = await this.userDevicesRepository.findOne({
      where: {
        user: { id: userId },
        deviceToken: registerDeviceDto.deviceToken,
      },
    });

    let publicKeyNew: string | undefined;
    let privateKeyNew: string | undefined;

    if (registerDeviceDto.platform === DevicePlatform.IOS) {
      const { publicKey, privateKey } = await generateRSAKeyPair();
      publicKeyNew = publicKey;
      privateKeyNew = privateKey;
    } else if (registerDeviceDto.platform === DevicePlatform.WEB) {
      const { publicKey, privateKey } = webpush.generateVAPIDKeys();
      publicKeyNew = publicKey;
      privateKeyNew = privateKey;
    }

    if (existingDevice) {
      // Update existing device with new information
      Object.assign(existingDevice, registerDeviceDto);
      // Ensure onlyLocal has a default value if not provided
      if (registerDeviceDto.onlyLocal === undefined) {
        existingDevice.onlyLocal = existingDevice.onlyLocal ?? false;
      }

      const saved = await this.userDevicesRepository.save(existingDevice);
      this.logger.log(`Updated existing device ${saved.id} for user=${userId}`);
      return saved;
    }

    // Create new device
    const deviceData: Partial<UserDevice> = {
      ...registerDeviceDto,
      user,
      lastUsed: new Date(),
      // Ensure onlyLocal has a default value if not provided
      onlyLocal: registerDeviceDto.onlyLocal ?? false,
    };

    deviceData.publicKey = publicKeyNew;
    deviceData.privateKey = privateKeyNew;

    const device = this.userDevicesRepository.create(deviceData);
    const saved = await this.userDevicesRepository.save(device);

    this.logger.log(
      `Registered new device ${saved.platform} ${saved.id} for user=${userId}`,
    );

    // Track device registration event
    await this.eventTrackingService.trackDeviceRegister(userId, saved.id);

    return saved;
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return this.userDevicesRepository.find({
      where: {
        user: { id: userId },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.userDevicesRepository.findOne({
      where: {
        id: deviceId,
        user: { id: userId },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Additional security check to ensure device ownership
    if (device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    await this.userDevicesRepository.remove(device);
    this.logger.log(`Unregistered device ${deviceId} for user=${userId}`);

    // Track device unregistration event
    await this.eventTrackingService.trackDeviceUnregister(userId, deviceId);
  }

  async removeDeviceByToken(
    userId: string,
    deviceToken: string,
  ): Promise<void> {
    const device = await this.userDevicesRepository.findOne({
      where: {
        user: { id: userId },
        deviceToken: deviceToken,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Additional security check to ensure device ownership
    if (device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    await this.userDevicesRepository.remove(device);
    this.logger.log(
      `Unregistered device by token for user=${userId} token=${deviceToken}`,
    );
  }

  async updateDeviceToken(
    userId: string,
    input: UpdateDeviceTokenDto,
  ): Promise<UserDevice> {
    const device = await this.userDevicesRepository.findOne({
      where: {
        user: { id: userId },
        deviceToken: input.oldDeviceToken,
      },
    });

    if (!device) {
      throw new NotFoundException('Device with provided old token not found');
    }

    // Additional security check to ensure device ownership
    if (device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    device.deviceToken = input.newDeviceToken;
    device.lastUsed = new Date();
    const saved = await this.userDevicesRepository.save(device);
    this.logger.log(
      `Updated device token for device ${saved.id} user=${userId}`,
    );
    return saved;
  }

  async updateUserDevice(
    userId: string,
    input: UpdateUserDeviceDto,
  ): Promise<UserDevice> {
    const device = await this.userDevicesRepository.findOne({
      where: {
        id: input.deviceId,
        user: { id: userId },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Additional security check to ensure device ownership
    if (device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    // Update only the fields that are provided
    if (input.deviceName !== undefined) {
      device.deviceName = input.deviceName;
    }
    if (input.deviceModel !== undefined) {
      device.deviceModel = input.deviceModel;
    }
    if (input.osVersion !== undefined) {
      device.osVersion = input.osVersion;
    }
    if (input.subscriptionFields !== undefined) {
      device.subscriptionFields = input.subscriptionFields;
    }
    if (input.deviceToken !== undefined) {
      device.deviceToken = input.deviceToken;
    }

    const newDevice = {
      ...device,
      ...input,
      lastUsed: new Date(),
    };

    const saved = await this.userDevicesRepository.save(newDevice);
    this.logger.log(`Updated device ${saved.id} for user=${userId}`);
    return saved;
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    // Find user with all related data
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['devices', 'buckets', 'identities'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete all notifications for the user (including those in buckets)
    await this.notificationsRepository.delete({ userId: userId });

    // Delete all user devices
    await this.userDevicesRepository.delete({ userId: userId });

    // Delete all user buckets (notifications should already be deleted due to CASCADE)
    await this.bucketsRepository.delete({ user: { id: userId } });

    // Delete all system access tokens requested by this user
    await this.systemAccessTokensRepository.delete({
      requesterId: userId,
    } as any);

    // Track account delete event
    await this.eventTrackingService.trackAccountDelete(userId);

    // Finally delete the user
    await this.usersRepository.delete({ id: userId });
    return { message: 'Account and associated data deleted successfully' };
  }

  /**
   * Find a user device by token for a specific user
   */
  async findDeviceByUserToken(
    userId: string,
    deviceToken: string,
  ): Promise<UserDevice | null> {
    return this.userDevicesRepository.findOne({
      where: { userId, deviceToken } as any,
      relations: ['user'],
    });
  }

  /**
   * Find a user device by ID
   */
  async findDeviceById(deviceId: string): Promise<UserDevice | null> {
    return this.userDevicesRepository.findOne({
      where: { id: deviceId },
      relations: ['user'],
    });
  }

  // User settings
  async getUserSettings(
    userId: string,
    deviceId?: string | null,
  ): Promise<UserSetting[]> {
    const where: any = { userId };
    if (deviceId !== undefined) {
      where.deviceId = deviceId ?? null;
    }
    return this.userSettingsRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async upsertUserSetting(
    userId: string,
    configType: UserSettingType,
    value: { valueText?: string | null; valueBool?: boolean | null },
    deviceId?: string | null,
  ): Promise<UserSetting> {
    const where: any = { userId, configType };
    where.deviceId = deviceId == null ? IsNull() : deviceId;
    let setting = await this.userSettingsRepository.findOne({ where });
    if (!setting) {
      setting = this.userSettingsRepository.create({
        userId,
        deviceId: deviceId ?? null,
        configType,
      });
    }
    if (value.valueText !== undefined) setting.valueText = value.valueText;
    if (value.valueBool !== undefined) setting.valueBool = value.valueBool;
    return this.userSettingsRepository.save(setting);
  }

  /**
   * Update the lastUsed timestamp for a device
   */
  async updateDeviceLastUsed(deviceId: string, userId: string): Promise<void> {
    // Verify device ownership
    const device = await this.findDeviceById(deviceId);
    if (!device || device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    await this.userDevicesRepository.update(
      { id: deviceId },
      { lastUsed: new Date() },
    );
  }
}
