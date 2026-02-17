import { CallResponse } from './call-response.interface';

export interface RingResponse extends CallResponse {
  visitorToken: string;
}

