import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesAdminService } from './files-admin.service';
import { FileInfoDto, FileInfoWithPathDto } from './dto/file-info.dto';

@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class FilesAdminResolver {
  constructor(private readonly filesService: FilesAdminService) {}

  @Query(() => [FileInfoDto], { name: 'serverFiles' })
  async serverFiles(
    @Args('path', { type: () => String, nullable: true }) path?: string,
  ): Promise<FileInfoDto[]> {
    const list = await this.filesService.listEntries(path);
    return list.map((f) => ({ ...f }));
  }

  @Query(() => [FileInfoWithPathDto], { name: 'allServerFiles' })
  async allServerFiles(
    @Args('path', { type: () => String, nullable: true }) path?: string,
  ): Promise<FileInfoWithPathDto[]> {
    const list = await this.filesService.listAllFilesRecursive(path);
    return list.map((f) => ({ ...f }));
  }

  @Mutation(() => Boolean, { name: 'deleteServerFile' })
  async deleteServerFile(
    @Args('name') name: string,
    @Args('path', { type: () => String, nullable: true }) path?: string,
  ): Promise<boolean> {
    await this.filesService.deleteFile(name, path);
    return true;
  }
}


