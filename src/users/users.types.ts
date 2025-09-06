import { registerEnumType } from '@nestjs/graphql';

// Enums
export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

// GraphQL registrations
registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User role enum',
});
