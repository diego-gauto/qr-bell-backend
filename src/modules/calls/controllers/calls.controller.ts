import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RingDto } from '../dto/ring.dto';
import { UpdateCallStatusDto } from '../dto/update-call-status.dto';
import { RingRateLimitGuard } from '../guards/ring-rate-limit.guard';
import { CallResponse } from '../interfaces/call-response.interface';
import { CallsService } from '../services/calls.service';

@Controller()
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @UseGuards(RingRateLimitGuard)
  @Post('ring')
  ring(@Body() dto: RingDto): Promise<CallResponse> {
    return this.callsService.ring(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('calls/:callId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('callId', new ParseUUIDPipe()) callId: string,
    @Body() dto: UpdateCallStatusDto
  ): Promise<CallResponse> {
    return this.callsService.updateStatus({
      callId,
      ownerId: user.id,
      status: dto.status
    });
  }
}
