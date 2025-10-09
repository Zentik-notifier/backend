import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupInfoDto } from './dto';
import { BackupResult, ServerManagerService } from './server-manager.service';

@ApiTags('server-manager')
@Controller('server-manager')
@UseGuards(JwtAuthGuard)
export class ServerManagerController {
  constructor(private readonly serverManagerService: ServerManagerService) {}

  @Get('backups')
  @ApiOperation({ summary: 'List all database backups' })
  @ApiResponse({
    status: 200,
    description: 'List of backup files',
    type: [BackupInfoDto],
  })
  async listBackups(): Promise<BackupInfoDto[]> {
    return await this.serverManagerService.listBackups();
  }

  @Delete('backups/:filename')
  @ApiOperation({ summary: 'Delete a specific backup file' })
  @ApiResponse({
    status: 200,
    description: 'Backup deleted successfully',
    schema: { type: 'boolean' },
  })
  @ApiResponse({
    status: 404,
    description: 'Backup file not found',
  })
  async deleteBackup(@Param('filename') filename: string): Promise<boolean> {
    return await this.serverManagerService.deleteBackup(filename);
  }

  @Post('backups/trigger')
  @ApiOperation({ summary: 'Manually trigger a database backup' })
  @ApiResponse({
    status: 200,
    description: 'Backup triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        filename: { type: 'string' },
        size: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async triggerBackup(): Promise<{
    success: boolean;
    filename?: string;
    size?: string;
    message: string;
  }> {
    const result: BackupResult = await this.serverManagerService.triggerBackup();

    if (result.success) {
      return {
        success: true,
        filename: result.filename,
        size: result.size,
        message: `Backup created successfully: ${result.filename} (${result.size})`,
      };
    } else {
      return {
        success: false,
        message: `Backup failed: ${result.error}`,
      };
    }
  }
}
