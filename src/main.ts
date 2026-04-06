import { ConfigModule, ConfigService } from '@nestjs/config';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import * as cookieParser from 'cookie-parser';
import { json, raw } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveLogLevels } from './shared/logging/log-levels';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
})
class BootstrapConfigModule {}

const bootstrap = async () => {
  try {
    const appContext = await NestFactory.createApplicationContext(
      BootstrapConfigModule,
      { logger: false },
    );

    const configService = appContext.get(ConfigService);
    const logLevels = resolveLogLevels(configService.get<string>('LOG_LEVEL'));
    await appContext.close();

    if (logLevels) {
      Logger.overrideLogger(logLevels);
    }

    const app = await NestFactory.create(AppModule, {
      logger: logLevels,
    });

    // Raw body parser for Stripe webhook (must be before JSON parser)
    app.use('/api/v1/stripe/webhook', raw({ type: 'application/json' }));

    app.use(
      json({
        type: ['application/vnd.api+json'],
      }),
    );

    app.use(cookieParser());

    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
    );
    const { version } = packageJson;

    const PORT = configService.get('PORT') || 3500;

    const getVersion = Math.floor(Number.parseInt(version));

    app.setGlobalPrefix(`api/v${getVersion}`);

    await app.listen(PORT, () =>
      Logger.log(`Service is running at: http://localhost:${PORT}`),
    );
  } catch (error) {
    console.error('Error starting server', error);
    Logger.error('Error starting server', error);
    process.exit(1);
  }
};

bootstrap();
