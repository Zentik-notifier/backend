import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import { Bucket } from '../entities/bucket.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { UserSetting } from '../entities/user-setting.entity';
import { User } from '../entities/user.entity';
import { EventsModule } from '../events/events.module';
import { SystemAccessToken } from '../system-access-token/system-access-token.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserDevice,
      Bucket,
      Notification,
      SystemAccessToken,
      UserSetting,
      AdminSubscription,
    ]),
    AuthModule,
    EventsModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
