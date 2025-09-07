import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PropertyMapping } from '../entities/property-mapping.entity';
import { PropertyMappingsController } from './property-mappings.controller';
import { PropertyMappingsService } from './property-mappings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyMapping]),
    AuthModule,
  ],
  controllers: [PropertyMappingsController],
  providers: [PropertyMappingsService],
  exports: [PropertyMappingsService],
})
export class PropertyMappingsModule {}