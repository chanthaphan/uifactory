import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
  });
  app.use(cookieParser());
  // Behind an ingress/proxy (e.g. AKS App Gateway) terminating TLS, trust X-Forwarded-* so
  // Secure session cookies are issued correctly.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  Logger.log(`UIFactory API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
