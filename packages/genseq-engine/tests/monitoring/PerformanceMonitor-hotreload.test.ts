import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '../../src/monitoring/PerformanceMonitor';

/**
 * T054: Hot-reload performance metric tests
 *
 * Verifies that PerformanceMonitor correctly tracks hot-reload latency
 * and emits warnings when the 50ms threshold is exceeded.
 */

describe('PerformanceMonitor - Hot-Reload Metrics', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it('should record hot-reload latency in metrics', () => {
    monitor.recordHotReload(25.5);

    const metrics = monitor.getMetrics();
    expect(metrics.hotReloadLatency).toBe(25.5);
  });

  it('should update hot-reload latency on subsequent calls', () => {
    monitor.recordHotReload(30.0);
    monitor.recordHotReload(45.2);

    const metrics = monitor.getMetrics();
    expect(metrics.hotReloadLatency).toBe(45.2);
  });

  it('should not emit warning when hot-reload is under 50ms threshold', async () => {
    let warningEmitted = false;

    monitor.on('warning', () => {
      warningEmitted = true;
    });

    monitor.recordHotReload(35.0);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(warningEmitted).toBe(false);
  });

  it('should emit warning when hot-reload exceeds 50ms threshold', () => {
    return new Promise<void>((resolve) => {
      monitor.on('warning', (warning) => {
        expect(warning.type).toBe('hotReloadLatency');
        expect(warning.value).toBe(75.5);
        expect(warning.threshold).toBe(50.0);
        expect(warning.message).toContain('Hot-reload exceeded 50ms threshold');
        expect(warning.message).toContain('75.5ms');
        resolve();
      });

      monitor.recordHotReload(75.5);
    });
  });

  it('should emit warning at exactly 50.1ms (edge case)', () => {
    return new Promise<void>((resolve) => {
      monitor.on('warning', (warning) => {
        expect(warning.type).toBe('hotReloadLatency');
        expect(warning.value).toBe(50.1);
        resolve();
      });

      monitor.recordHotReload(50.1);
    });
  });

  it('should not emit warning at exactly 50.0ms (boundary)', async () => {
    let warningEmitted = false;

    monitor.on('warning', () => {
      warningEmitted = true;
    });

    monitor.recordHotReload(50.0);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(warningEmitted).toBe(false);
  });

  it('should format warning message with 1 decimal place', () => {
    return new Promise<void>((resolve) => {
      monitor.on('warning', (warning) => {
        expect(warning.message).toContain('125.7ms');
        expect(warning.message).not.toContain('125.67');
        resolve();
      });

      monitor.recordHotReload(125.678);
    });
  });

  it('should not initialize hotReloadLatency in metrics until first call', () => {
    const metrics = monitor.getMetrics();
    expect(metrics.hotReloadLatency).toBeUndefined();
  });

  it('should persist hotReloadLatency after reset is not called', () => {
    monitor.recordHotReload(42.0);

    const metrics = monitor.getMetrics();
    expect(metrics.hotReloadLatency).toBe(42.0);
  });

  it('should clear hotReloadLatency after reset', () => {
    monitor.recordHotReload(42.0);
    monitor.reset();

    const metrics = monitor.getMetrics();
    expect(metrics.hotReloadLatency).toBeUndefined();
  });
});
