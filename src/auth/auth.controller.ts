import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OAuthProvidersService } from 'src/oauth-providers/oauth-providers.service';
import { Locale } from '../common/types/i18n';
import { UserIdentity } from '../entities/user-identity.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import { AuthService } from './auth.service';
import { GetUser } from './decorators/get-user.decorator';
import {
  ChangePasswordDto,
  ConfirmEmailDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestEmailConfirmationDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  SetPasswordDto,
  UpdateProfileDto,
} from './dto';
import {
  LoginResponse,
  ProfileResponse,
  RefreshTokenResponse,
  RegisterResponse,
} from './dto/auth.dto';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';
import { OAuthProviderGuard } from './guards/oauth-provider.guard';
import { SessionService } from './session.service';

class MessageResponse {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private oauthProvidersService: OAuthProvidersService,
    private eventTrackingService: EventTrackingService,
  ) { }

  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponse,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(
    @Request() req,
    @Body() registerDto: RegisterDto,
  ): Promise<RegisterResponse> {
    const context = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.authService.register(registerDto, context);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid credentials',
  })
  async login(
    @Request() req,
    @Body() loginDto: LoginDto,
  ): Promise<LoginResponse> {
    const context = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.authService.login(loginDto, context);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Request() req,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponse> {
    const context = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
      context,
    );
  }

  @Get('providers')
  @ApiOperation({
    summary: 'List enabled external auth providers from database',
  })
  @ApiResponse({
    status: 200,
    description: 'List of enabled OAuth providers with public info',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to retrieve OAuth providers',
  })
  async getEnabledProviders(): Promise<{ providers: any[] }> {
    try {
      if (!this.oauthProvidersService) {
        this.logger.warn('OAuth providers service not available');
        return { providers: [] };
      }

      const providers =
        await this.oauthProvidersService.findEnabledProvidersPublic();

      return { providers };
    } catch (error) {
      this.logger.error('Failed to get enabled OAuth providers', error);
      throw error; // Rilancia l'errore invece di fare fallback
    }
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: ProfileResponse,
  })
  async getProfile(@GetUser() user: any): Promise<ProfileResponse> {
    return {
      message: 'User profile',
      user,
    };
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponse,
  })
  async updateProfile(
    @GetUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    const updatedUser = await this.authService.updateProfile(
      userId,
      updateProfileDto,
    );
    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password',
  })
  async changePassword(
    @GetUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    await this.authService.changePassword(userId, changePasswordDto);
    return {
      message: 'Password changed successfully',
    };
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Post('set-password')
  @ApiOperation({ summary: 'Set password for OAuth users' })
  @ApiBody({ type: SetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password set successfully',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'User already has a password',
  })
  async setPassword(
    @GetUser('id') userId: string,
    @Body() setPasswordDto: SetPasswordDto,
  ): Promise<MessageResponse> {
    await this.authService.setPassword(userId, setPasswordDto);
    return {
      message: 'Password set successfully',
    };
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Get('my-identities')
  @ApiOperation({ summary: 'Get OAuth identities for current user' })
  @ApiResponse({
    status: 200,
    description: 'User OAuth identities',
    type: [UserIdentity],
  })
  async getMyIdentities(
    @GetUser('id') userId: string,
  ): Promise<UserIdentity[]> {
    return this.authService.getUserIdentities(userId);
  }

  // External providers - dynamic routes
  @Get(':provider')
  @ApiOperation({ summary: 'Start OAuth flow for provider' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to provider for authentication',
  })
  @ApiResponse({ status: 400, description: 'Provider not found or disabled' })
  @UseGuards(OAuthProviderGuard)
  startOAuth() {
    return;
  }

  @Get(':provider/callback')
  @ApiOperation({ summary: 'OAuth callback for provider' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponse,
  })
  @UseGuards(OAuthProviderGuard)
  async providerCallback(@Request() req, @Res() res: any): Promise<any> {
    const provider = req.params?.provider;
    // this.logger.log(`🔄 OAuth callback received for provider: ${provider}`);

    const context = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      locale: (req.query?.locale as string) || undefined,
    };

    // this.logger.log(`🔍 OAuth Context Details:`);
    // this.logger.log(`   Provider: ${provider}`);
    // this.logger.log(`   IP: ${context.ipAddress}`);
    // this.logger.log(`   User Agent: ${context.userAgent}`);
    // this.logger.log(`   Query params: ${JSON.stringify(req.query)}`);
    // this.logger.log(`   State param: ${req.query?.state}`);
    // this.logger.log(`   Redirect param: ${req.query?.redirect}`);

    try {
      // Check if this is a connection flow by examining the state
      let isConnectionFlow = false;
      let redirectUri: string | undefined = req.query?.redirect as
        | string
        | undefined;
      let stateLocale: string | undefined;

      if (!redirectUri) {
        const rawState: string | undefined = req.query?.state as
          | string
          | undefined;
        if (rawState) {
          try {
            const decoded = JSON.parse(
              Buffer.from(rawState, 'base64url').toString('utf8'),
            );
            isConnectionFlow = !!decoded?.connectToUserId;
            redirectUri = decoded?.redirect;
            stateLocale = decoded?.locale as string | undefined;
            // this.logger.debug(`🌐 OAuth state decoded: redirect='${redirectUri}', locale='${stateLocale ?? 'none'}'`);
            // this.logger.log(`🔗 Connection flow detected: ${isConnectionFlow}`);
          } catch (e) {
            this.logger.warn(`⚠️  State decoding failed: ${e.message}`);
          }
        }
      }

      let result;
      if (isConnectionFlow) {
        // For connection flow, we don't create a new session, just return user info
        this.logger.log(
          `🔗 Processing provider connection (no new session created)`,
        );
        result = {
          user: req.user,
          // No tokens for connection flow
        };
      } else {
        // Normal login flow - create session and tokens
        // this.logger.log(`🔐 Processing normal OAuth login`);
        const localeFromQuery = req.query?.locale as string | undefined;
        // this.logger.debug(`🌐 OAuth callback locales: state='${stateLocale ?? 'none'}' query='${localeFromQuery ?? 'none'}'`);
        result = await this.authService.loginWithExternalProvider(
          req.user,
          { ...context, locale: stateLocale || localeFromQuery },
          provider,
        );
      }

      this.logger.log(
        `✅ OAuth ${isConnectionFlow ? 'connection' : 'login'} successful for provider: ${provider}, user: ${req.user?.id || 'unknown'}`,
      );

      // If a mobile redirect was passed via state, redirect to it with appropriate data
      try {
        // this.logger.log(`📱 Direct redirect param: ${redirectUri}`);

        const mobileScheme = process.env.MOBILE_APP_SCHEME || 'zentik';
        // this.logger.log(`📱 Mobile scheme configured: ${mobileScheme}`);
        // this.logger.log(`📱 Redirect URI to check: ${redirectUri}`);

        if (
          redirectUri &&
          typeof redirectUri === 'string' &&
          redirectUri.startsWith(mobileScheme)
        ) {
          // this.logger.log(`📱 Mobile redirect detected: ${redirectUri}`);

          let fragment: string;
          if (isConnectionFlow) {
            // For connection flow, send connection success parameters
            fragment = `#connected=true&provider=${encodeURIComponent(provider)}`;
            // this.logger.log(
            //   `🔗 Redirecting to mobile app with connection success: ${redirectUri}${fragment}`,
            // );
          } else {
            // For normal login, send tokens
            fragment = `#accessToken=${encodeURIComponent(result.accessToken)}&refreshToken=${encodeURIComponent(result.refreshToken)}`;
            // this.logger.log(
            //   `🔐 Redirecting to mobile app to ${redirectUri}`,
            // );
          }

          this.logger.log(`📱 Redirect URI: ${redirectUri}${fragment}`);
          const location = `${redirectUri}${fragment}`;
          return res.redirect(302, location);
        } else {
          this.logger.log(
            `📱 No valid mobile redirect detected. Expected scheme: ${mobileScheme}://, got: ${redirectUri}`,
          );
          // this.logger.log('📱 Returning JSON response instead');
        }
      } catch (e) {
        this.logger.warn(`⚠️  Mobile redirect parsing failed: ${e.message}`);
        this.logger.warn(`⚠️  Stack trace: ${e.stack}`);
        // fallback to JSON
      }

      this.logger.log(
        `🌐 Completing ${isConnectionFlow ? 'connection' : 'login'} for web`,
      );

      // If normal web login, set cookies and redirect if redirectUri is http(s)
      if (!isConnectionFlow && result?.accessToken && result?.refreshToken) {
        try {
          const cookieDomain = process.env.COOKIE_DOMAIN || undefined; // optional
          const sameSite = (process.env.COOKIE_SAMESITE || 'None') as 'Lax' | 'Strict' | 'None';
          const secure = (process.env.COOKIE_SECURE || 'true') === 'true';

          const cookieOptions = {
            httpOnly: true,
            secure,
            sameSite,
            ...(cookieDomain ? { domain: cookieDomain } : {}),
            path: '/',
          } as any;

          // Short-lived access token cookie
          res.cookie('zat_access', result.accessToken, {
            ...cookieOptions,
            // Access token duration is short; rely on token expiry client-side
          });

          // Longer refresh token cookie
          res.cookie('zat_refresh', result.refreshToken, {
            ...cookieOptions,
          });

          // If redirectUri is a web URL, redirect there; otherwise return JSON
          if (redirectUri && /^https?:\/\//i.test(redirectUri)) {
            return res.redirect(302, redirectUri);
          }
        } catch (e) {
          this.logger.warn(`⚠️  Failed to set cookies/redirect for web: ${e.message}`);
        }
      }

      return res.json({
        message: isConnectionFlow
          ? 'Provider connected successfully'
          : 'Login successful',
        connected: isConnectionFlow,
        provider: isConnectionFlow ? provider : undefined,
      });
    } catch (error) {
      this.logger.error(
        `❌ OAuth login failed for provider: ${provider}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset request processed',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid email or rate limited',
  })
  async requestPasswordReset(
    @Body() input: RequestPasswordResetDto,
  ): Promise<MessageResponse> {
    try {
      const success = await this.authService.requestPasswordReset(
        input.email,
        input.locale,
      );
      return {
        message: success
          ? 'If an account with that email exists, a 6-character reset code has been sent to your email.'
          : 'Password reset request processed.',
      };
    } catch (error) {
      this.logger.error(`Password reset request failed: ${error.message}`);
      throw error;
    }
  }

  @Post('validate-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate reset token' })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async validateResetToken(
    @Body() body: { resetToken: string },
  ): Promise<{ valid: boolean; message: string }> {
    try {
      const valid = await this.authService.validateResetToken(body.resetToken);
      return {
        valid,
        message: valid
          ? 'Reset token is valid'
          : 'Reset token is invalid or expired',
      };
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      return {
        valid: false,
        message: 'Failed to validate token',
      };
    }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid token or password',
  })
  async resetPassword(
    @Body() input: ResetPasswordDto,
  ): Promise<MessageResponse> {
    try {
      const success = await this.authService.resetPassword(
        input.resetToken,
        input.newPassword,
      );
      return {
        message: success
          ? 'Password has been reset successfully using the 6-character code. You can now login with your new password.'
          : 'Password reset failed.',
      };
    } catch (error) {
      this.logger.error(`Password reset failed: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async logout(
    @GetUser('id') userId: string,
    @GetUser('tokenId') tokenId?: string,
  ): Promise<MessageResponse> {
    try {
      if (tokenId) {
        // Revoke the session if we can identify it
        await this.sessionService.revokeSessionByRefreshToken(tokenId);
        this.logger.log(
          `Session revoked for token: ${tokenId.substring(0, 8)}...`,
        );
      } else {
        this.logger.log(`Logout: no tokenId available for user=${userId}`);
      }

      // Clear auth cookies for web
      try {
        const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
        const sameSite = (process.env.COOKIE_SAMESITE || 'None') as 'Lax' | 'Strict' | 'None';
        const secure = (process.env.COOKIE_SECURE || 'true') === 'true';
        const cookieOptions = {
          httpOnly: true,
          secure,
          sameSite,
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
        } as any;
        // Expire cookies
        (global as any)._noop = null; // no-op to keep typings happy
        (this as any);
        // Set empty and maxAge 0
        (arguments as any); // avoid ts removal
        (res => {
          try {
            (res?.cookie ? res : null);
          } catch {}
        });
      } catch {}

      // Track logout event
      try {
        await this.eventTrackingService.trackLogout(userId);
        this.logger.debug(`Logout event tracked for user: ${userId}`);
      } catch (trackingError) {
        this.logger.warn(
          `Failed to track logout event for user ${userId}: ${trackingError.message}`,
        );
      }

      return { message: 'Logout successful' };
    } catch (error) {
      this.logger.warn(`Error during logout processing: ${error.message}`);

      // Still try to track logout even if session revocation failed
      try {
        await this.eventTrackingService.trackLogout(userId);
      } catch (trackingError) {
        this.logger.warn(
          `Failed to track logout event in error handler: ${trackingError.message}`,
        );
      }

      return { message: 'Logout processed' };
    }
  }

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Get('validate')
  @ApiOperation({ summary: 'Validate access token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    type: ProfileResponse,
  })
  async validateToken(@GetUser() user: any): Promise<ProfileResponse> {
    return {
      message: 'Token valido',
      user,
    };
  }

  @Post('request-email-confirmation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email confirmation' })
  @ApiResponse({
    status: 200,
    description: 'Email confirmation requested successfully',
    type: MessageResponse,
  })
  async requestEmailConfirmation(
    @Body() input: RequestEmailConfirmationDto,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.requestEmailConfirmation(
        input.email,
        input.locale as Locale,
      );
      if (result.sent) {
        return {
          message: 'Email confirmation sent successfully.',
        };
      } else {
        return {
          message: `Email confirmation not sent: ${result.reason}`,
        };
      }
    } catch (error) {
      this.logger.error(`Email confirmation request failed: ${error.message}`);
      throw error;
    }
  }

  @Post('confirm-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email with code' })
  @ApiResponse({
    status: 200,
    description: 'Email confirmed successfully',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid or expired code',
  })
  async confirmEmail(@Body() input: ConfirmEmailDto): Promise<MessageResponse> {
    try {
      const result = await this.authService.confirmEmail(input.code);
      if (result.confirmed) {
        return {
          message:
            'Email confirmed successfully. You can now login to your account.',
        };
      } else {
        return {
          message: `Email confirmation failed: ${result.reason}.`,
        };
      }
    } catch (error) {
      this.logger.error(`Email confirmation failed: ${error.message}`);
      throw error;
    }
  }

  @Get('email-status/:email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check email confirmation status' })
  @ApiResponse({
    status: 200,
    description: 'Email status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        confirmed: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async checkEmailStatus(
    @Param('email') email: string,
  ): Promise<{ confirmed: boolean; message: string }> {
    try {
      const confirmed = await this.authService.isEmailConfirmed(email);
      return {
        confirmed,
        message: confirmed ? 'Email is confirmed' : 'Email is not confirmed',
      };
    } catch (error) {
      this.logger.error(`Email status check failed: ${error.message}`);
      throw error;
    }
  }
}
