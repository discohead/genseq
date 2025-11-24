import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GenSeqEngine } from '../src/GenSeqEngine';
import { Clock } from '../src/clock/Clock';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T053: GenSeqEngine hot-reload event forwarding tests
 *
 * Verifies that GenSeqEngine correctly forwards hot-reload events
 * from HotReloadCoordinator to GenSeqEngine listeners.
 */
describe('GenSeqEngine - Hot-Reload Event Forwarding (T053)', () => {
  let engine: GenSeqEngine;
  let clock: Clock;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create temporary directory for test configs
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    configPath = path.join(tempDir, 'test-config.json');

    // Create initial config file
    await fs.writeFile(configPath, JSON.stringify({
      bpm: 120,
      ppq: 96
    }));

    // Initialize engine with hot-reload enabled
    clock = new Clock({ bpm: 120, ppq: 96 });
    engine = new GenSeqEngine({
      clock,
      midi: { enableVirtualLoopback: true },
      enableHotReload: true
    });

    await engine.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await engine.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should emit config:reloaded event when configuration is reloaded successfully', async () => {
    const reloadedHandler = vi.fn();
    engine.on('config:reloaded', reloadedHandler);

    // Load config via HotReloadCoordinator
    const coordinator = (engine as any).hotReloadCoordinator;
    expect(coordinator).toBeDefined();

    await coordinator.loadConfig(configPath);

    // Modify config
    await fs.writeFile(configPath, JSON.stringify({
      bpm: 140,
      ppq: 96
    }));

    // Trigger reload with immediate swap
    await coordinator.reloadConfig(configPath, { immediate: true });

    // Wait for event
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify event was emitted
    expect(reloadedHandler).toHaveBeenCalled();

    const eventData = reloadedHandler.mock.calls[0][0];
    expect(eventData).toHaveProperty('timestamp');
    expect(eventData).toHaveProperty('latencyMs');
    expect(eventData).toHaveProperty('filesChanged');
    expect(typeof eventData.timestamp).toBe('number');
    expect(typeof eventData.latencyMs).toBe('number');
    expect(Array.isArray(eventData.filesChanged)).toBe(true);
  });

  it('should emit config:error event when validation fails', async () => {
    const errorHandler = vi.fn();
    engine.on('config:error', errorHandler);

    const coordinator = (engine as any).hotReloadCoordinator;
    expect(coordinator).toBeDefined();

    await coordinator.loadConfig(configPath);

    // Create invalid config with batch processing (don't use immediate)
    await fs.writeFile(configPath, JSON.stringify({
      bpm: -1, // Invalid BPM
      ppq: 96
    }));

    // Trigger file change event (simulates file watcher)
    await (coordinator as any).onFileChange(configPath);

    // Wait for batch processing and event
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify error event was emitted
    expect(errorHandler).toHaveBeenCalled();

    const eventData = errorHandler.mock.calls[0][0];
    expect(eventData).toHaveProperty('timestamp');
    expect(eventData).toHaveProperty('error');
    expect(typeof eventData.timestamp).toBe('number');
    expect(typeof eventData.error).toBe('string');
  });

  it('should include latency in config:reloaded events', async () => {
    const reloadedHandler = vi.fn();
    engine.on('config:reloaded', reloadedHandler);

    const coordinator = (engine as any).hotReloadCoordinator;
    await coordinator.loadConfig(configPath);

    // Modify config
    await fs.writeFile(configPath, JSON.stringify({
      bpm: 130,
      ppq: 96
    }));

    // Trigger reload
    await coordinator.reloadConfig(configPath, { immediate: true });

    // Wait for event
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify latency is present and reasonable
    expect(reloadedHandler).toHaveBeenCalled();
    const eventData = reloadedHandler.mock.calls[0][0];
    expect(eventData.latencyMs).toBeGreaterThanOrEqual(0);
    expect(eventData.latencyMs).toBeLessThan(100); // Should be <50ms typically
  });

  it('should forward HotReloadCoordinator errors to engine error event', async () => {
    const errorHandler = vi.fn();
    engine.on('error', errorHandler);

    const coordinator = (engine as any).hotReloadCoordinator;

    // Trigger an error by emitting it directly from coordinator
    coordinator.emit('error', new Error('Test error'));

    // Wait for event propagation
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify error was forwarded
    const errorEvents = errorHandler.mock.calls.filter(
      call => call[0]?.source === 'hotReloadCoordinator'
    );
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0][0].error.message).toBe('Test error');
  });

  it('should not create HotReloadCoordinator when enableHotReload is false', async () => {
    // Create new engine with hot-reload disabled
    const engineNoHotReload = new GenSeqEngine({
      clock: new Clock({ bpm: 120, ppq: 96 }),
      midi: { enableVirtualLoopback: true },
      enableHotReload: false
    });

    await engineNoHotReload.initialize();

    // Verify HotReloadCoordinator was not created
    const coordinator = (engineNoHotReload as any).hotReloadCoordinator;
    expect(coordinator).toBeUndefined();

    await engineNoHotReload.shutdown();
  });
});
