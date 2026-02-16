import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { UserEntity } from '../entities/user.entity';
import { AuthResponse, AuthUser, JwtPayload } from '../interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    this.accessTokenSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.accessTokenTtlSeconds = this.parseExpiryToSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m'
    );
    this.refreshTokenSecret = this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET');
    this.refreshTokenTtlSeconds = this.parseExpiryToSeconds(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d'
    );
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() }
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const createdUser = new UserEntity();
    createdUser.email = dto.email.toLowerCase();
    createdUser.name = dto.name.trim();
    createdUser.passwordHash = passwordHash;
    createdUser.refreshTokenHash = null;

    const savedUser = await this.usersRepository.save(createdUser);
    const tokens = await this.createTokens(savedUser);

    return {
      user: this.toAuthUser(tokens.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.createTokens(user);

    return {
      user: this.toAuthUser(tokens.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub }
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshValid = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!isRefreshValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.createTokens(user);

    return {
      user: this.toAuthUser(tokens.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.update({ id: userId }, { refreshTokenHash: null });
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toAuthUser(user);
  }

  private async createTokens(user: UserEntity): Promise<{
    user: UserEntity;
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.accessTokenSecret,
      expiresIn: this.accessTokenTtlSeconds
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenTtlSeconds
    });

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const savedUser = await this.usersRepository.save(user);

    return {
      user: savedUser,
      accessToken,
      refreshToken
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshTokenSecret
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private toAuthUser(user: UserEntity): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const normalized = expiry.trim().toLowerCase();
    const matches = /^(\d+)([smhd])$/.exec(normalized);

    if (!matches) {
      return 900;
    }

    const amount = Number(matches[1]);
    const unit = matches[2];

    if (unit === 's') {
      return amount;
    }

    if (unit === 'm') {
      return amount * 60;
    }

    if (unit === 'h') {
      return amount * 60 * 60;
    }

    return amount * 60 * 60 * 24;
  }
}
