import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { FilesAdminService } from './files-admin.service';

@ApiTags('Server Files')
@Controller('server-manager/files')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class FilesAdminController {
  constructor(private readonly filesService: FilesAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List files in server files directory' })
  @ApiResponse({ status: 200, description: 'List of files' })
  async list() {
    return this.filesService.listFiles();
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to the server files directory' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.filesService.saveFile(file.originalname, file.buffer);
  }

  @Delete(':name')
  @ApiOperation({ summary: 'Delete a file from the server files directory' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  async remove(@Param('name') name: string) {
    await this.filesService.deleteFile(name);
    return { deleted: true };
  }
}


