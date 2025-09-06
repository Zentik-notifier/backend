import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {
  getVersion(): string {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgRaw);
      return pkg.version || 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }
}
