import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { SystemAccessTokenController } from './system-access-token.controller';
import { SystemAccessToken } from './system-access-token.entity';
import { SystemAccessTokenGuard } from './system-access-token.guard';
import { SystemAccessTokenResolver } from './system-access-token.resolver';
import { SystemAccessTokenService } from './system-access-token.service';
import { SystemAccessTokenRequest } from './system-access-token-request.entity';
import { SystemAccessTokenRequestController } from './system-access-token-request.controller';
import { SystemAccessTokenRequestResolver } from './system-access-token-request.resolver';
import { SystemAccessTokenRequestService } from './system-access-token-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemAccessToken,
      SystemAccessTokenRequest,
      User,
    ]),
    forwardRef(() => AuthModule),
  ],
  providers: [
    SystemAccessTokenService,
    SystemAccessTokenResolver,
    SystemAccessTokenGuard,
    SystemAccessTokenRequestService,
    SystemAccessTokenRequestResolver,
  ],
  controllers: [
    SystemAccessTokenController,
    SystemAccessTokenRequestController,
  ],
  exports: [
    SystemAccessTokenService,
    SystemAccessTokenGuard,
    SystemAccessTokenRequestService,
  ],
})
export class SystemAccessTokenModule {}
