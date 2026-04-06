import { CircuitBreaker } from '../../../src/shared/circuit-breaker/circuit-breaker';

describe('CircuitBreaker (opossum)', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('TestService', {
      errorThresholdPercentage: 50,
      resetTimeout: 500,
      rollingCountTimeout: 1000,
      rollingCountBuckets: 1,
      volumeThreshold: 2,
      timeout: false as any, // disable timeout for tests
    });
  });

  it('starts closed and delegates successful calls', async () => {
    const result = await breaker.fire(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.isOpen).toBe(false);
  });

  it('opens after error threshold is reached', async () => {
    const fail = () => Promise.reject(new Error('boom'));

    // Fire enough failures to trip the breaker (volumeThreshold: 2, errorThreshold: 50%)
    await expect(breaker.fire(fail)).rejects.toThrow('boom');
    await expect(breaker.fire(fail)).rejects.toThrow('boom');

    expect(breaker.isOpen).toBe(true);
  });

  it('rejects calls immediately when open', async () => {
    const fail = () => Promise.reject(new Error('x'));

    await expect(breaker.fire(fail)).rejects.toThrow();
    await expect(breaker.fire(fail)).rejects.toThrow();

    // Circuit is open — next call should be rejected with opossum error
    await expect(breaker.fire(() => Promise.resolve('ok'))).rejects.toThrow(
      'Breaker is open',
    );
  });

  it('transitions to half-open and recovers after resetTimeout', async () => {
    const fail = () => Promise.reject(new Error('x'));

    await expect(breaker.fire(fail)).rejects.toThrow();
    await expect(breaker.fire(fail)).rejects.toThrow();

    expect(breaker.isOpen).toBe(true);

    // Wait for resetTimeout to allow half-open probe
    await new Promise((r) => setTimeout(r, 600));

    const result = await breaker.fire(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.isOpen).toBe(false);
  });

  it('re-opens if half-open probe fails', async () => {
    const fail = () => Promise.reject(new Error('x'));

    await expect(breaker.fire(fail)).rejects.toThrow();
    await expect(breaker.fire(fail)).rejects.toThrow();

    expect(breaker.isOpen).toBe(true);

    await new Promise((r) => setTimeout(r, 600));

    // Half-open probe fails
    await expect(breaker.fire(fail)).rejects.toThrow('x');

    // Should be open again
    expect(breaker.isOpen).toBe(true);
  });

  it('exposes stats from opossum', async () => {
    await breaker.fire(() => Promise.resolve('ok'));
    const { successes } = breaker.stats;
    expect(successes).toBeGreaterThanOrEqual(1);
  });
});
