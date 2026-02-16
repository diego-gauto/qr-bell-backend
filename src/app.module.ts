import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CallsModule } from './modules/calls/calls.module';
import { HomesModule } from './modules/homes/homes.module';
import { PushModule } from './modules/push/push.module';
import { UsersModule } from './modules/users/users.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule,
    UsersModule,
    HomesModule,
    CallsModule,
    PushModule,
    WebsocketModule
  ]
})
export class AppModule {}
