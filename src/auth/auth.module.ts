import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { UserAccessToken } from '../entities/user-access-token.entity';
import { UserIdentity } from '../entities/user-identity.entity';
import { UserSession } from '../entities/user-session.entity';
import { User } from '../entities/user.entity';
import { EventsModule } from '../events/events.module';
import { OAuthProvidersModule } from '../oauth-providers/oauth-providers.module';
import { ServerSettingsModule } from '../server-settings/server-settings.module';
import { AccessTokenController } from './access-token.controller';
import { AccessTokenResolver } from './access-token.resolver';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';
import { OAuthProviderGuard } from './guards/oauth-provider.guard';
import { DynamicOAuthRegistryService } from './services/dynamic-oauth-registry.service';
import { SessionController } from './session.controller';
import { SessionResolver } from './session.resolver';
import { SessionService } from './session.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserAccessToken,
      UserSession,
      UserIdentity,
    ]),
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'fallback-secret',
      signOptions: {
        expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRATION || '15m',
      },
    }),
    forwardRef(() => OAuthProvidersModule),
    CommonModule,
    EventsModule,
    ServerSettingsModule,
  ],
  providers: [
    AuthService,
    AccessTokenService,
    AccessTokenResolver,
    SessionService,
    SessionResolver,
    LocalStrategy,
    JwtStrategy,
    JwtAuthGuard,
    JwtOrAccessTokenGuard,
    AccessTokenGuard,
    OAuthProviderGuard,
    DynamicOAuthRegistryService,
    EmailService,
  ],
  controllers: [AuthController, AccessTokenController, SessionController],
  exports: [
    AuthService,
    AccessTokenService,
    SessionService,
    JwtAuthGuard,
    JwtOrAccessTokenGuard,
    AccessTokenGuard,
    EmailService,
  ],
})
export class AuthModule {}
