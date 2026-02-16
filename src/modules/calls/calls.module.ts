import { Module } from '@nestjs/common';
import { RateLimitStoreService } from '../../common/guards/rate-limit-store.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeEntity } from '../homes/entities/home.entity';
import { PushModule } from '../push/push.module';
import { CallsController } from './controllers/calls.controller';
import { CallEntity } from './entities/call.entity';
import { RingRateLimitGuard } from './guards/ring-rate-limit.guard';
import { CallsService } from './services/calls.service';

@Module({
  imports: [TypeOrmModule.forFeature([CallEntity, HomeEntity]), PushModule],
  controllers: [CallsController],
  providers: [CallsService, RingRateLimitGuard, RateLimitStoreService],
  exports: [CallsService]
})
export class CallsModule {}
