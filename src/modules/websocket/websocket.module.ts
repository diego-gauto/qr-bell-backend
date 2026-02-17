import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallEntity } from '../calls/entities/call.entity';
import { HomeEntity } from '../homes/entities/home.entity';
import { CallsGateway } from './gateways/calls.gateway';

@Module({
  imports: [ConfigModule, JwtModule.register({}), TypeOrmModule.forFeature([CallEntity, HomeEntity])],
  providers: [CallsGateway]
})
export class WebsocketModule {}
