import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateHomeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
