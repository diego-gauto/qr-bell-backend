import { IsObject, IsString } from 'class-validator';

export class SubscribePushDto {
  @IsObject()
  subscription!: Record<string, unknown>;

  @IsString()
  userAgent!: string;
}
