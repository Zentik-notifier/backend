import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { ServerSettingType } from '../entities/server-setting.entity';
import { ServerSettingsService } from './server-settings.service';

@Injectable()
export class FilesAdminService {
  constructor(
    private readonly serverSettingsService: ServerSettingsService,
  ) { }
  private readonly logger = new Logger(FilesAdminService.name);

  private async getBaseDir(): Promise<string> {
    const base =
      (await this.serverSettingsService.getStringValue(ServerSettingType.ServerFilesDirectory)) ||
      '/data'
    return base;
  }

  private async resolveSafePath(relativeOrName: string): Promise<string> {
    const baseDir = await this.getBaseDir();
    const resolved = path.resolve(baseDir, relativeOrName);
    if (!resolved.startsWith(path.resolve(baseDir))) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  async ensureBaseDir(): Promise<string> {
    const baseDir = await this.getBaseDir();
    try {
      await fsp.mkdir(baseDir, { recursive: true });
    } catch (error: any) {
      this.logger.error(
        `Failed to ensure server files directory "${baseDir}": ${error?.message || error}`,
      );
      // Surface a clear, actionable error instead of a generic 500
      throw new InternalServerErrorException(
        'Server files directory is not configured or not writable. Please configure the "ServerFilesDirectory" setting and ensure the path is writable by the backend process.',
      );
    }
    return baseDir;
  }

  async listEntries(relativePath?: string): Promise<{ name: string; size: number; mtime: Date; isDir: boolean }[]> {
    const baseDir = await this.ensureBaseDir();
    const targetDir = relativePath ? await this.resolveSafePath(relativePath) : baseDir;
    const entries = await fsp.readdir(targetDir, { withFileTypes: true });
    const results: { name: string; size: number; mtime: Date; isDir: boolean }[] = [];
    for (const entry of entries) {
      const full = path.join(targetDir, entry.name);
      const stat = await fsp.stat(full);
      results.push({ name: entry.name, size: entry.isFile() ? stat.size : 0, mtime: stat.mtime, isDir: entry.isDirectory() });
    }
    return results.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  }

  async saveFile(originalName: string, buffer: Buffer, relativeDir?: string): Promise<{ name: string; size: number }> {
    await this.ensureBaseDir();
    const safeName = path.basename(originalName);
    const targetDir = relativeDir && relativeDir.trim() !== '' ? await this.resolveSafePath(relativeDir) : await this.getBaseDir();
    await fsp.mkdir(targetDir, { recursive: true });
    const dest = path.join(targetDir, safeName);
    await fsp.writeFile(dest, buffer);
    const stat = await fsp.stat(dest);
    this.logger.log(`Saved file ${safeName} (${stat.size} bytes) in ${targetDir}`);
    return { name: safeName, size: stat.size };
  }

  async deleteFile(name: string, relativeDir?: string): Promise<void> {
    const base = relativeDir && relativeDir.trim() !== '' ? await this.resolveSafePath(relativeDir) : await this.getBaseDir();
    const target = path.join(base, path.basename(name));
    if (fs.existsSync(target)) {
      await fsp.unlink(target);
      this.logger.log(`Deleted file ${path.basename(name)}`);
    }
  }

  async getAbsoluteFilePath(name: string, relativeDir?: string): Promise<string> {
    const base = relativeDir && relativeDir.trim() !== '' ? await this.resolveSafePath(relativeDir) : await this.getBaseDir();
    const target = path.join(base, path.basename(name));
    return target;
  }
}


