import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from './decorators/get-user.decorator';
import { SessionInfoDto } from './dto/session.dto';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';
import { SessionService } from './session.service';

@ApiTags('Sessions')
@Controller('sessions')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active sessions for the current user' })
  @ApiResponse({ status: 200, type: [SessionInfoDto] })
  async getUserSessions(
    @GetUser('id') userId: string,
    @GetUser('tokenId') currentTokenId?: string,
  ): Promise<SessionInfoDto[]> {
    return this.sessionService.getUserSessions(userId, currentTokenId);
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  async revokeSession(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.sessionService.revokeSession(userId, sessionId);
    return { success };
  }

  @Delete()
  @ApiOperation({ summary: 'Revoke all sessions except current one' })
  @ApiResponse({
    status: 200,
    description: 'All other sessions revoked successfully',
  })
  async revokeAllOtherSessions(
    @GetUser('id') userId: string,
    @GetUser('tokenId') currentTokenId?: string,
  ): Promise<{ success: boolean }> {
    const success = await this.sessionService.revokeAllSessions(
      userId,
      currentTokenId,
    );
    return { success };
  }
}
