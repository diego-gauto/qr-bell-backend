import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UpdateResult } from 'typeorm';
import { AuthService } from './auth.service';
import { UserEntity } from '../entities/user.entity';

interface UsersRepositoryMock {
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: UsersRepositoryMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn()
          }
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockImplementation(async (payload: { sub: string }): Promise<string> => {
              return `token-${payload.sub}`;
            }),
            verifyAsync: jest
              .fn()
              .mockResolvedValue({ sub: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21', email: 'john@example.com' })
          }
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockImplementation((key: string): string => {
              const map: Record<string, string> = {
                JWT_SECRET: 'access-secret',
                JWT_EXPIRES_IN: '15m',
                REFRESH_TOKEN_SECRET: 'refresh-secret',
                REFRESH_TOKEN_EXPIRES_IN: '7d'
              };

              return map[key] ?? '';
            }),
            get: jest.fn().mockImplementation((key: string): string | undefined => {
              const map: Record<string, string> = {
                JWT_EXPIRES_IN: '15m',
                REFRESH_TOKEN_EXPIRES_IN: '7d'
              };

              return map[key];
            })
          }
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(UserEntity));
  });

  it('should register a new user and return tokens', async () => {
    usersRepository.findOne.mockResolvedValueOnce(null);

    usersRepository.save
      .mockImplementationOnce(async (entity: UserEntity): Promise<UserEntity> => {
        const now = new Date();

        return {
          ...entity,
          id: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21',
          createdAt: now,
          updatedAt: now
        };
      })
      .mockImplementation(async (entity: UserEntity): Promise<UserEntity> => entity);

    const result = await service.register({
      email: 'john@example.com',
      name: 'John',
      password: 'secret123'
    });

    expect(result.user.email).toBe('john@example.com');
    expect(result.accessToken).toBe('token-f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21');
    expect(result.refreshToken).toBe('token-f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21');
    expect(usersRepository.save).toHaveBeenCalledTimes(2);
  });

  it('should throw conflict exception when email already exists during register', async () => {
    const existingUser = new UserEntity();
    existingUser.id = '8e6af868-7f8d-4c4f-9db5-f45ef2482da8';
    existingUser.email = 'john@example.com';
    existingUser.name = 'John';
    existingUser.passwordHash = 'hash';
    existingUser.createdAt = new Date();
    existingUser.updatedAt = new Date();

    usersRepository.findOne.mockResolvedValueOnce(existingUser);

    await expect(
      service.register({
        email: 'john@example.com',
        name: 'John',
        password: 'secret123'
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw unauthorized exception when password is invalid', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    const existingUser = new UserEntity();
    existingUser.id = '8e6af868-7f8d-4c4f-9db5-f45ef2482da8';
    existingUser.email = 'john@example.com';
    existingUser.name = 'John';
    existingUser.passwordHash = hash;
    existingUser.createdAt = new Date();
    existingUser.updatedAt = new Date();

    usersRepository.findOne.mockResolvedValueOnce(existingUser);

    await expect(
      service.login({
        email: 'john@example.com',
        password: 'invalid-pass'
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should refresh tokens when refresh token is valid', async () => {
    const refreshToken = 'valid-refresh-token';
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const existingUser = new UserEntity();
    existingUser.id = 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21';
    existingUser.email = 'john@example.com';
    existingUser.name = 'John';
    existingUser.passwordHash = await bcrypt.hash('secret123', 10);
    existingUser.refreshTokenHash = refreshTokenHash;
    existingUser.createdAt = new Date();
    existingUser.updatedAt = new Date();

    usersRepository.findOne.mockResolvedValue(existingUser);
    usersRepository.save.mockImplementation(async (entity: UserEntity): Promise<UserEntity> => entity);

    const result = await service.refresh({ refreshToken });

    expect(result.user.id).toBe(existingUser.id);
    expect(result.accessToken).toBe('token-f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21');
    expect(result.refreshToken).toBe('token-f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21');
  });

  it('should clear stored refresh token hash during logout', async () => {
    const updateResult: UpdateResult = {
      generatedMaps: [],
      raw: [],
      affected: 1
    };

    usersRepository.update.mockResolvedValue(updateResult);

    await service.logout('f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21');

    expect(usersRepository.update).toHaveBeenCalledWith(
      { id: 'f0d2b8be-4f63-4be1-95ca-d83ddf9f1f21' },
      { refreshTokenHash: null },
    );
  });
});
