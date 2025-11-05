import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
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
import { MobileAppleAuthDto } from './dto';

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
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Body() registerDto: RegisterDto,
  ): Promise<RegisterResponse> {
    const context = {
      ipAddress: ip,
      userAgent,
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
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Body() loginDto: LoginDto,
  ): Promise<LoginResponse> {
    const context = {
      ipAddress: ip,
      userAgent,
    };

    return await this.authService.login(loginDto, context);
  }

  @Post('apple/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apple mobile login: returns session and persists provider response' })
  @ApiBody({ type: MobileAppleAuthDto })
  async appleLogin(
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Body() body: MobileAppleAuthDto,
  ): Promise<LoginResponse> {
    return this.authService.mobileAppleLogin(body, {
      ipAddress: ip,
      userAgent,
      deviceName: body.deviceName,
      operatingSystem: body.platform ? `${body.platform}${body.osVersion ? ' ' + body.osVersion : ''}` : body.osVersion,
      browser: body.browser,
    });
  }

  // Removed legacy mobile responses endpoints in favor of unified apple/login

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Post('apple/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect Apple Sign In identity to current user (no login)' })
  @ApiBody({ type: MobileAppleAuthDto })
  async appleConnect(
    @GetUser('id') userId: string,
    @Body() body: MobileAppleAuthDto,
  ): Promise<{ success: boolean }> {
    const ok = await this.authService.connectMobileAppleIdentity(userId, body, {});
    return { success: ok };
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
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponse> {
    const context = {
      ipAddress: ip,
      userAgent,
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

  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @Delete('identities/:identityId')
  @ApiOperation({ summary: 'Disconnect an OAuth identity from current user' })
  @ApiResponse({ status: 200, description: 'Identity disconnected' })
  async disconnectIdentity(
    @GetUser('id') userId: string,
    @Param('identityId') identityId: string,
  ): Promise<{ message: string }> {
    await this.authService.disconnectIdentity(userId, identityId);
    return { message: 'Identity disconnected' };
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
  async providerCallback(
    @Param('provider') provider: string,
    @Query('redirect') redirect: string,
    @Query('locale') locale: string,
    @Query('state') state: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @GetUser() user: any,
    @Res() res: any,
  ): Promise<any> {
    this.logger.log(`🔄 [Controller] OAuth callback received for provider: ${provider}`);
    this.logger.debug(`🔄 [Controller] OAuth callback details - redirect: ${redirect}, locale: ${locale}, state: ${state}, user: ${user?.email || 'anonymous'}`);
    
    return this.authService.processOAuthProviderCallback(
      provider,
      redirect,
      locale,
      state,
      ip,
      userAgent,
      user,
      res,
    );
  }

  // Support providers (like Apple) that use POST form_post for callback
  @Post(':provider/callback')
  @ApiOperation({ summary: 'OAuth callback for provider (POST)' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponse,
  })
  @UseGuards(OAuthProviderGuard)
  async providerCallbackPost(
    @Param('provider') provider: string,
    @Query('redirect') redirect: string,
    @Query('locale') locale: string,
    @Query('state') state: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @GetUser() user: any,
    @Res() res: any,
  ): Promise<any> {
    return this.authService.processOAuthProviderCallback(
      provider,
      redirect,
      locale,
      state,
      ip,
      userAgent,
      user,
      res,
    );
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
    @Res() res?: any,
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

  @Post('exchange-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange OAuth code for tokens' })
  @ApiResponse({
    status: 200,
    description: 'Tokens exchanged successfully',
    type: LoginResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired code',
  })
  async exchangeCode(@Body() body: { code: string; sessionId?: string }): Promise<LoginResponse> {
    const { code, sessionId } = body;
    return this.authService.exchangeOAuthCode(code, sessionId);
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
