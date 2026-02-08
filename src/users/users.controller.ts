import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { GetUser } from '../auth/decorators/get-user.decorator';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import {
  RegisterDeviceDto,
  UpdateDeviceTokenDto,
  UpdateUserDeviceDto,
  UpdateUserRoleDto,
  UpsertUserSettingInput,
} from './dto';
import { UserSetting } from '../entities/user-setting.entity';
import { UsersService } from './users.service';

@UseGuards(JwtOrAccessTokenGuard)
@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiOperation({ summary: 'Get all users' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of all users', type: [User] })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Patch(':userId/role')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: User,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateUserRole(userId, updateUserRoleDto.role);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get user settings (optionally filtered by deviceId)',
  })
  @ApiResponse({
    status: 200,
    description: 'User settings',
    type: [UserSetting],
  })
  async getUserSettings(
    @GetUser('id') userId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.usersService.getUserSettings(userId, deviceId);
  }

  @Post('settings')
  @ApiOperation({ summary: 'Upsert a user setting' })
  @ApiResponse({
    status: 200,
    description: 'User setting upserted',
    type: UserSetting,
  })
  async upsertUserSetting(
    @GetUser('id') userId: string,
    @Body() input: UpsertUserSettingInput,
  ) {
    return this.usersService.upsertUserSetting(
      userId,
      input.configType,
      { valueText: input.valueText, valueBool: input.valueBool },
      input.deviceId,
    );
  }

  @Get(':userId')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: User })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('userId') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register a device for push notifications' })
  @ApiResponse({
    status: 201,
    description: 'Device registered successfully',
    type: UserDevice,
  })
  async registerDevice(
    @GetUser('id') userId: string,
    @Body() registerDeviceDto: RegisterDeviceDto,
  ): Promise<UserDevice> {
    return this.usersService.registerDevice(userId, registerDeviceDto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get all registered devices for user' })
  @ApiResponse({
    status: 200,
    description: 'List of user devices',
    type: [UserDevice],
  })
  async getUserDevices(@GetUser('id') userId: string) {
    return this.usersService.getUserDevices(userId);
  }

  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Remove a registered device' })
  @ApiResponse({ status: 200, description: 'Device removed successfully' })
  async removeDevice(
    @GetUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.usersService.removeDevice(userId, deviceId);
  }

  @Patch('devices/token')
  @ApiOperation({ summary: 'Update device token by previous token' })
  @ApiResponse({
    status: 200,
    description: 'Device token updated',
    type: UserDevice,
  })
  async updateDeviceToken(
    @GetUser('id') userId: string,
    @Body() input: UpdateDeviceTokenDto,
  ) {
    return this.usersService.updateDeviceToken(userId, input);
  }

  @Patch('devices/:deviceId')
  @ApiOperation({ summary: 'Update device information' })
  @ApiResponse({
    status: 200,
    description: 'Device updated successfully',
    type: UserDevice,
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async updateUserDevice(
    @GetUser('id') userId: string,
    @Param('deviceId') deviceId: string,
    @Body() updateUserDeviceDto: UpdateUserDeviceDto,
  ) {
    // Ensure the deviceId in the body matches the path parameter
    updateUserDeviceDto.deviceId = deviceId;
    return this.usersService.updateUserDevice(userId, updateUserDeviceDto);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Delete user account and all associated data' })
  @ApiResponse({
    status: 200,
    description: 'User account deleted successfully',
  })
  async deleteAccount(@GetUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Get('admin-subscriptions/me')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my admin event subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Admin event subscriptions',
    type: [String],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getMyAdminSubscription(@GetUser('id') userId: string) {
    return this.usersService.getMyAdminSubscription(userId);
  }

  @Post('admin-subscriptions/me')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert my admin event subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Admin event subscriptions updated',
    type: [String],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async upsertMyAdminSubscription(
    @GetUser('id') userId: string,
    @Body() body: { eventTypes: string[] },
  ) {
    return this.usersService.upsertMyAdminSubscription(
      userId,
      body.eventTypes as any,
    );
  }
}
