import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HomeEntity } from '../entities/home.entity';
import { HomesService } from './homes.service';

type MockRepository = {
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
};

function createRepositoryMock(): MockRepository {
  return {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn()
  };
}

describe('HomesService', () => {
  let service: HomesService;
  let repository: MockRepository;

  beforeEach(async () => {
    repository = createRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomesService,
        {
          provide: getRepositoryToken(HomeEntity),
          useValue: repository
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string): string | undefined => {
              if (key === 'FRONTEND_APP_URL') {
                return 'https://app.example.com/';
              }
              return undefined;
            }
          }
        }
      ]
    }).compile();

    service = module.get<HomesService>(HomesService);
  });

  it('creates a home and returns ringUrl', async () => {
    const now = new Date('2026-02-16T20:00:00.000Z');
    const persistedHome = {
      id: '8d4bb768-0f47-4da8-816c-6b287f0d6208',
      ownerId: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21',
      name: 'Casa principal',
      address: 'Av. Siempre Viva 123',
      isActive: true,
      createdAt: now,
      updatedAt: now
    } as HomeEntity;

    repository.save.mockResolvedValue(persistedHome);

    const created = await service.createHome('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21', {
      name: ' Casa principal ',
      address: ' Av. Siempre Viva 123 '
    });

    expect(created.ringUrl).toBe('https://app.example.com/?h=8d4bb768-0f47-4da8-816c-6b287f0d6208');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('throws when home does not belong to owner', async () => {
    repository.findOne.mockResolvedValue({
      id: '8d4bb768-0f47-4da8-816c-6b287f0d6208',
      ownerId: 'another-user-id'
    } as HomeEntity);

    await expect(
      service.getOwnedHome('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21', '8d4bb768-0f47-4da8-816c-6b287f0d6208')
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when home does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.getOwnedHome('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21', '8d4bb768-0f47-4da8-816c-6b287f0d6208')
    ).rejects.toThrow(NotFoundException);
  });
});
