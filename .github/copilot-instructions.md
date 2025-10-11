# GitHub Copilot Instructions - Zentik Notifier Backend

## Project Overview
This is the backend API for Zentik Notifier, built with:
- **NestJS** framework
- **TypeORM** for database operations
- **GraphQL** (Code First approach)
- **PostgreSQL** database
- **JWT** authentication
- **WebSocket** support for real-time updates

## Code Style and Documentation

### Language and Comments
- **Always use English** for all code comments, documentation, commit messages, and PR descriptions
- **Add comments only for critical or complex logic** - avoid self-explanatory comments
- **Don't create README files** or test scripts unless explicitly requested
- Keep comments concise and meaningful

**Examples:**
```typescript
// ✅ Good - explains why, not what
// Using forwardRef to avoid circular dependency between EventsModule and MessagesModule
@Inject(forwardRef(() => MessagesService))

// ❌ Bad - self-explanatory
// Set the user email
user.email = email;

// ❌ Bad - in Italian
// Crea un nuovo utente
async createUser() { }
```

## Important Development Guidelines

### 1. Module Structure

Follow NestJS best practices:
```
src/
  module-name/
    module-name.module.ts       # Module definition
    module-name.service.ts      # Business logic
    module-name.controller.ts   # REST API endpoints
    module-name.resolver.ts     # GraphQL resolvers
    module-name.entity.ts       # TypeORM entities
    dto/
      *.dto.ts                  # Data Transfer Objects
    guards/
      *.guard.ts                # Auth guards
```

### 2. GraphQL Code First

Use decorators for GraphQL schema generation:

```typescript
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  firstName?: string;
}

@Resolver(() => User)
export class UserResolver {
  @Query(() => [User])
  @UseGuards(JwtAuthGuard)
  async users(): Promise<User[]> {
    // ...
  }

  @Mutation(() => User)
  async updateUser(@Args('input') input: UpdateUserInput): Promise<User> {
    // ...
  }
}
```

### 3. DTOs and Validation

Always use DTOs with validation:

```typescript
@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(8)
  password: string;

  @Field({ nullable: true })
  @IsString()
  firstName?: string;
}
```

### 4. Authentication & Authorization

Use guards for protection:

```typescript
@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class AdminResolver {
  @Query(() => [User])
  async allUsers(): Promise<User[]> {
    // Only admin users can access this
  }
}
```

### 5. Database Migrations

When modifying entities:
1. Update the entity file
2. Generate migration: `npm run migration:generate -- src/migrations/MigrationName`
3. Review the generated migration
4. Run migration: `npm run migration:run`

### 6. Server Settings Pattern

The application uses a flexible server settings system:

**Entity**: `ServerSetting` with `configType` enum and value fields
**Service**: `ServerSettingsService` for CRUD operations
**Module**: `ServerManagerModule` (unified with backup functionality)

When adding new settings:
1. Add to `ServerSettingType` enum in `entities/server-setting.entity.ts`
2. Update `ServerSettingsService` if special handling needed
3. Update frontend translations and types
4. Document the setting's purpose and impact

### 7. Backup System

The backup system is managed by `ServerManagerModule`:
- **Automatic backups**: Configurable via cron jobs
- **Manual triggers**: Via GraphQL mutation `triggerBackup`
- **Cleanup**: Automatic retention policy
- **Storage**: Configurable path

### 8. Testing

Write tests for:
- Services (unit tests)
- Resolvers (integration tests)
- Controllers (e2e tests)

```typescript
describe('UserService', () => {
  it('should create a user', async () => {
    // Test implementation
  });
});
```

### 9. Error Handling

Use NestJS exception filters:

```typescript
if (!user) {
  throw new NotFoundException(`User with id ${id} not found`);
}

if (!hasPermission) {
  throw new ForbiddenException('Insufficient permissions');
}
```

### 10. Environment Variables

Configuration via `.env` file:
- Use `@nestjs/config` for environment variables
- Validate configuration on startup
- Document all required variables

## Common Patterns

### Creating a New Module

```bash
# Generate module with all components
nest g module feature-name
nest g service feature-name
nest g resolver feature-name
nest g controller feature-name
```

### TypeORM Entity

```typescript
@Entity()
@ObjectType()
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  name: string;

  @CreateDateColumn()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @Field()
  updatedAt: Date;

  @ManyToOne(() => User)
  @Field(() => User)
  user: User;
}
```

### GraphQL Subscription

```typescript
@Subscription(() => Notification)
newNotification() {
  return this.pubSub.asyncIterator('notificationAdded');
}

// Trigger from service
this.pubSub.publish('notificationAdded', {
  newNotification: notification,
});
```

### REST vs GraphQL

- **REST**: Use for file uploads, webhooks, health checks
- **GraphQL**: Use for CRUD operations, real-time updates
- Both can coexist in the same module

## Key Files Reference

- **Main Entry**: `src/main.ts`
- **App Module**: `src/app.module.ts`
- **Entities**: `src/entities/`
- **Migrations**: `src/migrations/`
- **Config**: `src/config/`
- **Guards**: `src/auth/guards/`
- **Decorators**: `src/common/decorators/`

## Database Schema

Key entities:
- **User**: Users and authentication
- **Bucket**: Notification containers
- **Message**: Notification messages
- **Device**: Push notification devices
- **ServerSetting**: System configuration
- **EntityPermission**: Sharing and permissions
- **Event**: Audit log
- **SystemAccessToken**: API tokens

## Recent Module Updates

### ServerManagerModule (Unified)
Combines:
- Database backup management
- Server settings CRUD
- Server restart functionality

Key services:
- `ServerManagerService`: Backups and restart
- `ServerSettingsService`: Settings management

GraphQL operations:
- `listBackups`: Get all backups
- `triggerBackup`: Create backup manually
- `deleteBackup`: Remove backup file
- `serverSettings`: Get all settings
- `updateServerSetting`: Update single setting
- `batchUpdateServerSettings`: Update multiple settings
- `restartServer`: Hot reload server

## Security Considerations

1. **Always validate input** with DTOs and ValidationPipe
2. **Use guards** for authentication and authorization
3. **Sanitize user input** to prevent injection attacks
4. **Rate limiting** for API endpoints
5. **CORS configuration** for frontend access
6. **Secrets management** via environment variables
7. **SQL injection prevention** via TypeORM query builder
8. **XSS protection** in text fields

## Performance

1. **Database indexing** on frequently queried fields
2. **Query optimization** with TypeORM query builder
3. **Caching** with Redis (if configured)
4. **Pagination** for large datasets
5. **Lazy loading** for relations
6. **Connection pooling** for database

## Checklist for New Features

- [ ] Create module, service, resolver/controller
- [ ] Define entities with TypeORM decorators
- [ ] Add GraphQL types and resolvers
- [ ] Create DTOs with validation
- [ ] Add guards for authentication/authorization
- [ ] Write unit and integration tests
- [ ] Generate and review database migrations
- [ ] Update frontend GraphQL operations
- [ ] Document API in GraphQL schema descriptions
- [ ] Test with different user roles
- [ ] Consider performance and security implications
