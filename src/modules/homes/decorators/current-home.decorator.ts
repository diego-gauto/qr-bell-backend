import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { HomeEntity } from '../entities/home.entity';

interface HomeRequest {
  home?: HomeEntity;
}

export const CurrentHome = createParamDecorator((_: unknown, ctx: ExecutionContext): HomeEntity => {
  const request = ctx.switchToHttp().getRequest<HomeRequest>();

  if (!request.home) {
    throw new InternalServerErrorException('Home was not resolved by ownership guard');
  }

  return request.home;
});
