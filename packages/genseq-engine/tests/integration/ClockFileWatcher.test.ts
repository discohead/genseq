import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../../src/clock/Clock';
import { ClockFileWatcher } from '../../src/hotreload/ClockFileWatcher';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ClockFileWatcher - BPM Hot-Reload', () => {
  let clock: Clock;
  let watcher: ClockFileWatcher;
  let tempDir: string;
  let clockFilePath: string;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-clock-test-'));
    clockFilePath = path.join(tempDir, 'clock.yaml');

    // Create initial clock file
    await fs.writeFile(clockFilePath, 'bpm: 120\nppq: 96\n');

    // Initialize clock
    clock = new Clock({ bpm: 120, ppq: 96 });
  });

  afterEach(async () => {
    // Cleanup
    if (watcher) {
      await watcher.dispose();
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect clock file changes', async () => {
    const changeHandler = vi.fn();

    watcher = new ClockFileWatcher({
      clock,
      clockFilePath,
      swapAtBarBoundary: true
    });

    watcher.on('clockFileChanged', changeHandler);

    await watcher.start();

    // Modify clock file
    await fs.writeFile(clockFilePath, 'bpm: 140\nppq: 96\n');

    // Wait for file watcher debounce + processing
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(changeHandler).toHaveBeenCalled();
    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        file: clockFilePath,
        bpm: 140
      })
    );
  });

  it('should schedule BPM change for next bar boundary when playing', async () => {
    const scheduledHandler = vi.fn();
    const changedHandler = vi.fn();

    watcher = new ClockFileWatcher({
      clock,
      clockFilePath,
      swapAtBarBoundary: true
    });

    watcher.on('config:swapScheduled', scheduledHandler);
    clock.on('bpm:changed', changedHandler);

    await watcher.start();
    clock.start();

    // Modify clock file
    await fs.writeFile(clockFilePath, 'bpm: 140\nppq: 96\n');

    // Wait for file change detection
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(scheduledHandler).toHaveBeenCalled();
    expect(scheduledHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 120,
        to: 140,
        appliesAt: 'next bar boundary'
      })
    );

    // Wait for bar boundary (at 120 BPM, 4/4 time, 96 PPQ: ~2s per bar)
    // Use shorter timeout for test
    await new Promise(resolve => setTimeout(resolve, 2500));

    expect(changedHandler).toHaveBeenCalledWith(140);
    expect(clock.getBpm()).toBe(140);

    clock.stop();
  });

  it('should apply BPM change immediately when stopped', async () => {
    const changedHandler = vi.fn();

    watcher = new ClockFileWatcher({
      clock,
      clockFilePath,
      swapAtBarBoundary: true
    });

    clock.on('bpm:changed', changedHandler);

    await watcher.start();
    // Clock is stopped

    // Modify clock file
    await fs.writeFile(clockFilePath, 'bpm: 140\nppq: 96\n');

    // Wait for file change detection and application
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(changedHandler).toHaveBeenCalledWith(140);
    expect(clock.getBpm()).toBe(140);
  });

  it('should emit validation errors for invalid BPM values', async () => {
    const errorHandler = vi.fn();

    watcher = new ClockFileWatcher({
      clock,
      clockFilePath,
      swapAtBarBoundary: true
    });

    watcher.on('config:error', errorHandler);

    await watcher.start();

    // Write invalid BPM
    await fs.writeFile(clockFilePath, 'bpm: -10\nppq: 96\n');

    // Wait for file change detection
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.anything(),
        details: expect.objectContaining({
          file: clockFilePath
        })
      })
    );

    // BPM should remain unchanged
    expect(clock.getBpm()).toBe(120);
  });

  it('should emit reloaded event with latency metrics', async () => {
    const reloadedHandler = vi.fn();

    watcher = new ClockFileWatcher({
      clock,
      clockFilePath,
      swapAtBarBoundary: true
    });

    watcher.on('config:reloaded', reloadedHandler);

    await watcher.start();
    // Clock is stopped (immediate application)

    // Modify clock file
    await fs.writeFile(clockFilePath, 'bpm: 140\nppq: 96\n');

    // Wait for file change detection and application
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(reloadedHandler).toHaveBeenCalled();
    expect(reloadedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        latencyMs: expect.any(Number),
        filesChanged: 1,
        timestamp: expect.any(Number),
        bpm: 140
      })
    );

    const latency = reloadedHandler.mock.calls[0][0].latencyMs;
    expect(latency).toBeGreaterThan(0);
    expect(latency).toBeLessThan(200); // Should be fast
  });

  it('should maintain transport continuity during BPM changes', async () => {
    watcher = new ClockFileWatcher({
      clock,
      clockFilePath,
      swapAtBarBoundary: true
    });

    await watcher.start();
    clock.start();

    const initialPosition = clock.getPosition();

    // Modify clock file
    await fs.writeFile(clockFilePath, 'bpm: 140\nppq: 96\n');

    // Wait for some ticks
    await new Promise(resolve => setTimeout(resolve, 500));

    const midPosition = clock.getPosition();

    // Position should have advanced (clock is still running)
    expect(midPosition.bar).toBeGreaterThanOrEqual(initialPosition.bar);

    // Wait for BPM change to apply at bar boundary
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalPosition = clock.getPosition();

    // Clock should still be running
    expect(clock.isPlaying()).toBe(true);
    expect(finalPosition.bar).toBeGreaterThan(midPosition.bar);

    clock.stop();
  });
});
