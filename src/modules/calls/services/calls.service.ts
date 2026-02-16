import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HomeEntity } from '../../homes/entities/home.entity';
import { PushService } from '../../push/services/push.service';
import { RingDto } from '../dto/ring.dto';
import { CallEntity, CallStatus } from '../entities/call.entity';
import { CallResponse } from '../interfaces/call-response.interface';

interface UpdateCallStatusInput {
  callId: string;
  ownerId: string;
  status: Extract<CallStatus, 'accepted' | 'missed'>;
}

@Injectable()
export class CallsService {
  private readonly frontendAppUrl: string;

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
  }

  async ring(dto: RingDto): Promise<CallResponse> {
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
      ringUrl: `${this.frontendAppUrl}/ring?h=${encodeURIComponent(home.id)}`
    });

    return this.toResponse(savedCall);
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
