import { JwtService } from '@nestjs/jwt';
import { User } from '../src/entities/user.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class TestHelpers {
  static createJwtToken(user: User, jwtService: JwtService): string {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
    return jwtService.sign(payload);
  }

  static async createTestUser(
    dataSource: DataSource,
    userData: Partial<User> = {},
  ): Promise<User> {
    const userRepo = dataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash(
      userData.password || 'testpassword',
      10,
    );

    const user = userRepo.create({
      email: userData.email || 'test@example.com',
      username: userData.username || 'testuser',
      firstName: userData.firstName || 'Test',
      lastName: userData.lastName || 'User',
      password: hashedPassword,
      ...userData,
    });

    return userRepo.save(user);
  }

  static async cleanupTestData(
    dataSource: DataSource,
    entities: any[],
  ): Promise<void> {
    for (const entity of entities.reverse()) {
      if (entity && entity.constructor && entity.id) {
        try {
          await dataSource.getRepository(entity.constructor).delete(entity.id);
        } catch (error) {
          console.error(`Error cleaning up ${entity.constructor.name}:`, error);
        }
      }
    }
  }

  static generateSystemAccessToken(): string {
    return `sat_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  static async waitForServer(
    app: any,
    maxAttempts: number = 10,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const server = app.getHttpServer();
        if (server && server.listening) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}
