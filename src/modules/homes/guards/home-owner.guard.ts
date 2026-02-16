import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { HomeEntity } from '../entities/home.entity';
import { HomesService } from '../services/homes.service';

interface HomeOwnerRequest {
  user?: AuthenticatedUser;
  params: {
    homeId?: string;
  };
  home?: HomeEntity;
}

@Injectable()
export class HomeOwnerGuard implements CanActivate {
  constructor(private readonly homesService: HomesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HomeOwnerRequest>();
    const user = request.user;
    const homeId = request.params.homeId;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!homeId || !isUUID(homeId, '4')) {
      throw new BadRequestException('homeId must be a valid UUID');
    }

    request.home = await this.homesService.getOwnedHome(user.id, homeId);
    return true;
  }
}
