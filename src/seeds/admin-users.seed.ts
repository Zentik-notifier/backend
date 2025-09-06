import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../users/users.types';

export async function createAdminUsers(dataSource: DataSource) {
  const logger = new Logger('AdminUsersSeed');

  const adminUsersEnv = process.env.ADMIN_USERS;
  if (!adminUsersEnv || adminUsersEnv.trim() === '') {
    logger.log('No admin users defined in ADMIN_USERS environment variable');
    return;
  }

  const adminDefaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!adminDefaultPassword || adminDefaultPassword.trim() === '') {
    logger.error(
      '❌ ADMIN_DEFAULT_PASSWORD environment variable is required but not set',
    );
    return;
  }

  const userRepo = dataSource.getRepository(User);
  const adminIdentifiers = adminUsersEnv
    .split(',')
    .map((identifier) => identifier.trim());

  logger.log(`🔧 Processing ${adminIdentifiers.length} admin user(s)...`);

  for (const identifier of adminIdentifiers) {
    if (!identifier) continue;

    try {
      // Check if identifier is email or username
      const isEmail = identifier.includes('@');

      // Check if user already exists
      const existingUser = await userRepo.findOne({
        where: isEmail ? { email: identifier } : { username: identifier },
      });

      if (existingUser) {
        // Update existing user to admin role if not already admin
        if (existingUser.role !== UserRole.ADMIN) {
          existingUser.role = UserRole.ADMIN;
          existingUser.emailConfirmed = true;
          await userRepo.save(existingUser);
          logger.log(`✅ Updated existing user to admin: ${identifier}`);
        } else {
          logger.log(`✅ User already has admin role: ${identifier}`);
        }
      } else {
        // Create new admin user
        let username: string;
        let email: string;

        if (isEmail) {
          email = identifier;
          // Generate username from email (part before @)
          username = identifier.split('@')[0];

          // Check if username already exists, if so, append a number
          let usernameExists = await userRepo.findOne({ where: { username } });
          let counter = 1;
          while (usernameExists) {
            username = `${identifier.split('@')[0]}${counter}`;
            usernameExists = await userRepo.findOne({ where: { username } });
            counter++;
          }
        } else {
          username = identifier;
          // Generate email from username
          email = `${identifier}@zentik.local`;

          // Check if email already exists, if so, append a number
          let emailExists = await userRepo.findOne({ where: { email } });
          let counter = 1;
          while (emailExists) {
            email = `${identifier}${counter}@zentik.local`;
            emailExists = await userRepo.findOne({ where: { email } });
            counter++;
          }
        }

        const hashedPassword = await bcrypt.hash(adminDefaultPassword, 12);

        const newAdminUser = userRepo.create({
          email,
          username,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
          emailConfirmed: true,
        });

        await userRepo.save(newAdminUser);
        logger.log(
          `✅ Created new admin user: ${email} (username: ${username})`,
        );
        logger.warn(
          `🔑 Password for ${identifier} is set from ADMIN_DEFAULT_PASSWORD - Please change it on first login!`,
        );
      }
    } catch (error) {
      logger.error(
        `❌ Failed to process admin user ${identifier}:`,
        error.message,
      );
    }
  }

  logger.log('🎯 Admin users processing completed');
}
