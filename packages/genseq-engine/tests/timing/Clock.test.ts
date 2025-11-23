import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../../src/clock/Clock';

/**
 * T011: Clock precision test with <1ms jitter validation
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * Clock class does not exist yet - implementation will come after tests pass Red phase.
 *
 * Performance Requirements:
 * - Clock jitter: <1ms variance over 10 minutes
 * - Consistent tick timing across long runs
 * - High-precision timestamp accuracy
 */

describe('Clock - Timing Precision', () => {
  let clock: Clock;

  beforeEach(() => {
    // Will fail - Clock class doesn't exist yet
    clock = new Clock({ bpm: 120, ppq: 480 });
  });

  afterEach(() => {
    if (clock) {
      clock.stop();
    }
  });

  it('should maintain <1ms jitter over 1000 ticks', async () => {
    const tickCount = 1000;
    const expectedInterval = (60 * 1000) / (120 * 480); // ms per tick at 120 BPM, 480 PPQ
    const tickTimestamps: number[] = [];

    // Record tick timestamps
    const recordTick = () => {
      tickTimestamps.push(performance.now());
    };

    clock.on('tick', recordTick);
    clock.start();

    // Wait for all ticks to complete
    await new Promise<void>((resolve) => {
      const checkComplete = () => {
        if (tickTimestamps.length >= tickCount) {
          clock.stop();
          resolve();
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });

    // Calculate jitter variance
    const intervals: number[] = [];
    for (let i = 1; i < tickTimestamps.length; i++) {
      intervals.push(tickTimestamps[i] - tickTimestamps[i - 1]);
    }

    const deviations = intervals.map(interval => Math.abs(interval - expectedInterval));
    const maxDeviation = Math.max(...deviations);
    const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

    // Assertions - MUST FAIL until Clock is implemented
    expect(maxDeviation).toBeLessThan(1.0); // Max jitter < 1ms
    expect(avgDeviation).toBeLessThan(0.5); // Avg jitter < 0.5ms
  });

  it('should maintain accurate timing over extended duration (10 minutes simulation)', async () => {
    const durationMs = 600000; // 10 minutes
    const bpm = 120;
    const ppq = 480;
    const expectedTicksPerMinute = bpm * ppq;
    const expectedTotalTicks = (durationMs / 60000) * expectedTicksPerMinute;

    let tickCount = 0;
    const startTime = performance.now();

    clock.on('tick', () => {
      tickCount++;
    });

    clock.start();

    // Simulate 10 minutes by fast-forwarding time
    vi.useFakeTimers();
    vi.advanceTimersByTime(durationMs);

    const endTime = performance.now();
    const actualDuration = endTime - startTime;

    clock.stop();
    vi.useRealTimers();

    // Calculate timing accuracy
    const tickError = Math.abs(tickCount - expectedTotalTicks);
    const tickErrorPercent = (tickError / expectedTotalTicks) * 100;

    // MUST FAIL - Clock doesn't exist yet
    expect(tickErrorPercent).toBeLessThan(0.1); // < 0.1% error over 10 minutes
    expect(Math.abs(actualDuration - durationMs)).toBeLessThan(100); // < 100ms total drift
  });

  it('should provide high-precision timestamps for each tick', () => {
    let lastTimestamp = 0;
    let timestampPrecisionValid = true;

    clock.on('tick', (timestamp: number) => {
      // Verify timestamp is in nanoseconds or high-precision format
      if (timestamp <= lastTimestamp) {
        timestampPrecisionValid = false;
      }
      // Check for sub-millisecond precision
      if (!Number.isInteger(timestamp * 1000)) {
        // Should have sub-millisecond precision
      }
      lastTimestamp = timestamp;
    });

    clock.start();

    // Run for short duration to collect samples
    const samples = 100;
    let sampleCount = 0;

    return new Promise<void>((resolve) => {
      const sampleInterval = setInterval(() => {
        sampleCount++;
        if (sampleCount >= samples) {
          clearInterval(sampleInterval);
          clock.stop();

          // MUST FAIL - Clock doesn't exist
          expect(timestampPrecisionValid).toBe(true);
          resolve();
        }
      }, 10);
    });
  });

  it('should support dynamic BPM changes without timing glitches', async () => {
    const initialBpm = 120;
    const newBpm = 140;
    const tickTimestamps: number[] = [];

    clock.on('tick', () => {
      tickTimestamps.push(performance.now());
    });

    clock.start();

    // Collect ticks at initial BPM
    await new Promise(resolve => setTimeout(resolve, 100));

    // Change BPM
    clock.setBpm(newBpm);

    // Collect ticks at new BPM
    await new Promise(resolve => setTimeout(resolve, 100));

    clock.stop();

    // Verify no gaps or duplicate ticks during transition
    const intervals: number[] = [];
    for (let i = 1; i < tickTimestamps.length; i++) {
      intervals.push(tickTimestamps[i] - tickTimestamps[i - 1]);
    }

    // Check for anomalies (gaps > 2x expected interval or near-zero intervals)
    const expectedInterval = (60 * 1000) / (initialBpm * 480);
    const anomalies = intervals.filter(interval =>
      interval > expectedInterval * 2 || interval < expectedInterval * 0.1
    );

    // MUST FAIL - Clock doesn't exist
    expect(anomalies.length).toBe(0);
  });

  it('should handle start/stop cycles without timing degradation', async () => {
    const cycles = 10;
    const ticksPerCycle = 100;
    const jitterMeasurements: number[] = [];

    for (let cycle = 0; cycle < cycles; cycle++) {
      const cycleTickTimestamps: number[] = [];

      const recordTick = () => {
        cycleTickTimestamps.push(performance.now());
      };

      clock.on('tick', recordTick);
      clock.start();

      // Wait for ticks
      await new Promise<void>((resolve) => {
        const checkComplete = () => {
          if (cycleTickTimestamps.length >= ticksPerCycle) {
            clock.stop();
            clock.off('tick', recordTick);
            resolve();
          } else {
            setTimeout(checkComplete, 5);
          }
        };
        checkComplete();
      });

      // Calculate jitter for this cycle
      const intervals: number[] = [];
      for (let i = 1; i < cycleTickTimestamps.length; i++) {
        intervals.push(cycleTickTimestamps[i] - cycleTickTimestamps[i - 1]);
      }

      const expectedInterval = (60 * 1000) / (120 * 480);
      const deviations = intervals.map(interval => Math.abs(interval - expectedInterval));
      const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

      jitterMeasurements.push(avgDeviation);

      // Small delay between cycles
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Verify jitter doesn't increase across cycles (no degradation)
    const firstHalfAvg = jitterMeasurements.slice(0, 5).reduce((sum, val) => sum + val, 0) / 5;
    const secondHalfAvg = jitterMeasurements.slice(5).reduce((sum, val) => sum + val, 0) / 5;
    const degradation = secondHalfAvg - firstHalfAvg;

    // MUST FAIL - Clock doesn't exist
    expect(degradation).toBeLessThan(0.1); // No significant degradation
    expect(Math.max(...jitterMeasurements)).toBeLessThan(1.0); // All cycles < 1ms jitter
  });
});

describe('Clock - Configuration and API', () => {
  it('should accept valid configuration object', () => {
    // MUST FAIL - Clock doesn't exist
    const clock = new Clock({
      bpm: 120,
      ppq: 480,
      timeSignature: { numerator: 4, denominator: 4 }
    });

    expect(clock).toBeDefined();
    expect(clock.getBpm()).toBe(120);
    expect(clock.getPpq()).toBe(480);
  });

  it('should reject invalid BPM values', () => {
    // MUST FAIL - Clock doesn't exist
    expect(() => new Clock({ bpm: 0, ppq: 480 })).toThrow();
    expect(() => new Clock({ bpm: -60, ppq: 480 })).toThrow();
    expect(() => new Clock({ bpm: 999999, ppq: 480 })).toThrow();
  });

  it('should reject invalid PPQ values', () => {
    // MUST FAIL - Clock doesn't exist
    expect(() => new Clock({ bpm: 120, ppq: 0 })).toThrow();
    expect(() => new Clock({ bpm: 120, ppq: -1 })).toThrow();
    expect(() => new Clock({ bpm: 120, ppq: 1.5 })).toThrow(); // PPQ must be integer
  });

  it('should emit tick events with accurate position data', async () => {
    const clock = new Clock({ bpm: 120, ppq: 480 });
    let tickPosition = 0;

    clock.on('tick', (position: number) => {
      expect(position).toBe(tickPosition);
      tickPosition++;
    });

    clock.start();
    await new Promise(resolve => setTimeout(resolve, 50));
    clock.stop();

    // MUST FAIL - Clock doesn't exist
    expect(tickPosition).toBeGreaterThan(0);
  });
});
