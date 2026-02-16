import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { PushService } from './push.service';

type MockRepository = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
};

function createRepositoryMock(): MockRepository {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn()
  };
}

describe('PushService', () => {
  let service: PushService;
  let repository: MockRepository;

  beforeEach(async () => {
    repository = createRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        {
          provide: getRepositoryToken(PushSubscriptionEntity),
          useValue: repository
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string): string => {
              if (key === 'VAPID_PUBLIC_KEY') {
                return 'public-key';
              }
              if (key === 'VAPID_PRIVATE_KEY') {
                return 'private-key';
              }
              return 'mailto:test@example.com';
            },
            get: (key: string): string | undefined => {
              if (key === 'VAPID_SUBJECT') {
                return 'mailto:test@example.com';
              }
              return undefined;
            }
          }
        }
      ]
    }).compile();

    service = module.get<PushService>(PushService);
  });

  it('creates a subscription when endpoint does not exist', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.save.mockImplementation(async (value: PushSubscriptionEntity) => value);

    const result = await service.subscribe('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21', {
      userAgent: 'Mozilla/5.0',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/subscription-a',
        expirationTime: null,
        keys: {
          p256dh: 'p256dh-a',
          auth: 'auth-a'
        }
      }
    });

    expect(result.endpoint).toBe('https://fcm.googleapis.com/subscription-a');
    expect(result.isActive).toBe(true);
  });

  it('reactivates existing subscription and updates metadata', async () => {
    const existing = {
      id: '95dbc2eb-f17a-4f39-b8d6-8013de592d7e',
      ownerId: 'another-owner-id',
      endpoint: 'https://fcm.googleapis.com/subscription-b',
      p256dhKey: 'old-p256dh',
      authKey: 'old-auth',
      userAgent: null,
      isActive: false
    } as PushSubscriptionEntity;

    repository.findOne.mockResolvedValue(existing);
    repository.save.mockImplementation(async (value: PushSubscriptionEntity) => value);

    const result = await service.subscribe('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21', {
      userAgent: 'Mozilla/5.0',
      subscription: {
        endpoint: existing.endpoint,
        expirationTime: null,
        keys: {
          p256dh: 'new-p256dh',
          auth: 'new-auth'
        }
      }
    });

    expect(result.ownerId).toBe('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21');
    expect(result.p256dhKey).toBe('new-p256dh');
    expect(result.authKey).toBe('new-auth');
    expect(result.isActive).toBe(true);
  });
});
