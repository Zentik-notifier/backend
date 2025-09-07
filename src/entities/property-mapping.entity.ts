import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@ObjectType()
@Entity('property_mappings')
export class PropertyMapping {
  @Field(() => ID)
  @ApiProperty({ example: 'uuid-string' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty({ example: 'user-uuid-string' })
  @Column({ name: 'userId' })
  userId: string;

  @Field()
  @ApiProperty({ example: 'My Property Mapping' })
  @Column()
  name: string;

  @Field({ nullable: true })
  @ApiProperty({ example: 'Description of the property mapping', required: false })
  @Column({ nullable: true })
  description: string;

  @Field(() => [PropertyMappingItem])
  @ApiProperty({ 
    type: [PropertyMappingItem],
    example: [
      { sourceBuild: 'user.name', targetKey: 'fullName' },
      { sourceBuild: 'user.email', targetKey: 'emailAddress' }
    ]
  })
  @Column({ type: 'jsonb' })
  properties: PropertyMappingItem[];

  @Field(() => Object, { nullable: true })
  @ApiProperty({ 
    example: { 
      user: { name: 'John Doe', email: 'john@example.com' },
      timestamp: '2024-01-01T00:00:00.000Z'
    },
    required: false 
  })
  @Column({ type: 'jsonb', nullable: true })
  samplePayload: any;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.propertyMappings, { onDelete: 'CASCADE' })
  user: User;
}

@ObjectType()
export class PropertyMappingItem {
  @Field()
  @ApiProperty({ example: 'user.name' })
  sourceBuild: string;

  @Field()
  @ApiProperty({ example: 'fullName' })
  targetKey: string;
}