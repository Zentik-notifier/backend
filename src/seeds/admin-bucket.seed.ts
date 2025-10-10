import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../users/users.types';
import * as fs from 'fs';
import * as path from 'path';

const ADMIN_BUCKET_NAME = 'Zentik Administration';
const ADMIN_BUCKET_DESCRIPTION =
    'System bucket for administrative notifications and alerts';
const ADMIN_BUCKET_COLOR = '#0a7ea4';

export async function ensureAdminBucket(dataSource: DataSource) {
    const logger = new Logger('AdminBucketSeed');

    try {
        const bucketRepo = dataSource.getRepository(Bucket);
        const userRepo = dataSource.getRepository(User);

        // Find all admin users
        const adminUsers = await userRepo.find({
            where: { role: UserRole.ADMIN },
        });

        if (adminUsers.length === 0) {
            logger.warn('⚠️  No admin users found, skipping admin bucket creation');
            return;
        }

        // Use the first admin user as the bucket owner
        const bucketOwner = adminUsers[0];

        // Check if admin bucket already exists
        let adminBucket = await bucketRepo.findOne({
            where: { name: ADMIN_BUCKET_NAME },
            relations: ['user'],
        });

        if (adminBucket) {
            logger.log(`✅ Admin bucket already exists: ${adminBucket.id}`);
            // Ensure existing bucket has isAdmin flag set
            if (!adminBucket.isAdmin) {
                adminBucket.isAdmin = true;
                await bucketRepo.save(adminBucket);
                logger.log(`✅ Updated existing admin bucket with isAdmin flag`);
            }
        } else {
            // Create the admin bucket
            adminBucket = bucketRepo.create({
                name: ADMIN_BUCKET_NAME,
                description: ADMIN_BUCKET_DESCRIPTION,
                color: ADMIN_BUCKET_COLOR,
                // icon: "https://github.com/Zentik-notifier/backend/blob/main/assets/zentik-admin.png?raw=truehttps://raw.githubusercontent.com/Zentik-notifier/backend/refs/heads/main/assets/zentik-admin.png",
                icon: "https://github.com/Zentik-notifier/backend/blob/main/assets/zentik-admin.png?raw=true",
                isProtected: true, // Protected from deletion
                isPublic: false,
                isAdmin: true, // Mark as admin bucket - accessible to all admins
                user: bucketOwner,
            });

            await bucketRepo.save(adminBucket);
            logger.log(
                `✅ Created admin bucket: ${adminBucket.id} (owner: ${bucketOwner.email})`,
            );
        }

        logger.log(
            `🎯 Admin bucket setup completed. Accessible to all ${adminUsers.length} admin user(s)`,
        );
    } catch (error) {
        logger.error('❌ Error during admin bucket initialization:', error.message);
        // Don't throw - we don't want to break the application startup
    }
}
