import { ConfigService } from '@nestjs/config';

export const getRequiredString = (
  configService: ConfigService,
  key: string,
): string => {
  const value = configService.get<string>(key);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const getNumber = (
  configService: ConfigService,
  key: string,
  fallback: number,
): number => {
  const raw = configService.get<string | number>(key);
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
