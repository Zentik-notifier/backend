import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class GraphQLAuthService {
  constructor(private configService: ConfigService) {}

  async validateWebSocketToken(token: string): Promise<any> {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace('Bearer ', '');

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const decoded = jwt.verify(cleanToken, jwtSecret);
      return decoded;
    } catch (error) {
      console.error('WebSocket token validation failed:', error);
      return null;
    }
  }
}
