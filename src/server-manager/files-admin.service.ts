import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FilesAdminService {
  constructor(private readonly configService: ConfigService) { }
  private readonly logger = new Logger(FilesAdminService.name);

  private getBaseDir(): string {
    const base = this.configService.get('SERVER_FILES_DIR') || path.join(process.cwd(), 'storage', 'system-files');
    return base;
  }

  private resolveSafePath(relativeOrName: string): string {
    const baseDir = this.getBaseDir();
    const resolved = path.resolve(baseDir, relativeOrName);
    if (!resolved.startsWith(path.resolve(baseDir))) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  async ensureBaseDir(): Promise<string> {
    const baseDir = this.getBaseDir();
    await fsp.mkdir(baseDir, { recursive: true });
    return baseDir;
  }

  async listEntries(relativePath?: string): Promise<{ name: string; size: number; mtime: Date; isDir: boolean }[]> {
    const baseDir = await this.ensureBaseDir();
    const targetDir = relativePath ? this.resolveSafePath(relativePath) : baseDir;
    const entries = await fsp.readdir(targetDir, { withFileTypes: true });
    const results: { name: string; size: number; mtime: Date; isDir: boolean }[] = [];
    for (const entry of entries) {
      const full = path.join(targetDir, entry.name);
      const stat = await fsp.stat(full);
      results.push({ name: entry.name, size: entry.isFile() ? stat.size : 0, mtime: stat.mtime, isDir: entry.isDirectory() });
    }
    return results.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  }

  async saveFile(originalName: string, buffer: Buffer): Promise<{ name: string; size: number }> {
    const baseDir = await this.ensureBaseDir();
    const safeName = path.basename(originalName);
    const dest = this.resolveSafePath(safeName);
    await fsp.writeFile(dest, buffer);
    const stat = await fsp.stat(dest);
    this.logger.log(`Saved file ${safeName} (${stat.size} bytes) in ${baseDir}`);
    return { name: safeName, size: stat.size };
  }

  async deleteFile(name: string): Promise<void> {
    const target = this.resolveSafePath(path.basename(name));
    if (fs.existsSync(target)) {
      await fsp.unlink(target);
      this.logger.log(`Deleted file ${path.basename(name)}`);
    }
  }
}


