import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { SystemAccessTokenController } from './system-access-token.controller';
import { SystemAccessToken } from './system-access-token.entity';
import { SystemAccessTokenGuard } from './system-access-token.guard';
import { SystemAccessTokenResolver } from './system-access-token.resolver';
import { SystemAccessTokenService } from './system-access-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemAccessToken, User]), AuthModule],
  providers: [
    SystemAccessTokenService,
    SystemAccessTokenResolver,
    SystemAccessTokenGuard,
  ],
  controllers: [SystemAccessTokenController],
  exports: [SystemAccessTokenService, SystemAccessTokenGuard],
})
export class SystemAccessTokenModule {}
