import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

/**
 * T056: End-to-end hot-reload integration test
 *
 * Tests complete hot-reload flow:
 * 1. Load example project
 * 2. Start playback
 * 3. Edit pattern file
 * 4. Verify config:reloaded event fires
 * 5. Verify latency <50ms
 * 6. Verify transport still playing
 * 7. Verify pattern parameters updated
 */

describe('T056: HotReload End-to-End Integration', () => {
  let engine: GenSeqEngine;
  let tempProjectDir: string;
  let patternsDir: string;
  let routesDir: string;
  let clockFile: string;

  beforeEach(async () => {
    // Create temporary project directory
    tempProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    patternsDir = path.join(tempProjectDir, 'patterns');
    routesDir = path.join(tempProjectDir, 'routes');

    await fs.mkdir(patternsDir, { recursive: true });
    await fs.mkdir(routesDir, { recursive: true });

    // Create clock configuration
    clockFile = path.join(tempProjectDir, 'clock.yaml');
    await fs.writeFile(clockFile, yaml.dump({
      bpm: 120,
      ppq: 96,
      measure: 4
    }));

    // Create initial pattern
    const patternFile = path.join(patternsDir, 'kick.yaml');
    await fs.writeFile(patternFile, yaml.dump({
      id: 'kick',
      name: 'Kick Drum',
      type: 'euclidean',
      enabled: true,
      bus: 'drums',
      channel: 1,
      note: 36,
      length: 1,
      parameters: {
        steps: 16,
        pulses: 4,
        rotation: 0,
        velocity: 100,
        gateLength: 0.1
      }
    }));

    // Create route
    const routeFile = path.join(routesDir, 'drums.yaml');
    await fs.writeFile(routeFile, yaml.dump({
      id: 'drums',
      name: 'Drums Bus',
      bus: 'drums',
      device: 'IAC Driver GenSeq',
      enabled: true,
      channelMap: {
        1: 10
      }
    }));

    // Initialize engine with hot-reload enabled
    engine = new GenSeqEngine({
      enableHotReload: true,
      midi: { enableVirtualLoopback: true }
    });

    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();

    // Clean up temp directory
    await fs.rm(tempProjectDir, { recursive: true, force: true });
  });

  it('should hot-reload pattern changes during playback', async () => {
    // Load project
    await engine.loadProject(tempProjectDir);

    // Verify pattern loaded
    const patternIds = engine['patternExecutor'].getPatternIds();
    expect(patternIds).toContain('kick');

    // Start playback
    engine.start();
    expect(engine.isPlaying()).toBe(true);

    // Set up event listener for config:reloaded
    const reloadPromise = new Promise<any>((resolve) => {
      engine.once('config:reloaded', resolve);
    });

    // Set up listener for pattern update
    const patternUpdatePromise = new Promise<any>((resolve) => {
      engine.once('pattern:updated', resolve);
    });

    // Wait for clock to start (give it a tick)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Edit pattern file - change pulses from 4 to 8
    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;
    patternData.parameters.pulses = 8;
    patternData.parameters.velocity = 127;

    // Write updated pattern (this should trigger hot-reload)
    await fs.writeFile(patternFile, yaml.dump(patternData));

    // Wait for config:reloaded event (with timeout)
    const reloadEvent = await Promise.race([
      reloadPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Hot-reload timeout')), 5000)
      )
    ]);

    // Verify reload event
    expect(reloadEvent).toBeDefined();
    expect((reloadEvent as any).latencyMs).toBeDefined();
    expect((reloadEvent as any).latencyMs).toBeLessThan(50); // <50ms requirement

    // Wait for pattern update
    const patternUpdate = await Promise.race([
      patternUpdatePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pattern update timeout')), 5000)
      )
    ]);

    // Verify pattern update
    expect(patternUpdate).toBeDefined();
    expect((patternUpdate as any).id).toBe('kick');
    expect((patternUpdate as any).parameters.pulses).toBe(8);
    expect((patternUpdate as any).parameters.velocity).toBe(127);

    // Verify transport still playing (no interruption)
    expect(engine.isPlaying()).toBe(true);

    // Verify pattern parameters updated in executor
    const pattern = engine['patternExecutor'].getPattern('kick');
    expect(pattern).toBeDefined();
    expect(pattern!.parameters.pulses).toBe(8);
    expect(pattern!.parameters.velocity).toBe(127);
  });

  it('should queue multiple rapid changes and process them in order', async () => {
    await engine.loadProject(tempProjectDir);
    engine.start();

    const reloadEvents: any[] = [];
    engine.on('config:reloaded', (event) => reloadEvents.push(event));

    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;

    // Make rapid changes
    for (let i = 0; i < 3; i++) {
      patternData.parameters.pulses = 4 + i;
      await fs.writeFile(patternFile, yaml.dump(patternData));
      await new Promise(resolve => setTimeout(resolve, 20)); // Faster than debounce
    }

    // Wait for events to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should have received reload events (may be coalesced due to queuing)
    expect(reloadEvents.length).toBeGreaterThan(0);

    // Final pattern should have last value
    const pattern = engine['patternExecutor'].getPattern('kick');
    expect(pattern!.parameters.pulses).toBe(6); // 4 + 2 (last iteration)
  });

  it('should maintain transport continuity during config swap', async () => {
    await engine.loadProject(tempProjectDir);
    engine.start();

    const transportStops: any[] = [];
    engine.on('transport:stop', () => transportStops.push(true));

    // Edit pattern
    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;
    patternData.parameters.pulses = 8;
    await fs.writeFile(patternFile, yaml.dump(patternData));

    // Wait for reload
    await new Promise<void>((resolve) => {
      engine.once('config:reloaded', () => resolve());
    });

    // Verify no transport stops occurred
    expect(transportStops.length).toBe(0);
    expect(engine.isPlaying()).toBe(true);
  });

  it('should handle reload at bar boundary', async () => {
    await engine.loadProject(tempProjectDir);
    engine.start();

    const swapScheduledPromise = new Promise<any>((resolve) => {
      engine.once('config:swapScheduled', resolve);
    });

    const swapExecutingPromise = new Promise<void>((resolve) => {
      engine.once('config:swapExecuting', () => resolve());
    });

    // Edit pattern
    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;
    patternData.parameters.pulses = 8;
    await fs.writeFile(patternFile, yaml.dump(patternData));

    // Verify swap scheduled
    const scheduleEvent = await swapScheduledPromise;
    expect(scheduleEvent).toBeDefined();

    // Verify swap executes (should happen at bar boundary)
    await swapExecutingPromise;

    // Wait for completion
    await new Promise<void>((resolve) => {
      engine.once('config:reloaded', () => resolve());
    });
  });

  it('should emit lifecycle events in correct order', async () => {
    await engine.loadProject(tempProjectDir);
    engine.start();

    const events: string[] = [];

    engine.on('config:changing', () => events.push('changing'));
    engine.on('config:swapScheduled', () => events.push('scheduled'));
    engine.on('config:swapExecuting', () => events.push('executing'));
    engine.on('config:reloaded', () => events.push('reloaded'));

    // Edit pattern
    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;
    patternData.parameters.pulses = 8;
    await fs.writeFile(patternFile, yaml.dump(patternData));

    // Wait for reload
    await new Promise<void>((resolve) => {
      engine.once('config:reloaded', () => resolve());
    });

    // Verify event order
    expect(events).toEqual(['changing', 'scheduled', 'executing', 'reloaded']);
  });

  it('should handle pattern regeneration at cycle boundary', async () => {
    await engine.loadProject(tempProjectDir);
    engine.start();

    const regeneratedPromise = new Promise<any>((resolve) => {
      engine.once('pattern:regenerated', resolve);
    });

    // Edit pattern
    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;
    patternData.parameters.pulses = 8;
    await fs.writeFile(patternFile, yaml.dump(patternData));

    // Wait for pattern regeneration (happens at cycle boundary)
    const regenEvent = await Promise.race([
      regeneratedPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pattern regeneration timeout')), 6000)
      )
    ]);

    expect(regenEvent).toBeDefined();
    expect((regenEvent as any).id).toBe('kick');
    expect((regenEvent as any).parameters.pulses).toBe(8);
  });

  it('should measure reload latency accurately', async () => {
    await engine.loadProject(tempProjectDir);
    engine.start();

    const reloadPromise = new Promise<any>((resolve) => {
      engine.once('config:reloaded', resolve);
    });

    const startTime = performance.now();

    // Edit pattern
    const patternFile = path.join(patternsDir, 'kick.yaml');
    const patternData = yaml.load(await fs.readFile(patternFile, 'utf-8')) as any;
    patternData.parameters.pulses = 8;
    await fs.writeFile(patternFile, yaml.dump(patternData));

    const reloadEvent = await reloadPromise;
    const endTime = performance.now();

    const actualLatency = endTime - startTime;

    // Verify reported latency is reasonable
    expect((reloadEvent as any).latencyMs).toBeDefined();
    expect((reloadEvent as any).latencyMs).toBeGreaterThan(0);
    expect((reloadEvent as any).latencyMs).toBeLessThan(50);

    // Actual latency should be somewhat close (within 2 bars at 120 BPM = ~4 seconds)
    expect(actualLatency).toBeLessThan(5000);
  });
});
