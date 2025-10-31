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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { FilesAdminService } from './files-admin.service';
import { Response } from 'express';
import * as fs from 'fs';

@ApiTags('Server Files')
@Controller('server-manager/files')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class FilesAdminController {
  constructor(private readonly filesService: FilesAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List files/directories in server files directory' })
  @ApiResponse({ status: 200, description: 'List of entries' })
  async list(@Query('path') path?: string) {
    return this.filesService.listEntries(path);
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
  async upload(@UploadedFile() file: Express.Multer.File, @Query('path') path?: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.filesService.saveFile(file.originalname, file.buffer, path);
  }

  @Delete(':name')
  @ApiOperation({ summary: 'Delete a file from the server files directory' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  async remove(@Param('name') name: string, @Query('path') path?: string) {
    await this.filesService.deleteFile(name, path);
    return { deleted: true };
  }

  @Get(':name/download')
  @ApiOperation({ summary: 'Download a file from the server files directory' })
  @ApiResponse({ status: 200, description: 'File stream' })
  async download(@Param('name') name: string, @Query('path') path: string | undefined, @Res() res: Response) {
    const filePath = this.filesService.getAbsoluteFilePath(name, path);
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  }
}


