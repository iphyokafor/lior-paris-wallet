import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { json } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './features/auth/auth.module';
import { JwtAuthGuard } from './features/auth/guards/jwt-auth.guard';
import { RoleGuard } from './features/auth/guards/role.guard';
import { NotificationsModule } from './features/notifications/notifications.module';
import { TransfersModule } from './features/transfers/transfers.module';
import { UsersModule } from './features/users/users.module';
import { WalletModule } from './features/wallet/wallet.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { JsonApiExceptionFilter } from './shared/filters/jsonapi-exception.filter';
import { JsonApiContentTypeInterceptor } from './shared/interceptors/jsonapi-content-type.interceptor';
import { JsonApiValidationPipe } from './shared/pipes/jsonapi-validation.pipe';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    WalletModule,
    TransfersModule,
    NotificationsModule,
    OutboxModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useFactory: () => new JsonApiValidationPipe({ transform: true }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: JsonApiContentTypeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: JsonApiExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        json({
          type: ['application/vnd.api+json'],
        }),
      )
      .exclude({ path: 'stripe/webhook', method: RequestMethod.POST })
      .forRoutes('*');
  }
}
