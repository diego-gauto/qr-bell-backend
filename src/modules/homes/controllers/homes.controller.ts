import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateHomeDto } from '../dto/create-home.dto';
import { CurrentHome } from '../decorators/current-home.decorator';
import { HomeEntity } from '../entities/home.entity';
import { HomeOwnerGuard } from '../guards/home-owner.guard';
import { HomeQrResponse, HomeResponse } from '../interfaces/home-response.interface';
import { HomesService } from '../services/homes.service';

@UseGuards(JwtAuthGuard)
@Controller('homes')
export class HomesController {
  constructor(private readonly homesService: HomesService) {}

  @Post()
  createHome(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHomeDto): Promise<HomeResponse> {
    return this.homesService.createHome(user.id, dto);
  }

  @Get()
  listHomes(@CurrentUser() user: AuthenticatedUser): Promise<HomeResponse[]> {
    return this.homesService.listHomes(user.id);
  }

  @UseGuards(HomeOwnerGuard)
  @Get(':homeId')
  getHome(@CurrentHome() home: HomeEntity): HomeResponse {
    return this.homesService.toHomeResponse(home);
  }

  @UseGuards(HomeOwnerGuard)
  @Get(':homeId/qr')
  getHomeQr(@CurrentHome() home: HomeEntity): HomeQrResponse {
    return this.homesService.toHomeQrResponse(home);
  }
}
