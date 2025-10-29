import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
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
import { SystemAccessScopesGuard } from './system-access-scopes.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemAccessToken,
      SystemAccessTokenRequest,
      User,
    ]),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
  providers: [
    SystemAccessTokenService,
    SystemAccessTokenResolver,
    SystemAccessTokenGuard,
    SystemAccessScopesGuard,
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
    SystemAccessScopesGuard,
    SystemAccessTokenRequestService,
  ],
})
export class SystemAccessTokenModule {}
