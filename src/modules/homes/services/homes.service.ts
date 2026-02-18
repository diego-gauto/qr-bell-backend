import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHomeDto } from '../dto/create-home.dto';
import { HomeEntity } from '../entities/home.entity';
import { HomeQrResponse, HomeResponse } from '../interfaces/home-response.interface';

@Injectable()
export class HomesService {
  private readonly frontendAppUrl: string;

  constructor(
    @InjectRepository(HomeEntity)
    private readonly homesRepository: Repository<HomeEntity>,
    private readonly configService: ConfigService
  ) {
    this.frontendAppUrl = this.resolveFrontendAppUrl();
  }

  async createHome(ownerId: string, dto: CreateHomeDto): Promise<HomeResponse> {
    const home = new HomeEntity();
    home.ownerId = ownerId;
    home.name = dto.name.trim();
    home.address = dto.address?.trim() ? dto.address.trim() : null;
    home.isActive = true;

    const savedHome = await this.homesRepository.save(home);
    return this.toHomeResponse(savedHome);
  }

  async listHomes(ownerId: string): Promise<HomeResponse[]> {
    const homes = await this.homesRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' }
    });

    return homes.map((home) => this.toHomeResponse(home));
  }

  async getOwnedHome(ownerId: string, homeId: string): Promise<HomeEntity> {
    const home = await this.homesRepository.findOne({
      where: { id: homeId }
    });

    if (!home) {
      throw new NotFoundException('Home not found');
    }

    if (home.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this home');
    }

    return home;
  }

  toHomeResponse(home: HomeEntity): HomeResponse {
    return {
      id: home.id,
      name: home.name,
      address: home.address,
      isActive: home.isActive,
      createdAt: home.createdAt.toISOString(),
      updatedAt: home.updatedAt.toISOString(),
      ringUrl: this.buildRingUrl(home.id)
    };
  }

  toHomeQrResponse(home: HomeEntity): HomeQrResponse {
    return {
      home: this.toHomeResponse(home),
      qrUrl: this.buildRingUrl(home.id)
    };
  }

  private buildRingUrl(homeId: string): string {
    // Visitor entrypoint is `/` so scanning a QR always lands on the "Tocar timbre" screen.
    return `${this.frontendAppUrl}/?h=${encodeURIComponent(homeId)}`;
  }

  private resolveFrontendAppUrl(): string {
    const configured = this.configService.get<string>('FRONTEND_APP_URL');
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN');
    const resolvedUrl = configured ?? corsOrigin ?? 'http://localhost:3000';

    return resolvedUrl.replace(/\/+$/, '');
  }
}
