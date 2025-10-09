import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { UpdateServerSettingDto } from './dto/server-setting.dto';
import { ServerSettingsService } from './server-settings.service';

@Resolver(() => ServerSetting)
@UseGuards(JwtOrAccessTokenGuard)
export class ServerSettingsResolver {
  constructor(private readonly serverSettingsService: ServerSettingsService) {}

  @Query(() => [ServerSetting], { name: 'serverSettings' })
  async getAllSettings(): Promise<ServerSetting[]> {
    return this.serverSettingsService.getAllSettings();
  }

  @Query(() => ServerSetting, { name: 'serverSetting', nullable: true })
  async getSettingByType(
    @Args('configType', { type: () => ServerSettingType }) configType: ServerSettingType,
  ): Promise<ServerSetting | null> {
    return this.serverSettingsService.getSettingByType(configType);
  }

  @Mutation(() => ServerSetting)
  async updateServerSetting(
    @Args('configType', { type: () => ServerSettingType }) configType: ServerSettingType,
    @Args('input') dto: UpdateServerSettingDto,
  ): Promise<ServerSetting> {
    return this.serverSettingsService.updateSetting(configType, dto);
  }
}
