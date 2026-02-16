import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { SubscribePushDto } from '../dto/subscribe-push.dto';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { RingNotificationPayload } from '../interfaces/ring-notification.interface';

interface ParsedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface SubscriptionKeys {
  p256dh?: unknown;
  auth?: unknown;
}

interface SubscriptionInput {
  endpoint?: unknown;
  keys?: SubscriptionKeys;
}

interface PushErrorWithStatusCode {
  statusCode: number;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly isConfigured: boolean;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly pushSubscriptionsRepository: Repository<PushSubscriptionEntity>,
    private readonly configService: ConfigService
  ) {
    const subject = this.configService.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
    const publicKey = this.configService.getOrThrow<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.getOrThrow<string>('VAPID_PRIVATE_KEY');

    try {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.isConfigured = true;
    } catch (error) {
      this.logger.warn(`VAPID configuration invalid. Push notifications disabled: ${String(error)}`);
      this.isConfigured = false;
    }
  }

  async subscribe(ownerId: string, dto: SubscribePushDto): Promise<PushSubscriptionEntity> {
    const parsed = this.parseSubscription(dto.subscription);

    const existing = await this.pushSubscriptionsRepository.findOne({
      where: { endpoint: parsed.endpoint }
    });

    if (existing) {
      existing.ownerId = ownerId;
      existing.p256dhKey = parsed.p256dh;
      existing.authKey = parsed.auth;
      existing.userAgent = dto.userAgent ?? null;
      existing.isActive = true;

      return this.pushSubscriptionsRepository.save(existing);
    }

    const created = new PushSubscriptionEntity();
    created.ownerId = ownerId;
    created.endpoint = parsed.endpoint;
    created.p256dhKey = parsed.p256dh;
    created.authKey = parsed.auth;
    created.userAgent = dto.userAgent ?? null;
    created.lastNotifiedAt = null;
    created.isActive = true;

    return this.pushSubscriptionsRepository.save(created);
  }

  async notifyRing(ownerId: string, payload: RingNotificationPayload): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    const subscriptions = await this.pushSubscriptionsRepository.find({
      where: {
        ownerId,
        isActive: true
      }
    });

    if (subscriptions.length === 0) {
      return;
    }

    const message = JSON.stringify({
      title: 'QR Bell',
      body: `${payload.homeName}: alguien esta en la puerta`,
      data: {
        callId: payload.callId,
        homeId: payload.homeId,
        ringUrl: payload.ringUrl
      }
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dhKey,
                auth: subscription.authKey
              }
            },
            message
          );
          subscription.lastNotifiedAt = new Date();
          await this.pushSubscriptionsRepository.save(subscription);
        } catch (error) {
          if (this.isPushErrorWithStatusCode(error) && (error.statusCode === 404 || error.statusCode === 410)) {
            subscription.isActive = false;
            await this.pushSubscriptionsRepository.save(subscription);
            return;
          }

          this.logger.warn(
            `Unable to send push notification to endpoint ${subscription.endpoint}: ${String(error)}`
          );
        }
      })
    );
  }

  private parseSubscription(input: Record<string, unknown>): ParsedSubscription {
    const subscription = input as SubscriptionInput;
    const endpoint = subscription.endpoint;
    const keys = subscription.keys;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      throw new BadRequestException('Invalid push subscription endpoint');
    }

    if (typeof p256dh !== 'string' || p256dh.length === 0) {
      throw new BadRequestException('Invalid push subscription key: p256dh');
    }

    if (typeof auth !== 'string' || auth.length === 0) {
      throw new BadRequestException('Invalid push subscription key: auth');
    }

    return {
      endpoint,
      p256dh,
      auth
    };
  }

  private isPushErrorWithStatusCode(value: unknown): value is PushErrorWithStatusCode {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const maybeError = value as Partial<PushErrorWithStatusCode>;
    return typeof maybeError.statusCode === 'number';
  }
}
