import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HomeEntity } from '../../homes/entities/home.entity';
import { PushService } from '../../push/services/push.service';
import { CallEntity, CallStatus } from '../entities/call.entity';
import { CallsService } from './calls.service';

type MockRepository = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  update: jest.Mock;
};

function createRepositoryMock(): MockRepository {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 0 })
  };
}

describe('CallsService', () => {
  let service: CallsService;
  let callsRepository: MockRepository;
  let homesRepository: MockRepository;
  let pushService: { notifyRing: jest.Mock };

  beforeEach(async () => {
    callsRepository = createRepositoryMock();
    homesRepository = createRepositoryMock();
    pushService = {
      notifyRing: jest.fn().mockResolvedValue(undefined)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        {
          provide: getRepositoryToken(CallEntity),
          useValue: callsRepository
        },
        {
          provide: getRepositoryToken(HomeEntity),
          useValue: homesRepository
        },
        {
          provide: PushService,
          useValue: pushService
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string): string | undefined => {
              if (key === 'FRONTEND_APP_URL') {
                return 'https://app.example.com';
              }
              return undefined;
            },
            getOrThrow: (key: string): string => {
              if (key === 'JWT_SECRET') {
                return 'test-jwt-secret';
              }
              throw new Error(`Missing config: ${key}`);
            }
          }
        }
      ]
    }).compile();

    service = module.get<CallsService>(CallsService);
  });

  it('creates a ringing call and notifies owner subscriptions', async () => {
    const now = new Date('2026-02-16T21:00:00.000Z');
    const home = {
      id: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
      ownerId: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21',
      name: 'Casa principal',
      isActive: true
    } as HomeEntity;
    const createdCall = {
      id: 'd15d4109-b66c-4684-9583-97e3462e6657',
      homeId: home.id,
      status: 'ringing' as CallStatus,
      createdAt: now,
      updatedAt: now,
      answeredAt: null,
      missedAt: null
    } as CallEntity;

    homesRepository.findOne.mockResolvedValue(home);
    callsRepository.create.mockReturnValue(createdCall);
    callsRepository.save.mockResolvedValue(createdCall);

    const ringResult = await service.ring({
      homeId: home.id
    });

    expect(ringResult.status).toBe('ringing');
    expect(ringResult.visitorToken).toBeDefined();
    expect(pushService.notifyRing).toHaveBeenCalledWith(
      home.ownerId,
      expect.objectContaining({
        callId: createdCall.id,
        homeId: home.id
      })
    );
  });

  it('updates status from ringing to accepted', async () => {
    const now = new Date('2026-02-16T21:05:00.000Z');
    const call = {
      id: 'd15d4109-b66c-4684-9583-97e3462e6657',
      homeId: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
      status: 'ringing' as CallStatus,
      createdAt: now,
      updatedAt: now,
      answeredAt: null,
      missedAt: null
    } as CallEntity;
    const home = {
      id: call.homeId,
      ownerId: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21',
      isActive: true
    } as HomeEntity;

    callsRepository.findOne.mockResolvedValue(call);
    homesRepository.findOne.mockResolvedValue(home);
    callsRepository.save.mockImplementation(async (value: CallEntity) => value);

    const result = await service.updateStatus({
      callId: call.id,
      ownerId: home.ownerId,
      status: 'accepted'
    });

    expect(result.status).toBe('accepted');
    expect(result.answeredAt).not.toBeNull();
  });

  it('rejects status update when home does not belong to owner', async () => {
    const call = {
      id: 'd15d4109-b66c-4684-9583-97e3462e6657',
      homeId: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
      status: 'ringing' as CallStatus
    } as CallEntity;
    const home = {
      id: call.homeId,
      ownerId: 'another-owner-id',
      isActive: true
    } as HomeEntity;

    callsRepository.findOne.mockResolvedValue(call);
    homesRepository.findOne.mockResolvedValue(home);

    await expect(
      service.updateStatus({
        callId: call.id,
        ownerId: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21',
        status: 'missed'
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid transition when call is no longer ringing', async () => {
    const call = {
      id: 'd15d4109-b66c-4684-9583-97e3462e6657',
      homeId: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
      status: 'accepted' as CallStatus
    } as CallEntity;
    const home = {
      id: call.homeId,
      ownerId: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21'
    } as HomeEntity;

    callsRepository.findOne.mockResolvedValue(call);
    homesRepository.findOne.mockResolvedValue(home);

    await expect(
      service.updateStatus({
        callId: call.id,
        ownerId: home.ownerId,
        status: 'missed'
      })
    ).rejects.toThrow(ConflictException);
  });

  it('throws not found when ring home does not exist', async () => {
    homesRepository.findOne.mockResolvedValue(null);

    await expect(
      service.ring({
        homeId: '6f76cb04-ea20-43fa-8f4e-395527fb4efe'
      })
    ).rejects.toThrow(NotFoundException);
  });

  it('lists calls for owner homes', async () => {
    const ownerId = 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21';
    const homeA = {
      id: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
      ownerId,
      name: 'Casa A',
      isActive: true
    } as HomeEntity;
    const homeB = {
      id: '0c6d3345-6a23-4c13-b0f0-ced9b0dc9d7b',
      ownerId,
      name: 'Casa B',
      isActive: true
    } as HomeEntity;

    const now = new Date('2026-02-16T21:10:00.000Z');
    const call = {
      id: 'd15d4109-b66c-4684-9583-97e3462e6657',
      homeId: homeB.id,
      status: 'accepted' as CallStatus,
      createdAt: now,
      updatedAt: now,
      answeredAt: now,
      missedAt: null
    } as CallEntity;

    homesRepository.find.mockResolvedValue([homeA, homeB]);
    callsRepository.find.mockResolvedValue([call]);

    const result = await service.listByOwner(ownerId, 50);

    expect(homesRepository.find).toHaveBeenCalledWith({ where: { ownerId } });
    expect(callsRepository.update).toHaveBeenCalled();
    expect(callsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
        take: 50
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.homeName).toBe('Casa B');
    expect(result[0]?.status).toBe('accepted');
  });
});
