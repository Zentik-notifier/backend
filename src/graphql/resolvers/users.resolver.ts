import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  Mutation,
  Query,
  Resolver,
  Subscription
} from '@nestjs/graphql';
import { AuthService } from '../../auth/auth.service';
import { ChangePasswordDto, UpdateProfileDto } from '../../auth/dto';
import { AdminOnlyGuard } from '../../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { UserDevice } from '../../entities/user-device.entity';
import { User } from '../../entities/user.entity';
import {
  RegisterDeviceDto,
  UpdateDeviceTokenDto,
  UpdateUserDeviceDto,
  UpdateUserRoleInput,
} from '../../users/dto';
import { UsersService } from '../../users/users.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DeviceToken } from '../decorators/device-token.decorator';
import { GraphQLSubscriptionService } from '../services/graphql-subscription.service';

@Resolver(() => User)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class UsersResolver {
  private readonly logger = new Logger(UsersResolver.name);

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private subscriptionService: GraphQLSubscriptionService,
  ) {}

  @Query(() => User)
  async me(@CurrentUser('id') userId: string): Promise<Omit<User, 'password'>> {
    return this.usersService.findOne(userId);
  }

  @Query(() => [User])
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async users(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Mutation(() => User)
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateProfileDto,
  ): Promise<Omit<User, 'password'>> {
    console.log("🔄 Updating profile:", { userId, input });
    const updatedUser = await this.authService.updateProfile(userId, input);

    // Publish the user profile updated event
    await this.subscriptionService.publishUserProfileUpdated(
      updatedUser,
      userId,
    );

    return updatedUser;
  }

  @Mutation(() => Boolean)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Args('input') input: ChangePasswordDto,
  ): Promise<boolean> {
    await this.authService.changePassword(userId, {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });

    // Publish password changed event
    await this.subscriptionService.publishUserPasswordChanged(userId);

    return true;
  }

  @Mutation(() => Boolean)
  async setPassword(
    @CurrentUser('id') userId: string,
    @Args('input') input: ChangePasswordDto,
  ): Promise<boolean> {
    await this.authService.setPassword(userId, {
      newPassword: input.newPassword,
    });

    // Publish password changed event
    await this.subscriptionService.publishUserPasswordChanged(userId);

    return true;
  }

  @Query(() => [UserDevice])
  async userDevices(@CurrentUser('id') userId: string): Promise<UserDevice[]> {
    return this.usersService.getUserDevices(userId);
  }

  @Query(() => UserDevice, { nullable: true })
  async userDevice(
    @CurrentUser('id') userId: string,
    @DeviceToken() deviceToken: string,
  ): Promise<UserDevice | null> {
    return this.usersService.findDeviceByUserToken(userId, deviceToken);
  }

  @Mutation(() => UserDevice)
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Args('input') input: RegisterDeviceDto,
  ): Promise<UserDevice> {
    return this.usersService.registerDevice(userId, input);
  }

  @Mutation(() => Boolean)
  async removeDevice(
    @CurrentUser('id') userId: string,
    @Args('deviceId') deviceId: string,
  ): Promise<boolean> {
    await this.usersService.removeDevice(userId, deviceId);
    return true;
  }

  @Mutation(() => Boolean)
  async removeDeviceByToken(
    @CurrentUser('id') userId: string,
    @Args('deviceToken') deviceToken: string,
  ): Promise<boolean> {
    await this.usersService.removeDeviceByToken(userId, deviceToken);
    return true;
  }

  @Mutation(() => UserDevice)
  async updateDeviceToken(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateDeviceTokenDto,
  ): Promise<UserDevice> {
    return this.usersService.updateDeviceToken(userId, input);
  }

  @Mutation(() => Boolean)
  async deleteAccount(@CurrentUser('id') userId: string): Promise<boolean> {
    await this.usersService.deleteAccount(userId);
    return true;
  }

  @Mutation(() => User)
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async updateUserRole(
    @Args('input') input: UpdateUserRoleInput,
  ): Promise<User> {
    return this.usersService.updateUserRole(input.userId, input.role);
  }

  @Mutation(() => UserDevice)
  async updateUserDevice(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateUserDeviceDto,
  ): Promise<UserDevice> {
    return this.usersService.updateUserDevice(userId, input);
  }

  @Subscription(() => User, {
    filter: (payload, variables, context) => {
      // Only send to the user whose profile was updated
      return payload.userId === context.req.user.id;
    },
  })
  userProfileUpdated() {
    return this.subscriptionService.userProfileUpdated();
  }

  @Subscription(() => Boolean, {
    filter: (payload, variables, context) => {
      // Only send to the user whose password was changed
      return payload.userId === context.req.user.id;
    },
  })
  userPasswordChanged() {
    return this.subscriptionService.userPasswordChanged();
  }
}
