import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { OAuthProvider } from '../entities/oauth-provider.entity';
import { OAuthProvidersController } from './oauth-providers.controller';
import { OAuthProvidersInitService } from './oauth-providers.init.service';
import { OAuthProvidersResolver } from './oauth-providers.resolver';
import { OAuthProvidersService } from './oauth-providers.service';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthProvider]), forwardRef(() => AuthModule), CommonModule],
  controllers: [OAuthProvidersController],
  providers: [
    OAuthProvidersService,
    OAuthProvidersInitService,
    OAuthProvidersResolver,
  ],
  exports: [OAuthProvidersService],
})
export class OAuthProvidersModule {}
