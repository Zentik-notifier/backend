import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { SystemAccessTokenRequestService } from './system-access-token-request.service';
import {
    CreateSystemAccessTokenRequestDto,
    ApproveSystemAccessTokenRequestDto,
    DeclineSystemAccessTokenRequestDto,
} from './dto';

@ApiTags('System Access Token Requests')
@Controller('system-access-token-requests')
@ApiBearerAuth()
export class SystemAccessTokenRequestController {
    constructor(private readonly service: SystemAccessTokenRequestService) { }

    @Post()
    @UseGuards(JwtOrAccessTokenGuard)
    @ApiOperation({ summary: 'Create a new system access token request' })
    @ApiResponse({ status: 201, description: 'Request created successfully' })
    async create(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateSystemAccessTokenRequestDto,
    ) {
        return this.service.create(userId, dto);
    }

    @Post(':id/approve')
    @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
    @ApiOperation({ summary: 'Approve a system access token request (Admin only)' })
    @ApiResponse({ status: 200, description: 'Request approved and token generated' })
    async approve(
        @Param('id') id: string,
        @Body() dto?: ApproveSystemAccessTokenRequestDto,
    ) {
        return this.service.approve(id, dto);
    }

    @Post(':id/decline')
    @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
    @ApiOperation({ summary: 'Decline a system access token request (Admin only)' })
    @ApiResponse({ status: 200, description: 'Request declined' })
    async decline(
        @Param('id') id: string,
        @Body() dto?: DeclineSystemAccessTokenRequestDto,
    ) {
        return this.service.decline(id, dto);
    }

    @Get()
    @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
    @ApiOperation({ summary: 'Get all system access token requests (Admin only)' })
    @ApiResponse({ status: 200 })
    async findAll() {
        return this.service.findAll();
    }

    @UseGuards(JwtOrAccessTokenGuard)
    @Get('my-requests')
    @ApiOperation({ summary: 'Get current user\'s system access token requests' })
    @ApiResponse({ status: 200 })
    async findMyRequests(@CurrentUser('id') userId: string) {
        return this.service.findByUser(userId);
    }
}
