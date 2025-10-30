import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Locale } from '../common/types/i18n';
import { ServerSettingType } from '../entities/server-setting.entity';
import { UserIdentity } from '../entities/user-identity.entity';
import { User } from '../entities/user.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  SetPasswordDto,
  UpdateProfileDto,
} from './dto';
import {
  LoginResponse,
  RefreshTokenResponse,
  RegisterResponse,
} from './dto/auth.dto';
import { EmailService } from './email.service';
import { SessionService } from './session.service';
import { OAuthProviderType } from '../entities/oauth-provider.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
}

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
  locale?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserIdentity)
    private identitiesRepository: Repository<UserIdentity>,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private emailService: EmailService,
    private eventTrackingService: EventTrackingService,
    private serverSettingsService: ServerSettingsService,
  ) { }

  private mapProviderToType(provider: string | undefined | null): OAuthProviderType | undefined {
    const p = (provider || '').toLowerCase();
    switch (p) {
      case 'github':
        return OAuthProviderType.GITHUB;
      case 'google':
        return OAuthProviderType.GOOGLE;
      case 'discord':
        return OAuthProviderType.DISCORD;
      case 'apple':
        return OAuthProviderType.APPLE;
      case 'apple_signin':
      case 'applemobile':
        return OAuthProviderType.APPLE_SIGNIN;
      case 'local':
        return OAuthProviderType.LOCAL;
      case 'custom':
        return OAuthProviderType.CUSTOM;
      default:
        return undefined;
    }
  }
  async processOAuthProviderCallback(
    providerKey: string,
    redirect: string | undefined,
    locale: string | undefined,
    state: string | undefined,
    ip: string | undefined,
    userAgent: string | undefined,
    user: any,
    res: any,
  ): Promise<any> {
    const context = {
      ipAddress: ip,
      userAgent,
      locale: locale || undefined,
    };

    try {
      let isConnectionFlow = false;
      let redirectUri: string | undefined = redirect;
      let stateLocale: string | undefined;

      if (!redirectUri && state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
          isConnectionFlow = !!decoded?.connectToUserId;
          redirectUri = decoded?.redirect;
          stateLocale = decoded?.locale as string | undefined;
        } catch (e: any) {
          this.logger.warn(`State decoding failed: ${e.message}`);
        }
      }

      let result: any;
      if (isConnectionFlow) {
        result = { user };
      } else {
        const localeFromQuery = locale;
        result = await this.loginWithExternalProvider(
          user,
          { ...context, locale: stateLocale || localeFromQuery },
          providerKey.toUpperCase() as OAuthProviderType,
        );
      }

      // Handle mobile deep link (custom scheme)
      try {
        const mobileScheme = process.env.MOBILE_APP_SCHEME || 'zentik';
        if (
          redirectUri &&
          typeof redirectUri === 'string' &&
          redirectUri.startsWith(mobileScheme)
        ) {
          let fragment: string;
          if (isConnectionFlow) {
            fragment = `#connected=true&provider=${encodeURIComponent(providerKey)}`;
            const location = `${redirectUri}${fragment}`;
            return res.redirect(302, location);
          } else {
            // Use code exchange on mobile as well
            const exchangeCode = Buffer.from(crypto.randomBytes(16)).toString('base64url');
            const latestSession = await this.sessionService.getLatestSessionForUser(result.user.id);
            if (latestSession) {
              await this.sessionService.setExchangeCode(latestSession.id, exchangeCode, new Date());
              // schedule cleanup
              setTimeout(async () => {
                const session = await this.sessionService.findSessionByExchangeCode(exchangeCode);
                if (session && session.exchangeCode === exchangeCode) {
                  await this.sessionService.setExchangeCode(session.id, null as any, null as any);
                }
              }, 31000);
              fragment = `#code=${exchangeCode}&sessionId=${latestSession.id}`;
              const location = `${redirectUri}${fragment}`;
              return res.redirect(302, location);
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`Mobile redirect parsing failed: ${e.message}`);
      }

      // Web connection flow: redirect back to frontend or postMessage+close
      if (isConnectionFlow) {
        // Prefer redirect to returnUrl so WebBrowser.openAuthSessionAsync can auto-close
        if (redirectUri && /^https?:\/\//i.test(redirectUri)) {
          const fragment = `#connected=true&provider=${encodeURIComponent(providerKey)}`;
          return res.redirect(302, `${redirectUri}${fragment}`);
        }
      }

      // Proceed with web (code exchange)
      if (!isConnectionFlow && result?.accessToken && result?.refreshToken) {
        try {
          if (redirectUri && /^https?:\/\//i.test(redirectUri)) {
            const exchangeCode = Buffer.from(crypto.randomBytes(16)).toString('base64url');
            const latestSession = await this.sessionService.getLatestSessionForUser(result.user.id);
            if (latestSession) {
              await this.sessionService.setExchangeCode(latestSession.id, exchangeCode, new Date());
              setTimeout(async () => {
                const session = await this.sessionService.findSessionByExchangeCode(exchangeCode);
                if (session && session.exchangeCode === exchangeCode) {
                  await this.sessionService.setExchangeCode(session.id, null as any, null as any);
                }
              }, 31000);
              const fragment = `#code=${exchangeCode}&sessionId=${latestSession.id}`;
              return res.redirect(302, `${redirectUri}${fragment}`);
            }
          }
        } catch (e: any) {
          this.logger.warn(`Failed to set exchange code/redirect: ${e.message}`);
        }
      }

      return res.json({
        message: isConnectionFlow ? 'Provider connected successfully' : 'Login successful',
        connected: isConnectionFlow,
        provider: isConnectionFlow ? providerKey : undefined,
      });
    } catch (error: any) {
      this.logger.error(`OAuth login failed for provider: ${providerKey}`, error.stack);
      throw error;
    }
  }

  async exchangeOAuthCode(code: string, sessionId?: string): Promise<LoginResponse> {
    if (!code) {
      throw new BadRequestException('Code is required');
    }

    const session = await this.sessionService.findSessionByExchangeCode(code);
    if (!session || (sessionId && session.id !== sessionId)) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (session.exchangeCodeRequestedAt) {
      const now = Date.now();
      const requestedAt = session.exchangeCodeRequestedAt.getTime();
      if (now - requestedAt > 30000) {
        await this.sessionService.setExchangeCode(session.id, null as any, null as any);
        throw new BadRequestException('Code has expired');
      }
    }

    await this.sessionService.setExchangeCode(session.id, null as any, null as any);

    const user = await this.usersRepository.findOne({ where: { id: session.userId } });
    if (!user) {
      throw new BadRequestException('User not found for session');
    }

    // Reuse the existing session instead of creating a new one
    const { accessToken, refreshToken, tokenId } = await this.generateTokens(user);
    const expiresAt = await this.calculateRefreshTokenExpiration();

    await this.sessionService.createSession(user.id, tokenId, expiresAt, {
      // Reuse/update this session row instead of inserting a new one
      sessionId: session.id,
      // Preserve specific provider originally used during the OAuth login
      loginProvider: session.loginProvider || undefined,
    });

    return {
      accessToken,
      refreshToken,
      message: 'Tokens exchanged successfully',
    } as any;
  }

  async mobileAppleLogin(
    body: any,
    context: { ipAddress?: string; userAgent?: string; deviceName?: string; operatingSystem?: string; browser?: string },
  ): Promise<LoginResponse> {
    const { identityToken, payload } = body || {};

    if (!identityToken) {
      throw new BadRequestException('identityToken is required');
    }

    let appleSub: string | undefined;
    let appleEmail: string | undefined;
    let decodedClaims: Record<string, any> | undefined;
    try {
      const parts = String(identityToken).split('.');
      if (parts.length >= 2) {
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = Buffer.from(payloadB64, 'base64').toString('utf8');
        decodedClaims = JSON.parse(json);
        appleSub = decodedClaims?.sub;
        // Prefer email from payload if present, fallback to token claims
        appleEmail = (payload && payload.email) ? payload.email : decodedClaims?.email;
      }
      this.logger.debug(`Apple identityToken decoded: sub=${appleSub || 'n/a'} email=${appleEmail || 'n/a'}`);
    } catch (e: any) {
      this.logger.warn(`Failed to decode Apple identityToken: ${e.message}`);
    }

    if (!appleSub) {
      throw new BadRequestException('Unable to determine Apple subject');
    }

    // Find or create identity
    let identity = await this.identitiesRepository.findOne({
      where: appleEmail ? ({ providerType: OAuthProviderType.APPLE_SIGNIN, email: appleEmail } as any) : ({ providerType: OAuthProviderType.APPLE_SIGNIN } as any),
      relations: ['user'],
    });

    let authUser: User | null = (identity?.user as any) ?? null;

    if (!authUser) {
      if (appleEmail) {
        authUser = (await this.usersRepository.findOne({ where: { email: appleEmail } })) ?? null;
      }
      if (!authUser) {
        const created = this.usersRepository.create({
          email: appleEmail || undefined,
          username: appleEmail || `apple_${String(appleSub).slice(0, 10)}`,
          isEmailConfirmed: !!appleEmail,
        } as any);
        authUser = (await this.usersRepository.save(created as any)) as any;
      }

      const newIdentity = this.identitiesRepository.create({
        user: authUser,
        provider: OAuthProviderType.APPLE_SIGNIN,
        providerType: OAuthProviderType.APPLE_SIGNIN,
        email: appleEmail || null,
        metadata: JSON.stringify({ payload: payload || null, claims: decodedClaims || null }),
      } as any);
      await this.identitiesRepository.save(newIdentity as any);
      identity = newIdentity as any;
    } else {
      // Update existing identity metadata/email if provided
      const patch: any = { id: (identity as any).id, providerType: OAuthProviderType.APPLE_SIGNIN };
      try { patch.metadata = JSON.stringify({ payload: payload || null, claims: decodedClaims || null }); } catch { }
      if (appleEmail && !(identity as any).email) { patch.email = appleEmail; }
      await this.identitiesRepository.save({ ...(identity as any), ...patch });
    }

    const { accessToken, refreshToken, tokenId } = await this.generateTokens(authUser as any);
    const expiresAt = await this.calculateRefreshTokenExpiration();
    await this.sessionService.createSession((authUser as any).id, tokenId, expiresAt, {
      loginProvider: OAuthProviderType.APPLE_SIGNIN,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      operatingSystem: context.operatingSystem,
      browser: context.browser,
    } as any);

    // Provider metadata now stored on user identity

    // Ensure the GraphQL type non-null user is returned
    // Reload a fresh user entity with minimal fields if needed
    const userForResponse = await this.usersRepository.findOne({ where: { id: (authUser as any).id } }) as any;

    return {
      accessToken,
      refreshToken,
      user: userForResponse || (authUser as any),
      message: 'Login successful',
    } as any;
  }

  async connectMobileAppleIdentity(
    userId: string,
    body: any,
    context: { ipAddress?: string; userAgent?: string },
  ): Promise<boolean> {
    const { identityToken, payload } = body || {};
    if (!identityToken) {
      throw new BadRequestException('identityToken is required');
    }

    let appleSub: string | undefined;
    let appleEmail: string | undefined;
    let decodedClaims: Record<string, any> | undefined;
    try {
      const parts = String(identityToken).split('.');
      if (parts.length >= 2) {
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = Buffer.from(payloadB64, 'base64').toString('utf8');
        decodedClaims = JSON.parse(json);
        appleSub = decodedClaims?.sub;
        appleEmail = (payload && payload.email) ? payload.email : decodedClaims?.email;
      }
      this.logger.debug(`Apple identityToken decoded for connect: sub=${appleSub || 'n/a'} email=${appleEmail || 'n/a'}`);
    } catch (e: any) {
      this.logger.warn(`Failed to decode Apple identityToken (connect): ${e.message}`);
    }

    if (!appleSub) {
      throw new BadRequestException('Unable to determine Apple subject');
    }

    const currentUser = await this.usersRepository.findOne({ where: { id: userId } });
    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    // Check if an identity with same provider/email is already linked to another user
    if (appleEmail) {
      const existingByEmail = await this.identitiesRepository.findOne({ where: { providerType: OAuthProviderType.APPLE_SIGNIN, email: appleEmail }, relations: ['user'] } as any);
      if (existingByEmail && (existingByEmail as any).userId && (existingByEmail as any).userId !== userId) {
        throw new BadRequestException('This Apple account is already linked to another user');
      }
    }

    let identity = await this.identitiesRepository.findOne({ where: { providerType: OAuthProviderType.APPLE_SIGNIN, user: { id: userId } as any }, relations: ['user'] } as any);

    if (!identity) {
      const newIdentity = this.identitiesRepository.create({
        user: currentUser as any,
        provider: OAuthProviderType.APPLE_SIGNIN,
        providerType: OAuthProviderType.APPLE_SIGNIN,
        email: appleEmail || null,
        metadata: JSON.stringify({ payload: payload || null, claims: decodedClaims || null }),
      } as any);
      await this.identitiesRepository.save(newIdentity as any);
    } else {
      const patch: any = { id: (identity as any).id, providerType: OAuthProviderType.APPLE_SIGNIN };
      try { patch.metadata = JSON.stringify({ payload: payload || null, claims: decodedClaims || null }); } catch {}
      if (appleEmail && !(identity as any).email) { patch.email = appleEmail; }
      await this.identitiesRepository.save({ ...(identity as any), ...patch });
    }

    // No session/tokens generated here
    return true;
  }

  async register(
    registerDto: RegisterDto,
    context?: LoginContext,
  ): Promise<RegisterResponse> {
    const { email, username, password, firstName, lastName } = registerDto;
    const localeInput = (registerDto as any)?.locale as string | undefined;

    this.logger.debug(
      `Registration attempt for email: ${email}, username: ${username}`,
    );

    // Check if email or username already exist
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      const conflict = existingUser.email === email ? 'email' : 'username';
      this.logger.warn(
        `Registration failed - ${conflict} already exists: userId=${existingUser.id}`,
      );
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already in use');
      }
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(password);

    const emailEnabled = await this.emailService.isEmailEnabled();

    // Create the user
    const user = this.usersRepository.create({
      email,
      username,
      password: hashedPassword,
      hasPassword: true, // Utenti registrati hanno password
      firstName,
      lastName,
      emailConfirmed: emailEnabled ? false : true, // Se EMAIL è disabilitata, auto-conferma
    });

    const savedUser = await this.usersRepository.save(user);
    this.logger.log(
      `User registered successfully: userId=${savedUser.id}, email=${savedUser.email}, username=${savedUser.username}`,
    );

    // Track registration event
    await this.eventTrackingService.trackRegister(savedUser.id);

    // Se l'email è abilitata inviamo la conferma, altrimenti saltiamo
    if (emailEnabled) {
      try {
        const emailResult = await this.requestEmailConfirmation(
          email,
          (localeInput as unknown as Locale) ||
          (context?.locale as Locale) ||
          'en-EN',
        );
        if (emailResult.sent) {
          this.logger.debug(`Email confirmation sent: userId=${savedUser.id}, email=${email}`);
        } else {
          this.logger.debug(
            `Email confirmation not sent: userId=${savedUser.id}, email=${email}, reason=${emailResult.reason}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to send email confirmation: userId=${savedUser.id}, email=${email}, error=${error.message}`,
        );
        // Don't fail registration if email fails
      }
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = savedUser;

    // Messaggio coerente con la policy EMAIL_ENABLED
    const message = emailEnabled
      ? 'Registration completed successfully. Please check your email to confirm your account before logging in.'
      : 'Registration completed successfully.';

    if (!emailEnabled) {
      // Genera token e sessione come nel login
      const { accessToken, refreshToken, tokenId } =
        await this.generateTokens(savedUser);
      const expiresAt = await this.calculateRefreshTokenExpiration();
      await this.sessionService.createSession(
        savedUser.id,
        tokenId,
        expiresAt,
        {
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          loginProvider: OAuthProviderType.LOCAL,
        },
      );
      const { password: __, ...userWithoutPassword2 } = savedUser;
      return {
        message,
        user: userWithoutPassword2,
        emailConfirmationRequired: false,
        accessToken,
        refreshToken,
      } as any;
    }

    return {
      message,
      user: userWithoutPassword,
      emailConfirmationRequired: true,
    } as any;
  }

  async login(
    loginDto: LoginDto,
    context?: LoginContext,
  ): Promise<LoginResponse> {
    const { email, username, password, deviceInfo } = loginDto;

    // Determina quale campo usare per il login
    const identifier = email || username;
    if (!identifier) {
      this.logger.warn('Login attempt without email or username');
      throw new BadRequestException('Email or username is required');
    }

    this.logger.debug(`Login attempt for identifier: ${identifier}`);

    const user = await this.validateUser(identifier, password);
    if (!user) {
      this.logger.warn(
        `Login failed - invalid credentials: identifier=${identifier}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is confirmed
    if (!user.emailConfirmed) {
      this.logger.warn(
        `Login failed - email not confirmed: userId=${user.id}`,
      );
      throw new UnauthorizedException(
        'Please confirm your email before logging in. Check your inbox for a confirmation email.',
      );
    }

    this.logger.log(`User login successful: userId=${user.id}, email=${user.email}`);

    // Track login event
    await this.eventTrackingService.trackLogin(user.id);

    const { accessToken, refreshToken, tokenId } =
      await this.generateTokens(user);

    // Calculate token expiration based on refresh token
    const expiresAt = await this.calculateRefreshTokenExpiration();

    // Create session with device info from client
    const session = await this.sessionService.createSession(user.id, tokenId, expiresAt, {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      loginProvider: OAuthProviderType.LOCAL,
      deviceName: deviceInfo?.deviceName,
      operatingSystem:
        deviceInfo?.platform && deviceInfo?.osVersion
          ? `${deviceInfo.platform} ${deviceInfo.osVersion}`
          : deviceInfo?.platform,
      browser: deviceInfo?.platform ?? 'Unknown',
    });

    this.logger.debug(
      `Session created: userId=${user.id}, deviceId=${session.id}, tokenId=${tokenId.substring(0, 8)}..., deviceInfo=${JSON.stringify(deviceInfo)}`,
    );

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      message: 'Login successful',
    };
  }

  async validateUser(
    emailOrUsername: string,
    password: string,
  ): Promise<User | null> {
    // Verifica se l'input è un'email
    const isEmail = /\S+@\S+\.\S+/.test(emailOrUsername);

    // Cerca l'utente per email o username
    const user = await this.usersRepository.findOne({
      where: isEmail
        ? { email: emailOrUsername }
        : { username: emailOrUsername },
    });

    if (!user) {
      return null;
    }

    // Controlla se l'utente ha una password
    if (!user.hasPassword || !user.password) {
      this.logger.warn(
        `Login failed - user has no password set: userId=${user.id}`,
      );
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async refreshToken(
    refreshToken: string,
    context?: LoginContext,
  ): Promise<RefreshTokenResponse> {
    // this.logger.debug('Token refresh attempt');
    let payload: any | null = null;

    try {
      // Get JWT refresh secret from ServerSettings
      const jwtRefreshSecret = (await this.serverSettingsService.getSettingByType(ServerSettingType.JwtRefreshSecret))?.valueText
        || process.env.JWT_REFRESH_SECRET
        || 'fallback-refresh-secret';

      // First verify JWT signature and decode payload to extract tokenId (jti)
      payload = this.jwtService.verify(refreshToken, {
        secret: jwtRefreshSecret,
      });

      // Validate that the session exists and is active for this tokenId
      const existingSession = await this.sessionService.validateRefreshToken(
        payload.jti,
      );
      if (!existingSession) {
        this.logger.warn(
          `Token refresh failed - session not found or expired: tokenId=${payload.jti.substring(0, 8)}...`,
        );
        throw new UnauthorizedException('Invalid refresh token');
      }
      // Extra safety: ensure the session belongs to the same user in the token
      if (payload.sub !== existingSession.userId) {
        this.logger.warn(
          `Token refresh failed - token user mismatch: tokenUserId=${payload.sub}, sessionUserId=${existingSession.userId}`,
        );
        await this.sessionService.revokeSession(
          existingSession.userId,
          existingSession.id,
        );
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.logger.debug(`Token refresh: userId=${payload.sub}, deviceId=${existingSession.id}`);

      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        this.logger.warn(
          `Token refresh failed - user not found: userId=${payload.sub}, deviceId=${existingSession.id}`,
        );
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(user);

      // Keep original session expiration (do not extend session lifetime on refresh)
      const expiresAt = existingSession.expiresAt;

      // Update the existing session row with the new tokenId and expiration
      await this.sessionService.createSession(
        user.id,
        tokens.tokenId,
        expiresAt,
        {
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          sessionId: existingSession.id,
        },
      );

      this.logger.log(
        `Token refreshed successfully: userId=${user.id}, email=${user.email}, deviceId=${existingSession.id}`,
      );
      this.logger.debug(
        `Session updated with new token: userId=${user.id}, deviceId=${existingSession.id}, tokenId=${tokens.tokenId.substring(0, 8)}...`,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: 'Token refreshed successfully',
      };
    } catch (error) {
      this.logger.warn(`Token refresh failed: userId=${payload?.sub || 'unknown'}, error=${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async loginWithExternalProvider(
    user: User,
    context?: LoginContext,
    provider?: OAuthProviderType,
  ) {
    // this.logger.debug(
    //   `🔍 External provider login for user: ${user.id} via provider: ${provider || 'unknown'}`,
    // );
    // this.logger.debug(`🔍 Context info: ${JSON.stringify(context)}`);

    if (!user.emailConfirmed) {
      try {
        this.logger.warn(
          `OAuth login - email not confirmed, auto-confirming: userId=${user.id}`,
        );
        user.emailConfirmed = true;
        await this.usersRepository.save(user);
      } catch (err) {
        this.logger.warn(
          `Failed to auto-confirm email for OAuth user: userId=${user.id}, error=${err?.message}`,
        );
      }
    }

    const { accessToken, refreshToken, tokenId } =
      await this.generateTokens(user);

    const expiresAt = await this.calculateRefreshTokenExpiration();

    // Extract device info from User-Agent for OAuth sessions
    const deviceInfo = this.extractDeviceInfoFromUserAgent(context?.userAgent);

    // this.logger.debug(
    //   `🔍 Extracted device info: ${JSON.stringify(deviceInfo)}`,
    // );

    const session = await this.sessionService.createSession(user.id, tokenId, expiresAt, {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      loginProvider: provider,
      deviceName: deviceInfo.deviceName,
      operatingSystem: deviceInfo.operatingSystem,
      browser: deviceInfo.browser,
    });

    this.logger.debug(
      `OAuth session created: userId=${user.id}, deviceId=${session.id}, provider=${provider}, tokenId=${tokenId.substring(0, 8)}...`,
    );

    // Track OAuth login event
    await this.eventTrackingService.trackLoginOauth(user.id);

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    this.logger.debug(`Password change attempt: userId=${userId}`);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`Password change failed - user not found: userId=${userId}`);
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      this.logger.warn(
        `Password change failed - incorrect current password: userId=${userId}`,
      );
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await this.hashPassword(newPassword);

    await this.usersRepository.update(userId, {
      password: hashedNewPassword,
      hasPassword: true, // Ora l'utente ha una password
    });

    this.logger.log(`Password changed successfully: userId=${userId}`);
  }

  async setPassword(
    userId: string,
    setPasswordDto: SetPasswordDto,
  ): Promise<void> {
    const { newPassword } = setPasswordDto;

    this.logger.debug(`Password set attempt for OAuth user: userId=${userId}`);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`Password set failed - user not found: userId=${userId}`);
      throw new UnauthorizedException('User not found');
    }

    if (user.hasPassword) {
      this.logger.warn(
        `Password set failed - user already has password: userId=${userId}`,
      );
      throw new BadRequestException(
        'User already has a password. Use change-password instead.',
      );
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await this.usersRepository.update(userId, {
      password: hashedPassword,
      hasPassword: true, // Ora l'utente ha una password
    });

    this.logger.log(`Password set successfully for OAuth user: userId=${userId}`);
  }

  async getUserIdentities(userId: string): Promise<UserIdentity[]> {
    this.logger.debug(`Getting OAuth identities: userId=${userId}`);

    const identities = await this.identitiesRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    this.logger.log(
      `Found ${identities.length} OAuth identities: userId=${userId}`,
    );
    return identities;
  }

  async disconnectIdentity(userId: string, identityId: string): Promise<void> {
    this.logger.debug(
      `Disconnecting OAuth identity: userId=${userId}, identityId=${identityId}`,
    );

    const identity = await this.identitiesRepository.findOne({
      where: { id: identityId },
    });

    if (!identity) {
      throw new BadRequestException('Identity not found');
    }
    if (identity.userId !== userId) {
      throw new UnauthorizedException('Cannot remove identity of another user');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const identities = await this.getUserIdentities(userId);
    const remainingCount = identities.length - 1;

    // Prevent locking the user out: if no password and this is the last identity
    if (!user.hasPassword && remainingCount <= 0) {
      throw new BadRequestException(
        'You must set a password before disconnecting your last OAuth identity.',
      );
    }

    await this.identitiesRepository.delete(identityId);

    this.logger.log(
      `Disconnected OAuth identity successfully: userId=${userId}, identityId=${identityId}`,
    );
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  /**
   * Decode JWT token without verification (for logout purposes)
   * This allows us to extract the token ID even from expired tokens
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      // Decode without verification to get payload
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(''),
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      this.logger.debug(`Failed to decode token: ${error.message}`);
      return null;
    }
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string; tokenId: string }> {
    const tokenId = uuidv4();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti: tokenId,
    };

    const accessTokenExpiration = (await this.serverSettingsService.getSettingByType(ServerSettingType.JwtAccessTokenExpiration))?.valueText || '15m';
    const refreshTokenExpiration = (await this.serverSettingsService.getSettingByType(ServerSettingType.JwtRefreshTokenExpiration))?.valueText || '7d';

    // Get JWT secrets from ServerSettings
    const jwtSecret = (await this.serverSettingsService.getSettingByType(ServerSettingType.JwtSecret))?.valueText
      || process.env.JWT_SECRET
      || 'fallback-secret';
    const jwtRefreshSecret = (await this.serverSettingsService.getSettingByType(ServerSettingType.JwtRefreshSecret))?.valueText
      || process.env.JWT_REFRESH_SECRET
      || 'fallback-refresh-secret';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: accessTokenExpiration,
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: refreshTokenExpiration,
      }),
    ]);

    return { accessToken, refreshToken, tokenId };
  }

  private async calculateRefreshTokenExpiration(): Promise<Date> {
    const expirationString = (await this.serverSettingsService.getSettingByType(ServerSettingType.JwtRefreshTokenExpiration))?.valueText || '7d';
    const expiresAt = new Date();

    // Parse the expiration string (e.g., "14d", "7d", "1h", "30m")
    const unit = expirationString.slice(-1);
    const value = parseInt(expirationString.slice(0, -1));

    switch (unit) {
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + value);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + value);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + value);
        break;
      case 's':
        expiresAt.setSeconds(expiresAt.getSeconds() + value);
        break;
      default:
        // Default to 7 days if unable to parse
        expiresAt.setDate(expiresAt.getDate() + 7);
    }

    return expiresAt;
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update only the provided fields
    if (updateProfileDto.firstName !== undefined) {
      user.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName !== undefined) {
      user.lastName = updateProfileDto.lastName;
    }
    if (updateProfileDto.avatar !== undefined) {
      user.avatar = updateProfileDto.avatar;
    }

    const updatedUser = await this.usersRepository.save(user);

    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  // Methods for future external providers
  async findOrCreateUserFromProvider(
    providerTypeEnum: OAuthProviderType,
    providerData: any,
    currentUserId?: string,
  ): Promise<User> {
    const {
      email,
      name,
      avatarUrl,
      username,
      firstName,
      lastName,
    } = providerData as {
      email?: string;
      name?: string;
      avatarUrl?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    };

    // 1) Try to find existing identity (only if we have an email)
    let existingIdentity: UserIdentity | null = null as any;
    if (email) {
      existingIdentity = await this.identitiesRepository.findOne({
        where: { providerType: providerTypeEnum as any, email } as any,
      });
    }
    if (existingIdentity) {
      this.logger.log(
        `🪪 Existing identity found: ${existingIdentity.id} → userId=${existingIdentity.userId}`,
      );

      // If we have a current user and the identity belongs to a different user, we have a conflict
      if (currentUserId && existingIdentity.userId !== currentUserId) {
        this.logger.warn(
          `⚠️ Identity conflict: ${providerTypeEnum} is already linked to user ${existingIdentity.userId}, but current user is ${currentUserId}`,
        );
        throw new ConflictException(
          `This ${providerTypeEnum} account is already linked to another user`,
        );
      }

      const user = await this.usersRepository.findOne({
        where: { id: existingIdentity.userId },
      });
      if (user) {
        // Optionally update identity avatar/email if changed
        let identityNeedsUpdate = false;
        if (avatarUrl && existingIdentity.avatarUrl !== avatarUrl) {
          existingIdentity.avatarUrl = avatarUrl;
          identityNeedsUpdate = true;
        }
        if (email && existingIdentity.email !== email) {
          existingIdentity.email = email;
          identityNeedsUpdate = true;
        }
        if (identityNeedsUpdate) {
          this.logger.log(
            '🖊️  Updating existing identity with new email/avatar',
          );
          await this.identitiesRepository.save(existingIdentity);
        }
        this.logger.log(
          `✅ Returning user from existing identity: ${user.id} (${user.email})`,
        );
        return user;
      }
      this.logger.warn(
        `⚠️ Identity exists but user not found: userId=${existingIdentity.userId}`,
      );
    }

    // 2) If we have a current user ID, use that user
    let user: User | null = null;
    if (currentUserId) {
      this.logger.log(`👤 Using current authenticated user: userId=${currentUserId}`);
      user = await this.usersRepository.findOne({
        where: { id: currentUserId },
      });
      if (!user) {
        this.logger.error(`❌ Current user not found: userId=${currentUserId}`);
        throw new BadRequestException('Current user not found');
      }
      this.logger.log(`✅ Found current user: userId=${user.id}, email=${user.email}`);
    } else {
      // 3) Fallback by email (with better error handling) - only if no current user
      if (email) {
        // this.logger.log(`📧 Looking up user by email: ${email}`);
        try {
          user = await this.usersRepository.findOne({ where: { email } });
          if (user) {
            this.logger.log(
              `🧑‍💼 Found existing user by email: userId=${user.id}, username=${user.username}`,
            );
          } else {
            // this.logger.log(`📧 No user found with email: ${email}`);
          }
        } catch (error) {
          this.logger.error(
            `❌ Error looking up user by email: error=${error.message}`,
          );
        }
      }

      // 4) Fallback by username (if email lookup failed) - only if no current user
      if (!user && username) {
        // this.logger.log(`👤 Looking up user by username: ${username}`);
        try {
          user = await this.usersRepository.findOne({ where: { username } });
          if (user) {
            this.logger.log(
              `🧑‍💼 Found existing user by username: userId=${user.id}, email=${user.email}`,
            );
          } else {
            // this.logger.log(`👤 No user found with username: ${username}`);
          }
        } catch (error) {
          this.logger.error(
            `❌ Error looking up user by username: error=${error.message}`,
          );
        }
      }
    }

    // 5) Create user if needed (only if no current user was provided)
    if (!user && !currentUserId) {
      const typeLabel = providerTypeEnum?.toString().toLowerCase();
      const finalUsername = username || `${typeLabel}_${Math.random().toString(36).slice(2, 8)}`;
      const derivedEmail =
        email || `${finalUsername}@users.noreply.${typeLabel}.com`;
      this.logger.log(
        `🆕 Creating new user: username=${finalUsername}, email=${derivedEmail}`,
      );

      try {
        user = this.usersRepository.create({
          email: derivedEmail,
          username: finalUsername,
          firstName,
          lastName,
          password: '',
          hasPassword: false,
          avatar: avatarUrl,
          emailConfirmed: true, // OAuth users have verified emails
        });
        user = await this.usersRepository.save(user);
        this.logger.log(`✅ User created: userId=${user.id}, provider=${providerTypeEnum}`);
        // Send welcome email for newly created OAuth users
        try {
          const inferredLocale: Locale =
            (providerData?.locale as Locale) || 'en-EN';
          // this.logger.debug(`📧 OAuth new user: sending welcome with locale='${inferredLocale}' provider=${providerTypeEnum}`);
          await this.emailService.sendWelcomeEmail(
            user.email,
            user.username ?? user.email.split('@')[0],
            inferredLocale,
          );
        } catch (welcomeErr) { }
      } catch (error) {
        this.logger.error(`❌ Failed to create user: ${error.message}`);
        if (error.code === '23505') {
          // Duplicate key error
          this.logger.error(
            `❌ Duplicate constraint violated. Details: ${error.detail}`,
          );
          // Try to find the existing user one more time
          if (email) {
            user = await this.usersRepository.findOne({ where: { email } });
          }
          if (!user && username) {
            user = await this.usersRepository.findOne({ where: { username } });
          }
          if (user) {
            this.logger.log(
              `🔄 Found existing user after duplicate error: userId=${user.id}`,
            );
          } else {
            throw error; // Re-throw if we still can't find the user
          }
        } else {
          throw error;
        }
      }
    }

    // Ensure we have a user at this point
    if (!user) {
      const errorMsg = currentUserId
        ? `Cannot link OAuth provider ${providerTypeEnum} to user: current user not found`
        : `Cannot create or find user for OAuth provider ${providerTypeEnum}`;
      this.logger.error(`❌ ${errorMsg}`);
      throw new BadRequestException(errorMsg);
    }

    // Update avatar, firstName, lastName from provider if available
    // For connection flows (currentUserId provided), only update if the fields are empty
    let userNeedsUpdate = false;

    if (avatarUrl) {
      const shouldUpdateAvatar = currentUserId
        ? !user.avatar
        : user.avatar !== avatarUrl;
      if (shouldUpdateAvatar) {
        this.logger.log(
          currentUserId
            ? '🖊️  Setting user avatar from provider (connection flow - was empty)'
            : '🖊️  Updating user avatar from provider',
        );
        user.avatar = avatarUrl;
        userNeedsUpdate = true;
      }
    }

    if (firstName && currentUserId && !user.firstName) {
      this.logger.log(
        '🖊️  Setting user firstName from provider (connection flow - was empty)',
      );
      user.firstName = firstName;
      userNeedsUpdate = true;
    }

    if (lastName && currentUserId && !user.lastName) {
      this.logger.log(
        '🖊️  Setting user lastName from provider (connection flow - was empty)',
      );
      user.lastName = lastName;
      userNeedsUpdate = true;
    }

    // If user doesn't have email confirmed and we're connecting an OAuth provider, confirm the email
    if (!user.emailConfirmed && email) {
      this.logger.log(
        '🖊️  Confirming user email via OAuth provider connection',
      );
      user.emailConfirmed = true;
      userNeedsUpdate = true;
    }

    if (userNeedsUpdate) {
      await this.usersRepository.save(user);
    }

    // 6) Ensure identity exists and is linked
    let identity = await this.identitiesRepository.findOne({
      where: ({ providerType: providerTypeEnum as any, userId: user.id } as any),
    });
    if (!identity) {
      // this.logger.log('🆕 Creating new user identity link');
      const newIdentity = this.identitiesRepository.create({
        providerType: providerTypeEnum,
        email: email || null,
        avatarUrl: avatarUrl || null,
        userId: user.id,
      } as any);
      identity = await this.identitiesRepository.save(newIdentity as any);
    } else {
      let identityNeedsUpdate = false;
      if (identity.userId !== user.id) {
        this.logger.warn(
          `🔗 Identity linked to different user (was ${identity.userId}, will be ${user.id})`,
        );
        identity.userId = user.id;
        identityNeedsUpdate = true;
      }
      if (email && identity.email !== email) {
        identity.email = email;
        identityNeedsUpdate = true;
      }
      if (avatarUrl && identity.avatarUrl !== avatarUrl) {
        identity.avatarUrl = avatarUrl;
        identityNeedsUpdate = true;
      }
      if (!identityNeedsUpdate) {
        this.logger.log('ℹ️  Identity already up to date');
        return user;
      }
    }

    if (identity) {
      try {
        await this.identitiesRepository.save(identity as any);
        this.logger.log(
          `✅ Identity saved and linked: identityId=${(identity as any).id} → userId=${user.id}`,
        );
      } catch (error) {
        this.logger.error(`❌ Failed to save identity: ${error.message}`);
        // Don't fail the entire process if identity save fails
      }
    }

    return user;
  }

  /**
   * Request password reset for a user
   * Token expires 24 hours from request time
   * Rate limiting: minimum 1 minute between requests
   */
  async requestPasswordReset(email: string, locale?: string): Promise<boolean> {
    const emailEnabled = await this.emailService.isEmailEnabled();
    if (!emailEnabled) {
      this.logger.warn(`Password reset requested but EMAIL_ENABLED is false`);
      throw new BadRequestException('Email functionality is disabled');
    }

    try {
      const user = await this.usersRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal if user exists
        this.logger.log(
          `Password reset requested for non-existent email: ${email}`,
        );
        return true;
      }

      // Check rate limiting: minimum 1 minute between requests
      if (user.resetTokenRequestedAt) {
        const timeSinceLastRequest =
          Date.now() - user.resetTokenRequestedAt.getTime();
        const minInterval = 60 * 1000; // 1 minute in milliseconds

        if (timeSinceLastRequest < minInterval) {
          const remainingTime = Math.ceil(
            (minInterval - timeSinceLastRequest) / 1000,
          );
          this.logger.warn(
            `Password reset rate limit exceeded: userId=${user.id}, remainingTime=${remainingTime}s`,
          );
          throw new BadRequestException(
            `Please wait ${remainingTime} seconds before requesting another password reset`,
          );
        }
      }

      // Generate new reset token (6 characters)
      const resetToken = this.generateResetToken();

      user.resetTokenRequestedAt = new Date();

      user.resetToken = resetToken;
      await this.usersRepository.save(user);

      // Send reset email
      try {
        await this.emailService.sendPasswordResetEmail(
          user.email,
          resetToken,
          (locale as Locale) || 'en-EN',
        );
        this.logger.log(
          `Password reset email sent: userId=${user.id}`,
        );
        return true;
      } catch (emailError) {
        this.logger.error(
          `Failed to send password reset email: userId=${user.id}, error=${emailError.message}`,
        );

        // On email failure, clear the token but NEVER reset the request date
        // This prevents spam while maintaining the rate limit
        user.resetToken = null;
        await this.usersRepository.save(user);

        throw new InternalServerErrorException(
          'Failed to send password reset email with 6-character code. Please try again later.',
        );
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `Password reset request with 6-character code failed for email ${email}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to process password reset request. Please try again later.',
      );
    }
  }

  /**
   * Reset password using reset token
   * Token must be used within 24 hours of request
   */
  async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`Password reset attempt with token: ${resetToken}`);

      // First validate the token using the dedicated validation method
      const isTokenValid = await this.validateResetToken(resetToken);
      if (!isTokenValid) {
        this.logger.warn(
          `Password reset failed: invalid or expired token - ${resetToken}`,
        );
        throw new BadRequestException('Invalid or expired reset code');
      }

      // Token is valid, get user details
      const user = await this.usersRepository.findOne({
        where: { resetToken },
      });

      if (!user) {
        this.logger.warn(
          `Password reset failed: user not found for valid token - ${resetToken}`,
        );
        throw new BadRequestException('Invalid reset code');
      }

      const hashedPassword = await this.hashPassword(newPassword);

      user.password = hashedPassword;
      user.hasPassword = true;
      user.resetToken = null;
      user.resetTokenRequestedAt = null;
      user.updatedAt = new Date();

      await this.usersRepository.save(user);

      this.logger.log(
        `Password reset successful: userId=${user.id}, resetToken=${resetToken}`,
      );
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Password reset with validated token failed: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to reset password. Please try again later.',
      );
    }
  }

  /**
   * Generate a 6-character reset token
   * Uses numbers and uppercase letters for easy reading
   */
  private generateResetToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate reset token
   * Returns true if token is valid and not expired (within 24 hours of request)
   */
  async validateResetToken(resetToken: string): Promise<boolean> {
    try {
      this.logger.log(`Validating reset token: ${resetToken}`);

      const user = await this.usersRepository.findOne({
        where: { resetToken },
      });

      if (!user) {
        this.logger.warn(
          `Reset token validation failed: token not found - ${resetToken}`,
        );
        return false;
      }

      if (!user.resetTokenRequestedAt) {
        this.logger.warn(
          `Reset token validation failed - no request time: userId=${user.id}, resetToken=${resetToken}`,
        );
        return false;
      }

      // Check if token has expired (24 hours from request)
      const tokenAge = Date.now() - user.resetTokenRequestedAt.getTime();
      const maxTokenAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (tokenAge > maxTokenAge) {
        this.logger.warn(
          `Reset token validation failed - token expired: userId=${user.id}, resetToken=${resetToken}, ageMinutes=${Math.round(tokenAge / 1000 / 60)}`,
        );
        return false;
      }

      this.logger.log(
        `Reset token validation successful: userId=${user.id}, resetToken=${resetToken}, ageMinutes=${Math.round(tokenAge / 1000 / 60)}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Reset token validation error: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private extractDeviceInfoFromUserAgent(userAgent: string | undefined): {
    deviceName: string;
    operatingSystem: string;
    browser: string;
  } {
    if (!userAgent) {
      return {
        deviceName: 'Unknown Device',
        operatingSystem: 'Unknown OS',
        browser: 'Unknown Browser',
      };
    }

    const lowerCaseUserAgent = userAgent.toLowerCase();

    // Check for iOS devices
    if (lowerCaseUserAgent.includes('iphone')) {
      return {
        deviceName: 'iPhone',
        operatingSystem: 'iOS',
        browser: 'Safari Mobile',
      };
    }

    if (lowerCaseUserAgent.includes('ipad')) {
      return {
        deviceName: 'iPad',
        operatingSystem: 'iOS',
        browser: 'Safari Mobile',
      };
    }

    if (lowerCaseUserAgent.includes('ipod')) {
      return {
        deviceName: 'iPod',
        operatingSystem: 'iOS',
        browser: 'Safari Mobile',
      };
    }

    // Check for Android
    if (lowerCaseUserAgent.includes('android')) {
      return {
        deviceName: 'Android Device',
        operatingSystem: 'Android',
        browser: 'Chrome Mobile',
      };
    }

    // Check for Windows
    if (lowerCaseUserAgent.includes('windows')) {
      if (lowerCaseUserAgent.includes('mobile')) {
        return {
          deviceName: 'Windows Phone',
          operatingSystem: 'Windows Mobile',
          browser: 'IE Mobile',
        };
      }
      return {
        deviceName: 'Windows PC',
        operatingSystem: 'Windows',
        browser: 'Desktop Browser',
      };
    }

    // Check for Mac
    if (
      lowerCaseUserAgent.includes('macintosh') ||
      lowerCaseUserAgent.includes('mac os x')
    ) {
      if (
        lowerCaseUserAgent.includes('iphone') ||
        lowerCaseUserAgent.includes('ipad')
      ) {
        return {
          deviceName: 'iOS Device',
          operatingSystem: 'iOS',
          browser: 'Safari Mobile',
        };
      }
      return {
        deviceName: 'Mac',
        operatingSystem: 'macOS',
        browser: 'Safari',
      };
    }

    // Check for Linux
    if (lowerCaseUserAgent.includes('linux')) {
      if (lowerCaseUserAgent.includes('android')) {
        return {
          deviceName: 'Android Device',
          operatingSystem: 'Android',
          browser: 'Chrome Mobile',
        };
      }
      return {
        deviceName: 'Linux PC',
        operatingSystem: 'Linux',
        browser: 'Desktop Browser',
      };
    }

    // Check for specific browsers on web
    if (lowerCaseUserAgent.includes('chrome')) {
      return {
        deviceName: 'Web Browser',
        operatingSystem: 'Web Platform',
        browser: 'Chrome',
      };
    }

    if (lowerCaseUserAgent.includes('firefox')) {
      return {
        deviceName: 'Web Browser',
        operatingSystem: 'Web Platform',
        browser: 'Firefox',
      };
    }

    if (
      lowerCaseUserAgent.includes('safari') &&
      !lowerCaseUserAgent.includes('iphone') &&
      !lowerCaseUserAgent.includes('ipad')
    ) {
      return {
        deviceName: 'Web Browser',
        operatingSystem: 'Web Platform',
        browser: 'Safari',
      };
    }

    if (lowerCaseUserAgent.includes('opera')) {
      return {
        deviceName: 'Web Browser',
        operatingSystem: 'Web Platform',
        browser: 'Opera',
      };
    }

    if (lowerCaseUserAgent.includes('edge')) {
      return {
        deviceName: 'Web Browser',
        operatingSystem: 'Web Platform',
        browser: 'Edge',
      };
    }

    // Default to Web Browser if no specific match
    return {
      deviceName: 'Web Browser',
      operatingSystem: 'Web Platform',
      browser: 'Unknown Browser',
    };
  }

  async requestEmailConfirmation(
    email: string,
    locale: Locale = 'en-EN',
  ): Promise<{ sent: boolean; reason?: string }> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists or not
      this.logger.debug(
        `Email confirmation requested for non-existent email: ${email}`,
      );
      return { sent: false, reason: 'Email not found' };
    }

    if (user.emailConfirmed) {
      // Email already confirmed
      this.logger.debug(
        `Email confirmation requested for already confirmed email: ${email}`,
      );
      return { sent: false, reason: 'Email already confirmed' };
    }

    // Generate confirmation code (6 characters)
    const confirmationCode = this.generateResetToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hours expiry

    // Update user with confirmation code
    await this.usersRepository.update(user.id, {
      emailConfirmationToken: confirmationCode,
      emailConfirmationTokenRequestedAt: new Date(),
    });

    // Send confirmation email
    try {
      await this.emailService.sendEmailConfirmation(
        email,
        confirmationCode,
        locale,
      );
      this.logger.debug(
        `Email confirmation with 6-character code sent to ${email}`,
      );
      return { sent: true };
    } catch (error) {
      this.logger.warn(
        `Failed to send email confirmation to ${email}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to send confirmation email',
      );
    }
  }

  async confirmEmail(
    code: string,
    locale?: string,
  ): Promise<{ confirmed: boolean; reason?: string }> {
    const user = await this.usersRepository.findOne({
      where: { emailConfirmationToken: code },
    });

    if (!user) {
      return { confirmed: false, reason: 'Invalid code' };
    }

    // Check if code is expired (24 hours)
    if (!user.emailConfirmationTokenRequestedAt) {
      return { confirmed: false, reason: 'Invalid code' };
    }

    const tokenAge =
      Date.now() - user.emailConfirmationTokenRequestedAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (tokenAge > maxAge) {
      // Code expired, remove it
      await this.usersRepository.update(user.id, {
        emailConfirmationToken: null,
        emailConfirmationTokenRequestedAt: null,
      });
      return { confirmed: false, reason: 'Code expired' };
    }

    // Confirm email and clear code
    await this.usersRepository.update(user.id, {
      emailConfirmed: true,
      emailConfirmationToken: null,
      emailConfirmationTokenRequestedAt: null,
    });

    this.logger.log(`Email confirmed: userId=${user.id}, email=${user.email}`);
    // Send welcome email after successful confirmation (best UX timing)
    try {
      const inferredLocale: Locale = (locale as Locale) || 'en-EN';
      this.logger.debug(
        `📧 Sending welcome email: userId=${user.id}, locale=${inferredLocale}`,
      );
      await this.emailService.sendWelcomeEmail(
        user.email,
        user.username ?? user.email.split('@')[0],
        inferredLocale,
      );
      this.logger.debug(`Welcome email sent to ${user.email}`);
    } catch (err) {
      this.logger.warn(
        `Failed to send welcome email to ${user.email}: ${err?.message}`,
      );
    }
    return { confirmed: true };
  }

  /**
   * Check if a user's email is confirmed
   * Useful for frontend to determine if user can proceed
   */
  async isEmailConfirmed(email: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({ where: { email } });
    return user?.emailConfirmed || false;
  }

  private async hashPassword(plainPassword: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(plainPassword, saltRounds);
  }
}
