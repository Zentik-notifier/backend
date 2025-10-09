import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { UpdateServerSettingDto } from './dto/server-setting.dto';
import { ServerSettingsService } from './server-settings.service';
import { AdminOnlyGuard } from 'src/auth/guards/admin-only.guard';

@ApiTags('Server Settings')
@Controller('server-settings')
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class ServerSettingsController {
    constructor(private readonly serverSettingsService: ServerSettingsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all server settings' })
    async getAllSettings(): Promise<ServerSetting[]> {
        return this.serverSettingsService.getAllSettings();
    }

    @Get(':configType')
    @ApiOperation({ summary: 'Get a specific server setting by type' })
    async getSettingByType(
        @Param('configType') configType: ServerSettingType,
    ): Promise<ServerSetting | null> {
        return this.serverSettingsService.getSettingByType(configType);
    }

    @Patch(':configType')
    @ApiOperation({ summary: 'Update an existing server setting' })
    async updateSetting(
        @Param('configType') configType: ServerSettingType,
        @Body() dto: UpdateServerSettingDto,
    ): Promise<ServerSetting> {
        return this.serverSettingsService.updateSetting(configType, dto);
    }
}
