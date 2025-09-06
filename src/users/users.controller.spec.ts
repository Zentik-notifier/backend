import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenService } from '../auth/access-token.service';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { DevicePlatform } from './dto/register-device.dto';
import { UpdateDeviceTokenDto } from './dto/update-device-token.dto';
import { UpdateUserDeviceDto } from './dto/update-user-device.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './users.types';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateUserRole: jest.fn(),
    registerDevice: jest.fn(),
    getUserDevices: jest.fn(),
    removeDevice: jest.fn(),
    updateDeviceToken: jest.fn(),
    updateUserDevice: jest.fn(),
    findDeviceByUserToken: jest.fn(),
  };

  const mockAccessTokenService = {
    validateAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AccessTokenService,
          useValue: mockAccessTokenService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AdminOnlyGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [{ id: '1', email: 'test@example.com' }];
      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.getAllUsers();

      expect(result).toEqual(mockUsers);
      expect(usersService.findAll).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return a user by ID', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getUserById('1');

      expect(result).toEqual(mockUser);
      expect(usersService.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const mockUser = { id: '1', role: UserRole.ADMIN };
      const updateRoleDto = { role: UserRole.ADMIN };
      mockUsersService.updateUserRole.mockResolvedValue(mockUser);

      const result = await controller.updateUserRole('1', updateRoleDto);

      expect(result).toEqual(mockUser);
      expect(usersService.updateUserRole).toHaveBeenCalledWith(
        '1',
        UserRole.ADMIN,
      );
    });
  });

  describe('registerDevice', () => {
    it('should register a device', async () => {
      const mockDevice = { id: '1', deviceName: 'iPhone' };
      const registerDeviceDto = {
        deviceName: 'iPhone',
        platform: DevicePlatform.IOS,
      };
      mockUsersService.registerDevice.mockResolvedValue(mockDevice);

      const result = await controller.registerDevice('1', registerDeviceDto);

      expect(result).toEqual(mockDevice);
      expect(usersService.registerDevice).toHaveBeenCalledWith(
        '1',
        registerDeviceDto,
      );
    });
  });

  describe('getUserDevices', () => {
    it('should return user devices', async () => {
      const mockDevices = [{ id: '1', deviceName: 'iPhone' }];
      mockUsersService.getUserDevices.mockResolvedValue(mockDevices);

      const result = await controller.getUserDevices('1');

      expect(result).toEqual(mockDevices);
      expect(usersService.getUserDevices).toHaveBeenCalledWith('1');
    });
  });

  describe('removeDevice', () => {
    it('should remove a device', async () => {
      mockUsersService.removeDevice.mockResolvedValue(true);

      const result = await controller.removeDevice('1', 'device-1');

      expect(result).toBe(true);
      expect(usersService.removeDevice).toHaveBeenCalledWith('1', 'device-1');
    });
  });

  describe('updateDeviceToken', () => {
    it('should update device token', async () => {
      const mockDevice = { id: '1', deviceName: 'iPhone' };
      const updateTokenDto: UpdateDeviceTokenDto = {
        oldDeviceToken: 'old',
        newDeviceToken: 'new',
      };
      mockUsersService.updateDeviceToken.mockResolvedValue(mockDevice);

      const result = await controller.updateDeviceToken('1', updateTokenDto);

      expect(result).toEqual(mockDevice);
      expect(usersService.updateDeviceToken).toHaveBeenCalledWith(
        '1',
        updateTokenDto,
      );
    });
  });

  describe('updateUserDevice', () => {
    it('should update user device', async () => {
      const mockDevice = { id: '1', deviceName: 'iPhone' };
      const updateDeviceDto: UpdateUserDeviceDto = {
        deviceId: 'device-1',
        deviceName: 'iPhone',
      };
      mockUsersService.updateUserDevice.mockResolvedValue(mockDevice);

      const result = await controller.updateUserDevice(
        '1',
        'device-1',
        updateDeviceDto,
      );

      expect(result).toEqual(mockDevice);
      expect(updateDeviceDto.deviceId).toBe('device-1');
      expect(usersService.updateUserDevice).toHaveBeenCalledWith(
        '1',
        updateDeviceDto,
      );
    });
  });
});
