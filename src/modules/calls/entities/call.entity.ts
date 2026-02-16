export class CallEntity {
  id!: string;
  homeId!: string;
  status!: 'ringing' | 'answered' | 'missed' | 'rejected';
  createdAt!: Date;
}
