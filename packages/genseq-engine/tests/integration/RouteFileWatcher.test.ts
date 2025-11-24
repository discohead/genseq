import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../../src/clock/Clock';
import { RouteFileWatcher } from '../../src/hotreload/RouteFileWatcher';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('RouteFileWatcher - Device Hot-Reload', () => {
  let clock: Clock;
  let watcher: RouteFileWatcher;
  let tempDir: string;
  let routesPath: string;
  let routeFilePath: string;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-route-test-'));
    routesPath = path.join(tempDir, 'routes');
    await fs.mkdir(routesPath);
    routeFilePath = path.join(routesPath, 'drums.json');

    // Create initial route file
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        id: 'drums',
        bus: 'drums',
        device: 'output_0',
        channel: 10,
        enabled: true
      }, null, 2)
    );

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

  it('should detect route file changes', async () => {
    const changeHandler = vi.fn();

    watcher = new RouteFileWatcher({
      clock,
      routesPath,
      swapAtBarBoundary: true
    });

    // Register initial device
    watcher.registerRoute('drums', 'output_0');

    watcher.on('routeFileChanged', changeHandler);

    await watcher.start();

    // Modify route file (channel change)
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        id: 'drums',
        bus: 'drums',
        device: 'output_0',
        channel: 12,
        enabled: true
      }, null, 2)
    );

    // Wait for file watcher debounce + processing
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(changeHandler).toHaveBeenCalled();
    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        file: routeFilePath,
        routeId: 'drums',
        deviceChanged: false
      })
    );
  });

  it('should detect device changes', async () => {
    const deviceReconnectHandler = vi.fn();

    watcher = new RouteFileWatcher({
      clock,
      routesPath,
      swapAtBarBoundary: true
    });

    // Register initial device
    watcher.registerRoute('drums', 'output_0');

    watcher.on('deviceReconnectNeeded', deviceReconnectHandler);

    await watcher.start();

    // Modify route file (device change)
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        id: 'drums',
        bus: 'drums',
        device: 'output_1', // Changed device
        channel: 10,
        enabled: true
      }, null, 2)
    );

    // Wait for file watcher debounce + processing
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(deviceReconnectHandler).toHaveBeenCalled();
    expect(deviceReconnectHandler).toHaveBeenCalledWith({
      routeId: 'drums',
      oldDevice: 'output_0',
      newDevice: 'output_1'
    });
  });

  it('should schedule route update at bar boundary when playing', async () => {
    const scheduledHandler = vi.fn();

    watcher = new RouteFileWatcher({
      clock,
      routesPath,
      swapAtBarBoundary: true
    });

    // Register initial device
    watcher.registerRoute('drums', 'output_0');

    watcher.on('config:swapScheduled', scheduledHandler);

    await watcher.start();
    clock.start();

    // Modify route file
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        id: 'drums',
        bus: 'drums',
        device: 'output_0',
        channel: 12,
        enabled: true
      }, null, 2)
    );

    // Wait for file change detection
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(scheduledHandler).toHaveBeenCalled();
    expect(scheduledHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        file: routeFilePath,
        routeId: 'drums',
        scheduledFor: 'next bar boundary'
      })
    );

    clock.stop();
  });

  it('should apply route update at bar boundary', async () => {
    const updatedHandler = vi.fn();

    watcher = new RouteFileWatcher({
      clock,
      routesPath,
      swapAtBarBoundary: true
    });

    // Register initial device
    watcher.registerRoute('drums', 'output_0');

    watcher.on('routeUpdated', updatedHandler);

    await watcher.start();
    clock.start();

    // Modify route file
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        id: 'drums',
        bus: 'drums',
        device: 'output_0',
        channel: 12,
        enabled: true
      }, null, 2)
    );

    // Wait for file change detection
    await new Promise(resolve => setTimeout(resolve, 150));

    // Wait for bar boundary (at 120 BPM, 4/4 time, 96 PPQ: ~2s per bar)
    await new Promise(resolve => setTimeout(resolve, 2500));

    expect(updatedHandler).toHaveBeenCalled();
    expect(updatedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'drums'
      })
    );

    clock.stop();
  });

  it('should emit validation errors for invalid route files', async () => {
    const errorHandler = vi.fn();

    watcher = new RouteFileWatcher({
      clock,
      routesPath,
      swapAtBarBoundary: true
    });

    watcher.on('config:error', errorHandler);

    await watcher.start();

    // Write invalid route file
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        // Missing required fields
        id: 'drums'
      }, null, 2)
    );

    // Wait for file change detection
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.anything(),
        details: expect.objectContaining({
          file: routeFilePath
        })
      })
    );
  });

  it('should emit reloaded event with latency metrics', async () => {
    const reloadedHandler = vi.fn();

    watcher = new RouteFileWatcher({
      clock,
      routesPath,
      swapAtBarBoundary: true
    });

    // Register initial device
    watcher.registerRoute('drums', 'output_0');

    watcher.on('config:reloaded', reloadedHandler);

    await watcher.start();
    clock.start();

    // Modify route file
    await fs.writeFile(
      routeFilePath,
      JSON.stringify({
        id: 'drums',
        bus: 'drums',
        device: 'output_0',
        channel: 12,
        enabled: true
      }, null, 2)
    );

    // Wait for file change detection + bar boundary
    await new Promise(resolve => setTimeout(resolve, 2700));

    expect(reloadedHandler).toHaveBeenCalled();
    expect(reloadedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        latencyMs: expect.any(Number),
        filesChanged: 1,
        timestamp: expect.any(Number),
        routes: ['drums']
      })
    );

    const latency = reloadedHandler.mock.calls[0][0].latencyMs;
    expect(latency).toBeGreaterThan(0);
    expect(latency).toBeLessThan(3000); // Should be reasonably fast

    clock.stop();
  });
});
