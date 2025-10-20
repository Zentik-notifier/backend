import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../users/users.types';

const PUBLIC_BUCKET_NAME = 'Zentik';
const PUBLIC_BUCKET_DESCRIPTION =
    'Public bucket for Zentik notifications and updates';
const PUBLIC_BUCKET_COLOR = '#2563eb';

export async function ensurePublicBucket(dataSource: DataSource) {
    const logger = new Logger('PublicBucketSeed');

    try {
        const bucketRepo = dataSource.getRepository(Bucket);
        const userRepo = dataSource.getRepository(User);

        // Find all admin users to use first as bucket owner
        const adminUsers = await userRepo.find({
            where: { role: UserRole.ADMIN },
        });

        if (adminUsers.length === 0) {
            logger.warn('⚠️  No admin users found, skipping public bucket creation');
            return;
        }

        // Use the first admin user as the bucket owner
        const bucketOwner = adminUsers[0];

        // Check if public bucket already exists
        let publicBucket = await bucketRepo.findOne({
            where: { name: PUBLIC_BUCKET_NAME },
            relations: ['user'],
        });

        if (publicBucket) {
            logger.log(`✅ Public bucket already exists: ${publicBucket.id}`);
            // Ensure existing bucket has isPublic flag set
            if (!publicBucket.isPublic) {
                publicBucket.isPublic = true;
                publicBucket.isProtected = true;
                await bucketRepo.save(publicBucket);
                logger.log(`✅ Updated existing public bucket with isPublic flag`);
            }
        } else {
            // Create the public bucket
            publicBucket = bucketRepo.create({
                name: PUBLIC_BUCKET_NAME,
                description: PUBLIC_BUCKET_DESCRIPTION,
                color: PUBLIC_BUCKET_COLOR,
                icon: "https://github.com/Zentik-notifier/backend/blob/main/assets/zentik.png?raw=true",
                isProtected: true, // Protected from deletion
                isPublic: true, // Mark as public - accessible to everyone
                isAdmin: false,
                user: bucketOwner,
            });

            await bucketRepo.save(publicBucket);
            logger.log(
                `✅ Created public bucket: ${publicBucket.id} (owner: ${bucketOwner.email})`,
            );
        }

        logger.log(
            `🎯 Public bucket setup completed. Accessible to all users`,
        );
    } catch (error) {
        logger.error('❌ Error during public bucket initialization:', error.message);
        // Don't throw - we don't want to break the application startup
    }
}

