import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AccessTokenService } from '../access-token.service';

@Injectable()
export class AccessTokenLoggingMiddleware implements NestMiddleware {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer zat_')) {
      // This is an access token request - usage will be logged by the service
      // when validating the token, so no additional action needed here
    }

    next();
  }
}
