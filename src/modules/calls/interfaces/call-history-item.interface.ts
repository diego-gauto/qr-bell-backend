import { CallStatus } from '../entities/call.entity';

export interface CallHistoryItemResponse {
  id: string;
  homeId: string;
  homeName: string;
  status: CallStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
  missedAt: string | null;
}

