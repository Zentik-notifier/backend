import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { Changelog } from '../entities/changelog.entity';
import { ChangelogService } from './changelog.service';
import { CreateChangelogInput, UpdateChangelogInput } from './dto';

@Resolver(() => Changelog)
export class ChangelogResolver {
  constructor(private readonly changelogService: ChangelogService) {}

  // Public GraphQL queries for reading changelogs
  @Query(() => [Changelog], {
    name: 'changelogs',
    description: 'List all changelogs (public)',
  })
  async changelogs(): Promise<Changelog[]> {
    return this.changelogService.findAll();
  }

  @Query(() => Changelog, {
    name: 'changelog',
    description: 'Get a specific changelog by id (public)',
  })
  async changelog(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Changelog> {
    return this.changelogService.findOne(id);
  }

  // Admin-only GraphQL query for reading all changelogs (including inactive)
  @Query(() => [Changelog], {
    name: 'adminChangelogs',
    description: 'List all changelogs (admin, includes inactive)',
  })
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async adminChangelogs(): Promise<Changelog[]> {
    return this.changelogService.findAllAdmin();
  }

  // Admin-only GraphQL mutations
  @Mutation(() => Changelog, {
    name: 'createChangelog',
    description: 'Create a new changelog (admin only)',
  })
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async createChangelog(
    @Args('input') input: CreateChangelogInput,
  ): Promise<Changelog> {
    return this.changelogService.create(input);
  }

  @Mutation(() => Changelog, {
    name: 'updateChangelog',
    description: 'Update an existing changelog (admin only)',
  })
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async updateChangelog(
    @Args('input') input: UpdateChangelogInput,
  ): Promise<Changelog> {
    return this.changelogService.update(input);
  }

  @Mutation(() => Boolean, {
    name: 'deleteChangelog',
    description: 'Delete a changelog (admin only)',
  })
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async deleteChangelog(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.changelogService.remove(id);
  }
}
