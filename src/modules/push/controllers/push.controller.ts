import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SubscribePushDto } from '../dto/subscribe-push.dto';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { PushSubscriptionResponse } from '../interfaces/push-subscription-response.interface';
import { PushService } from '../services/push.service';

@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('subscriptions')
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribePushDto
  ): Promise<PushSubscriptionResponse> {
    const subscription = await this.pushService.subscribe(user.id, dto);
    return this.toResponse(subscription);
  }

  private toResponse(entity: PushSubscriptionEntity): PushSubscriptionResponse {
    return {
      id: entity.id,
      endpoint: entity.endpoint,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };
  }
}
