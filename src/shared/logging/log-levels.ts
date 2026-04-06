import { type LogLevel } from '@nestjs/common';

export const resolveLogLevels = (rawValue?: string): LogLevel[] | undefined => {
  const raw = (rawValue ?? '').trim().toLowerCase();
  if (!raw) return undefined;

  const order: Record<LogLevel, number> = {
    fatal: 0,
    error: 0,
    warn: 2,
    log: 3,
    debug: 4,
    verbose: 5,
  };

  const requested = raw as LogLevel;
  if (!(requested in order)) return undefined;

  return (Object.keys(order) as LogLevel[]).filter(
    (level) => order[level] <= order[requested],
  );
};
