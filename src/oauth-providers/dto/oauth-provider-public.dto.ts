import { Field, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { OAuthProviderType } from '../../entities';

@ObjectType()
export class OAuthProviderPublicDto {
  @Field(() => String)
  @ApiProperty({ description: 'The unique identifier for the provider' })
  id: string;

  @Field()
  @ApiProperty({ description: 'The name of the OAuth provider' })
  name: string;

  @Field()
  @ApiProperty({
    description:
      'The unique identifier for the provider (e.g., github, google, custom)',
  })
  providerId: string;

  @Field(() => OAuthProviderType)
  @ApiProperty({
    enum: OAuthProviderType,
    enumName: 'OAuthProviderType',
    description: 'The type of provider (GitHub, Google, or custom)',
  })
  type: OAuthProviderType;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Icon URL for the provider' })
  iconUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the provider (e.g., #FF5733)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#0a7ea4',
  })
  color?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the provider text (e.g., #FFFFFF)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#FFFFFF',
  })
  textColor?: string;
}
