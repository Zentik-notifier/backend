import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // Primary field (can be email or username)
      passReqToCallback: true, // Pass request to validate method
    });
  }

  async validate(req: any, email: string, password: string): Promise<any> {
    // Get both email and username from request body
    const { email: emailField, username: usernameField } = req.body;

    // Use the field that was provided
    const identifier = emailField || usernameField || email;

    if (!identifier) {
      throw new UnauthorizedException('Email or username is required');
    }

    const user = await this.authService.validateUser(identifier, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
