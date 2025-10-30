import {
  BadRequestException,
  Injectable,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ConfirmEmailDto,
  EmailConfirmationResponseDto,
  EmailStatusResponseDto,
  RequestEmailConfirmationDto,
} from './dto';
import {
  LoginDto,
  LoginResponse,
  PasswordResetResponseDto,
  PublicAppConfig,
  RefreshTokenResponse,
  RegisterDto,
  RegisterResponse,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { EmailService } from './email.service';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';
import { SessionService } from './session.service';
import { MobileAppleAuthDto } from './dto/mobile-auth.dto';
import { DeviceInfoDto } from './dto/auth.dto';
import { Locale } from '../common/types/i18n';
import { AttachmentsService } from '../attachments/attachments.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { OAuthProvidersService } from '../oauth-providers/oauth-providers.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

@Resolver()
@Injectable()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly eventTrackingService: EventTrackingService,
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly emailService: EmailService,
    private readonly attachmentsService: AttachmentsService,
    private readonly serverSettingsService: ServerSettingsService,
  ) { }

  @Query(() => PublicAppConfig)
  async publicAppConfig(): Promise<PublicAppConfig> {
    const providers =
      await this.oauthProvidersService.findEnabledProvidersPublic();
    const emailEnabled = await this.emailService.isEmailEnabled();
    const systemTokenRequestsEnabled = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.EnableSystemTokenRequests,
    );
    return {
      oauthProviders: providers,
      emailEnabled,
      uploadEnabled: await this.attachmentsService.isAttachmentsEnabled(),
      systemTokenRequestsEnabled,
    };
  }

  @Mutation(() => LoginResponse)
  async appleLoginMobile(
    @Args('input') input: MobileAppleAuthDto,
  ): Promise<LoginResponse> {
    this.logger.debug(`appleLoginMobile invoked: identityTokenPresent=${!!input?.identityToken}`);
    const payload = (input.payload ? JSON.parse(input.payload) : undefined);
    // Map deviceInfo into session context
    return this.authService.mobileAppleLogin(
      {
        identityToken: input.identityToken,
        payload,
      },
      {
        deviceName: input.deviceName,
        operatingSystem: input.platform ? `${input.platform}${input.osVersion ? ' ' + input.osVersion : ''}` : input.osVersion,
        browser: input.browser,
      },
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtOrAccessTokenGuard)
  async appleConnectMobile(
    @Args('input') input: MobileAppleAuthDto,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    this.logger.debug(`appleConnectMobile invoked: user=${userId} identityTokenPresent=${!!input?.identityToken}`);
    const payload = (input.payload ? JSON.parse(input.payload) : undefined);
    return this.authService.connectMobileAppleIdentity(userId, { identityToken: input.identityToken, payload }, {});
  }

  @Mutation(() => String)
  @UseGuards(JwtOrAccessTokenGuard)
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentUser('tokenId') tokenId?: string,
  ): Promise<string> {
    try {
      if (tokenId) {
        const revoked =
          await this.sessionService.revokeSessionByRefreshToken(tokenId);
        this.logger.log(
          `Logout: revoked session for user=${userId} token=${tokenId.substring(0, 8)}... revoked=${revoked}`,
        );
      } else {
        this.logger.log(`Logout: no tokenId available for user=${userId}`);
      }

      // Track logout event
      try {
        await this.eventTrackingService.trackLogout(userId);
        this.logger.debug(`Logout event tracked for user: ${userId}`);
      } catch (trackingError) {
        this.logger.warn(
          `Failed to track logout event for user ${userId}: ${trackingError.message}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Error while revoking session during logout: ${error?.message}`,
      );

      // Still try to track logout even if session revocation failed
      try {
        await this.eventTrackingService.trackLogout(userId);
      } catch (trackingError) {
        this.logger.warn(
          `Failed to track logout event in error handler: ${trackingError.message}`,
        );
      }
    }

    return 'ok';
  }

  @Mutation(() => LoginResponse)
  async login(@Args('input') input: LoginDto): Promise<LoginResponse> {
    try {
      return await this.authService.login(input, {});
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);

      // Re-throw the error to let GraphQL handle it
      throw error;
    }
  }

  @Mutation(() => RegisterResponse)
  async register(@Args('input') input: RegisterDto): Promise<RegisterResponse> {
    try {
      return await this.authService.register(input, {});
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  @Mutation(() => RefreshTokenResponse)
  async refreshAccessToken(
    @Args('refreshToken') refreshToken: string,
  ): Promise<RefreshTokenResponse> {
    try {
      return await this.authService.refreshToken(refreshToken, {});
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }

  @Mutation(() => PasswordResetResponseDto)
  async requestPasswordReset(
    @Args('input') input: RequestPasswordResetDto,
  ): Promise<PasswordResetResponseDto> {
    try {
      const success = await this.authService.requestPasswordReset(
        input.email,
        input.locale,
      );
      return {
        success,
        message:
          'If an account with that email exists, a 6-character reset code has been sent to your email.',
      };
    } catch (error) {
      this.logger.error(`Password reset request failed: ${error.message}`);

      // Handle rate limiting specifically
      if (
        error instanceof BadRequestException &&
        error.message.includes('Please wait')
      ) {
        return {
          success: false,
          message: error.message,
        };
      }

      return {
        success: false,
        message:
          'Failed to process password reset request. Please try again later.',
      };
    }
  }

  @Mutation(() => Boolean)
  async validateResetToken(
    @Args('resetToken') resetToken: string,
  ): Promise<boolean> {
    try {
      return await this.authService.validateResetToken(resetToken);
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      return false;
    }
  }

  @Mutation(() => PasswordResetResponseDto)
  async resetPassword(
    @Args('input') input: ResetPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    try {
      const success = await this.authService.resetPassword(
        input.resetToken,
        input.newPassword,
      );
      return {
        success,
        message:
          'Password has been reset successfully using the 6-character code. You can now login with your new password.',
      };
    } catch (error) {
      this.logger.error(`Password reset failed: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Failed to reset password. Please try again.',
      };
    }
  }

  @Mutation(() => EmailConfirmationResponseDto)
  async requestEmailConfirmation(
    @Args('input') input: RequestEmailConfirmationDto,
  ): Promise<EmailConfirmationResponseDto> {
    try {
      const result = await this.authService.requestEmailConfirmation(
        input.email,
        input.locale as Locale,
      );
      if (result.sent) {
        return {
          success: true,
          message: 'Email confirmation sent successfully.',
        };
      } else {
        return {
          success: false,
          message: `Email confirmation not sent: ${result.reason}`,
        };
      }
    } catch (error) {
      this.logger.error(`Email confirmation request failed: ${error.message}`);
      return {
        success: false,
        message: 'Failed to send confirmation email. Please try again later.',
      };
    }
  }

  @Mutation(() => EmailConfirmationResponseDto)
  async confirmEmail(
    @Args('input') input: ConfirmEmailDto,
  ): Promise<EmailConfirmationResponseDto> {
    try {
      const result = await this.authService.confirmEmail(
        input.code,
        input.locale as any,
      );
      if (result.confirmed) {
        return {
          success: true,
          message:
            'Email confirmed successfully. You can now login to your account.',
        };
      } else {
        return {
          success: false,
          message: `Email confirmation failed: ${result.reason}.`,
        };
      }
    } catch (error) {
      this.logger.error(`Email confirmation failed: ${error.message}`);
      return {
        success: false,
        message: 'Failed to confirm email. Please try again later.',
      };
    }
  }

  @Query(() => EmailStatusResponseDto)
  async checkEmailStatus(
    @Args('email') email: string,
  ): Promise<EmailStatusResponseDto> {
    try {
      const confirmed = await this.authService.isEmailConfirmed(email);
      return {
        confirmed,
        message: confirmed ? 'Email is confirmed' : 'Email is not confirmed',
      };
    } catch (error) {
      this.logger.error(`Email status check failed: ${error.message}`);
      return {
        confirmed: false,
        message: 'Failed to check email status. Please try again later.',
      };
    }
  }
}
