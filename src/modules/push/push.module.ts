import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushController } from './controllers/push.controller';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PushService } from './services/push.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscriptionEntity])],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService]
})
export class PushModule {}
