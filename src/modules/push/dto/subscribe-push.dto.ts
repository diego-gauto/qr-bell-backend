import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubscribePushDto {
  @IsObject()
  subscription!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
