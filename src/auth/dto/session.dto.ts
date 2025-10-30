import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { OAuthProviderType } from '../../entities/oauth-provider.entity';

@ObjectType()
export class SessionInfoDto {
  @Field(() => ID)
  @ApiProperty({ description: 'Session ID' })
  id: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Device name or description' })
  deviceName?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Operating system' })
  operatingSystem?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Browser name and version' })
  browser?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'IP address' })
  ipAddress?: string;

  @Field(() => OAuthProviderType, { nullable: true })
  @ApiProperty({ description: 'OAuth provider used for login (enum)' })
  loginProvider?: OAuthProviderType | null;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Geographic location' })
  location?: string;

  @Field()
  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity: Date;

  @Field()
  @ApiProperty({ description: 'Session creation timestamp' })
  createdAt: Date;

  @Field()
  @ApiProperty({ description: 'Session expiration time' })
  expiresAt: Date;

  @Field()
  @ApiProperty({ description: 'Whether this is the current session' })
  isCurrent: boolean;

  @Field()
  @ApiProperty({ description: 'Whether the session is active' })
  isActive: boolean;
}
