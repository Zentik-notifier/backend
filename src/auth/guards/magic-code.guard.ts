import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Repository } from 'typeorm';
import { isMagicCode } from '../../common/utils/code-generation.utils';
import { UserBucket } from '../../entities/user-bucket.entity';
import { AccessTokenService } from '../access-token.service';
import { JwtOrAccessTokenGuard } from './jwt-or-access-token.guard';

@Injectable()
export class MagicCodeGuard implements CanActivate {
  private readonly logger = new Logger(MagicCodeGuard.name);
  private readonly jwtOrAccessTokenGuard: JwtOrAccessTokenGuard;

  constructor(
    @InjectRepository(UserBucket)
    private readonly userBucketRepository: Repository<UserBucket>,
    private readonly accessTokenService: AccessTokenService,
  ) {
    // Create instance of JwtOrAccessTokenGuard
    this.jwtOrAccessTokenGuard = new JwtOrAccessTokenGuard(this.accessTokenService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bucketId = this.extractBucketId(context);
    
    // Check if it's a magic code
    if (bucketId && isMagicCode(bucketId)) {
      try {
        // Resolve magic code to userBucket
        const userBucket = await this.userBucketRepository.findOne({
          where: { magicCode: bucketId },
          relations: ['bucket'],
        });

        if (!userBucket || !userBucket.bucket) {
          throw new NotFoundException(`Magic code '${bucketId}' not found`);
        }

        // Set user on request so downstream guards/decorators can use it
        const request = this.getRequest(context);
        request.user = { id: userBucket.userId };
        request.isMagicCode = true;

        // Replace the magic code with the actual bucket ID in the request
        this.replaceBucketIdInRequest(context, userBucket.bucket.id);

        // this.logger.log(`Magic code '${bucketId}' resolved to user ${userBucket.userId} and bucket ${userBucket.bucket.id}`);
        return true;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        this.logger.error(`Failed to resolve magic code '${bucketId}':`, error.message);
        throw new NotFoundException(`Failed to resolve magic code: ${error.message}`);
      }
    }

    // Not a magic code, delegate to JwtOrAccessTokenGuard
    return this.jwtOrAccessTokenGuard.canActivate(context);
  }

  private extractBucketId(context: ExecutionContext): string | undefined {
    // For GraphQL, get bucketId or magicCode from args
    if (context.getType<any>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      const args = ctx.getArgs();
      return args?.input?.magicCode || args?.input?.bucketId || args?.magicCode || args?.bucketId;
    }
    
    // For REST, try to get bucketId or magicCode from different sources
    const request = context.switchToHttp().getRequest();
    const body = request.body || {};
    const query = request.query || {};
    const params = request.params || {};
    
    // Check common locations - prioritize magicCode
    return body.magicCode || query.magicCode || params.magicCode || body.bucketId || query.bucketId || params.bucketId;
  }

  private replaceBucketIdInRequest(context: ExecutionContext, resolvedBucketId: string): void {
    // For GraphQL, replace in args
    if (context.getType<any>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      const args = ctx.getArgs();
      if (args?.input?.magicCode) {
        args.input.bucketId = resolvedBucketId;
        delete args.input.magicCode;
      } else if (args?.input?.bucketId) {
        args.input.bucketId = resolvedBucketId;
      } else if (args?.magicCode) {
        args.bucketId = resolvedBucketId;
        delete args.magicCode;
      } else if (args?.bucketId) {
        args.bucketId = resolvedBucketId;
      }
    } else {
      // For REST, replace in body
      const request = context.switchToHttp().getRequest();
      if (request.body?.magicCode) {
        request.body.bucketId = resolvedBucketId;
        delete request.body.magicCode;
      } else if (request.body?.bucketId) {
        request.body.bucketId = resolvedBucketId;
      }
    }
  }

  private getRequest(context: ExecutionContext): any {
    if (context.getType<any>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext();

      // Handle WebSocket GraphQL subscriptions
      if (ctx.websocketHeader?.connectionParams) {
        const websocketHeader = ctx.websocketHeader?.connectionParams || {};
        return { headers: { ...websocketHeader } };
      }

      return ctx.req;
    }

    return context.switchToHttp().getRequest();
  }
}

