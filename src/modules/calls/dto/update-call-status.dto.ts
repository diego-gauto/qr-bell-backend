import { IsIn } from 'class-validator';
import { CallStatus } from '../entities/call.entity';

export class UpdateCallStatusDto {
  @IsIn(['accepted', 'missed'])
  status!: Extract<CallStatus, 'accepted' | 'missed'>;
}
