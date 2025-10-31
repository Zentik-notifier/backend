import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesAdminService } from './files-admin.service';
import { FileInfoDto } from './dto/file-info.dto';

@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class FilesAdminResolver {
  constructor(private readonly filesService: FilesAdminService) {}

  @Query(() => [FileInfoDto], { name: 'serverFiles' })
  async serverFiles(): Promise<FileInfoDto[]> {
    const list = await this.filesService.listFiles();
    return list.map((f) => ({ ...f }));
  }

  @Mutation(() => Boolean, { name: 'deleteServerFile' })
  async deleteServerFile(@Args('name') name: string): Promise<boolean> {
    await this.filesService.deleteFile(name);
    return true;
  }
}


