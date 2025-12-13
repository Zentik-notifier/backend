import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Changelog } from '../entities/changelog.entity';
import { AuthModule } from '../auth/auth.module';
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { ChangelogController } from './changelog.controller';
import { ChangelogResolver } from './changelog.resolver';
import { ChangelogService } from './changelog.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Changelog]),
    forwardRef(() => AuthModule),
    ServerManagerModule,
  ],
  controllers: [ChangelogController],
  providers: [ChangelogService, ChangelogResolver],
  exports: [ChangelogService],
})
export class ChangelogModule {}
