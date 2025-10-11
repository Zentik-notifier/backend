import { Injectable, UseGuards } from '@nestjs/common';
import {
    Args,
    Mutation,
    Query,
    Resolver,
} from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { SystemAccessTokenRequest } from './system-access-token-request.entity';
import { SystemAccessTokenRequestService } from './system-access-token-request.service';
import {
    CreateSystemAccessTokenRequestDto,
    ApproveSystemAccessTokenRequestDto,
    DeclineSystemAccessTokenRequestDto,
} from './dto';

@Resolver(() => SystemAccessTokenRequest)
@Injectable()
export class SystemAccessTokenRequestResolver {
    constructor(
        private readonly service: SystemAccessTokenRequestService,
    ) { }

    @UseGuards(JwtOrAccessTokenGuard)
    @Mutation(() => SystemAccessTokenRequest)
    async createSystemAccessTokenRequest(
        @CurrentUser('id') userId: string,
        @Args('input') dto: CreateSystemAccessTokenRequestDto,
    ): Promise<SystemAccessTokenRequest> {
        return this.service.create(userId, dto);
    }

    @Mutation(() => SystemAccessTokenRequest)
    @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
    async approveSystemAccessTokenRequest(
        @Args('id') id: string,
        @Args('input', { nullable: true }) dto?: ApproveSystemAccessTokenRequestDto,
    ): Promise<SystemAccessTokenRequest> {
        return this.service.approve(id, dto);
    }

    @Mutation(() => SystemAccessTokenRequest)
    @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
    async declineSystemAccessTokenRequest(
        @Args('id') id: string,
        @Args('input', { nullable: true }) dto?: DeclineSystemAccessTokenRequestDto,
    ): Promise<SystemAccessTokenRequest> {
        return this.service.decline(id, dto);
    }

    @Query(() => [SystemAccessTokenRequest])
    @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
    async systemAccessTokenRequests(): Promise<SystemAccessTokenRequest[]> {
        return this.service.findAll();
    }

    @UseGuards(JwtOrAccessTokenGuard)
    @Query(() => [SystemAccessTokenRequest])
    async mySystemAccessTokenRequests(
        @CurrentUser('id') userId: string,
    ): Promise<SystemAccessTokenRequest[]> {
        return this.service.findByUser(userId);
    }
}
