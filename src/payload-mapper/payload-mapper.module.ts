import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { PayloadMapperController } from './payload-mapper.controller';
import { PayloadMapperResolver } from './payload-mapper.resolver';
import { PayloadMapperService } from './payload-mapper.service';
import { BuiltinParserService, AuthentikParser, ServarrParser, RailwayParser, BuiltinParserLoggerService } from './builtin';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayloadMapper]),
    AuthModule,
  ],
  controllers: [PayloadMapperController],
  providers: [PayloadMapperService, PayloadMapperResolver, BuiltinParserService, AuthentikParser, ServarrParser, RailwayParser, BuiltinParserLoggerService],
  exports: [PayloadMapperService],
})
export class PayloadMapperModule { }
