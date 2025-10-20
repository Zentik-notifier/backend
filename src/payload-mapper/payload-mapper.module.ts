import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EntityExecutionModule } from '../entity-execution/entity-execution.module';
import { UsersModule } from '../users/users.module';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { PayloadMapperController } from './payload-mapper.controller';
import { PayloadMapperResolver } from './payload-mapper.resolver';
import { PayloadMapperService } from './payload-mapper.service';
import {
  BuiltinParserService,
  AuthentikParser,
  ServarrParser,
  RailwayParser,
  GitHubParser,
  ExpoParser,
  StatusIoParser,
  BuiltinParserLoggerService,
} from './builtin';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayloadMapper]),
    AuthModule,
    EntityExecutionModule,
    UsersModule,
  ],
  controllers: [PayloadMapperController],
  providers: [
    PayloadMapperService,
    PayloadMapperResolver,
    BuiltinParserService,
    AuthentikParser,
    ServarrParser,
    RailwayParser,
    GitHubParser,
    ExpoParser,
    StatusIoParser,
    BuiltinParserLoggerService,
  ],
  exports: [PayloadMapperService],
})
export class PayloadMapperModule {}
