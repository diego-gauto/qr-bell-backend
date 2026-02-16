import { CallStatus } from '../entities/call.entity';

export interface CallResponse {
  id: string;
  homeId: string;
  status: CallStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
  missedAt: string | null;
}
