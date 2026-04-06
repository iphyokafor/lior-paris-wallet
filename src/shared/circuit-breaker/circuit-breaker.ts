import { Logger } from '@nestjs/common';
import * as CircuitBreakerLib from 'opossum';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  errorThresholdPercentage?: number;
  /** Time in ms before attempting a half-open probe (default: 30 000) */
  resetTimeout?: number;
  /** Rolling count window in ms (default: 10 000) */
  rollingCountTimeout?: number;
  /** Number of buckets in the rolling window (default: 10) */
  rollingCountBuckets?: number;
  /** Request volume threshold — minimum calls before tripping (default: 5) */
  volumeThreshold?: number;
  /** Timeout per call in ms — 0 disables (default: 10 000) */
  timeout?: number;
}

const DEFAULTS: CircuitBreakerLib.Options = {
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  rollingCountTimeout: 10_000,
  rollingCountBuckets: 10,
  volumeThreshold: 5,
  timeout: 10_000,
};

export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly breaker: CircuitBreakerLib;

  constructor(name: string, options?: CircuitBreakerOptions) {
    this.logger = new Logger(`CircuitBreaker:${name}`);

    // Opossum wraps a function; we use a passthrough that executes whatever is passed in
    const passthrough = <T>(fn: () => Promise<T>): Promise<T> => fn();

    this.breaker = new CircuitBreakerLib(passthrough, {
      ...DEFAULTS,
      ...options,
      name,
    });

    this.breaker.on('open', () =>
      this.logger.warn(`Circuit OPENED — ${name} is temporarily unavailable`),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.log(`Circuit HALF-OPEN — probing ${name}`),
    );
    this.breaker.on('close', () =>
      this.logger.log(`Circuit CLOSED — ${name} recovered`),
    );
    this.breaker.on('fallback', () =>
      this.logger.warn(`Fallback triggered for ${name}`),
    );
  }

  async fire<T>(fn: () => Promise<T>): Promise<T> {
    return this.breaker.fire(fn) as Promise<T>;
  }

  get isOpen(): boolean {
    return this.breaker.opened;
  }

  get stats(): CircuitBreakerLib.Stats {
    return this.breaker.stats;
  }

  get status(): CircuitBreakerLib.Status {
    return this.breaker.status;
  }
}
