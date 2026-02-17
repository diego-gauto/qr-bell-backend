import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { HomeEntity } from '../../homes/entities/home.entity';
import { PushService } from '../../push/services/push.service';
import { RingDto } from '../dto/ring.dto';
import { CallEntity, CallStatus } from '../entities/call.entity';
import { CallHistoryItemResponse } from '../interfaces/call-history-item.interface';
import { CallResponse } from '../interfaces/call-response.interface';
import { RingResponse } from '../interfaces/ring-response.interface';
import { signVisitorToken } from '../utils/visitor-token';

interface UpdateCallStatusInput {
  callId: string;
  ownerId: string;
  status: Extract<CallStatus, 'accepted' | 'missed'>;
}

@Injectable()
export class CallsService {
  private readonly frontendAppUrl: string;
  private readonly ringingAutoMissMs: number;
  private readonly visitorTokenSecret: string;

  constructor(
    @InjectRepository(CallEntity)
    private readonly callsRepository: Repository<CallEntity>,
    @InjectRepository(HomeEntity)
    private readonly homesRepository: Repository<HomeEntity>,
    private readonly pushService: PushService,
    private readonly configService: ConfigService
  ) {
    const configured = this.configService.get<string>('FRONTEND_APP_URL');
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN');
    this.frontendAppUrl = (configured ?? corsOrigin ?? 'http://localhost:3000').replace(/\/+$/, '');

    // Render Free may sleep, so we expire on-demand (when listing history) rather than relying on a scheduler.
    const raw = this.configService.get<string>('CALL_RINGING_AUTO_MISS_SECONDS');
    const seconds = raw ? Number(raw) : 120;
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 120;
    this.ringingAutoMissMs = Math.floor(safeSeconds * 1000);

    // Stateless visitor auth for WebRTC signaling. Defaults to JWT_SECRET to avoid extra env wiring.
    this.visitorTokenSecret =
      this.configService.get<string>('VISITOR_TOKEN_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET');
  }

  private async expireRingingCalls(homeIds: string[]): Promise<void> {
    if (homeIds.length === 0) {
      return;
    }

    const threshold = new Date(Date.now() - this.ringingAutoMissMs);

    await this.callsRepository.update(
      {
        homeId: In(homeIds),
        status: 'ringing',
        createdAt: LessThan(threshold)
      },
      {
        status: 'missed',
        missedAt: new Date(),
        answeredAt: null
      }
    );
  }

  async ring(dto: RingDto): Promise<RingResponse> {
    const home = await this.homesRepository.findOne({
      where: {
        id: dto.homeId,
        isActive: true
      }
    });

    if (!home) {
      throw new NotFoundException('Home not found');
    }

    const createdCall = this.callsRepository.create({
      homeId: home.id,
      status: 'ringing',
      answeredAt: null,
      missedAt: null
    });

    const savedCall = await this.callsRepository.save(createdCall);

    await this.pushService.notifyRing(home.ownerId, {
      callId: savedCall.id,
      homeId: home.id,
      homeName: home.name,
      // Owner deep-link: the visitor page is `/ring`, but notifications should open the owner call screen.
      ringUrl: `${this.frontendAppUrl}/call/${encodeURIComponent(savedCall.id)}`
    });

    return {
      ...this.toResponse(savedCall),
      visitorToken: signVisitorToken(savedCall.id, this.visitorTokenSecret)
    };
  }

  async updateStatus(input: UpdateCallStatusInput): Promise<CallResponse> {
    const call = await this.callsRepository.findOne({
      where: { id: input.callId }
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    const home = await this.homesRepository.findOne({
      where: { id: call.homeId }
    });

    if (!home) {
      throw new NotFoundException('Home not found');
    }

    if (home.ownerId !== input.ownerId) {
      throw new ForbiddenException('You do not have access to this call');
    }

    if (call.status !== 'ringing' && call.status !== input.status) {
      throw new ConflictException('Call status can only transition from ringing');
    }

    if (call.status === input.status) {
      return this.toResponse(call);
    }

    call.status = input.status;

    if (input.status === 'accepted') {
      call.answeredAt = new Date();
      call.missedAt = null;
    } else {
      call.missedAt = new Date();
      call.answeredAt = null;
    }

    const saved = await this.callsRepository.save(call);
    return this.toResponse(saved);
  }

  async listByOwner(ownerId: string, limit = 50): Promise<CallHistoryItemResponse[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 200) : 50;

    const homes = await this.homesRepository.find({
      where: { ownerId }
    });

    if (homes.length === 0) {
      return [];
    }

    const homeIds = homes.map((home) => home.id);
    const homeNameById = new Map(homes.map((home) => [home.id, home.name]));

    // Avoid calls being stuck in `ringing` forever.
    await this.expireRingingCalls(homeIds);

    const calls = await this.callsRepository.find({
      where: { homeId: In(homeIds) },
      order: { createdAt: 'DESC' },
      take: safeLimit
    });

    return calls.map((call) => ({
      id: call.id,
      homeId: call.homeId,
      homeName: homeNameById.get(call.homeId) ?? 'Home',
      status: call.status,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
      answeredAt: call.answeredAt ? call.answeredAt.toISOString() : null,
      missedAt: call.missedAt ? call.missedAt.toISOString() : null
    }));
  }

  private toResponse(call: CallEntity): CallResponse {
    return {
      id: call.id,
      homeId: call.homeId,
      status: call.status,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
      answeredAt: call.answeredAt ? call.answeredAt.toISOString() : null,
      missedAt: call.missedAt ? call.missedAt.toISOString() : null
    };
  }
}
