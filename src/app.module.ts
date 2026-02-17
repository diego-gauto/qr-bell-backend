import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalRateLimitGuard } from './common/guards/global-rate-limit.guard';
import { RateLimitStoreService } from './common/guards/rate-limit-store.service';
import { AuthModule } from './modules/auth/auth.module';
import { CallsModule } from './modules/calls/calls.module';
import { HealthModule } from './modules/health/health.module';
import { HomesModule } from './modules/homes/homes.module';
import { PushModule } from './modules/push/push.module';
import { UsersModule } from './modules/users/users.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

const nodeEnv = process.env['NODE_ENV'] ?? 'develop';
const envFilePaths = [
  `.env.${nodeEnv}.local`,
  `.env.${nodeEnv}`,
  '.env'
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
        const useSsl = configService.get<string>('DATABASE_SSL', 'true') === 'true';

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          autoLoadEntities: true,
          synchronize: false,
          ssl: useSsl ? { rejectUnauthorized: false } : false
        };
      }
    }),
    AuthModule,
    UsersModule,
    HealthModule,
    HomesModule,
    CallsModule,
    PushModule,
    WebsocketModule
  ],
  providers: [
    RateLimitStoreService,
    {
      provide: APP_GUARD,
      useClass: GlobalRateLimitGuard
    }
  ]
})
export class AppModule {}
