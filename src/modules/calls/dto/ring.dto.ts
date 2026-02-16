import { IsUUID } from 'class-validator';

export class RingDto {
  @IsUUID()
  homeId!: string;
}
