import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeEntity } from '../homes/entities/home.entity';
import { PushModule } from '../push/push.module';
import { CallsController } from './controllers/calls.controller';
import { CallEntity } from './entities/call.entity';
import { CallsService } from './services/calls.service';

@Module({
  imports: [TypeOrmModule.forFeature([CallEntity, HomeEntity]), PushModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService]
})
export class CallsModule {}
