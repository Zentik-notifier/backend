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

  async listFiles(): Promise<{ name: string; size: number; mtime: Date }[]> {
    const baseDir = await this.ensureBaseDir();
    const entries = await fsp.readdir(baseDir, { withFileTypes: true });
    const files: { name: string; size: number; mtime: Date }[] = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const full = path.join(baseDir, entry.name);
        const stat = await fsp.stat(full);
        files.push({ name: entry.name, size: stat.size, mtime: stat.mtime });
      }
    }
    return files;
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


