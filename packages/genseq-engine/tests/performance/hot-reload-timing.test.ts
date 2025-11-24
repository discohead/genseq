import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HotReloadCoordinator } from '../../src/config/HotReloadCoordinator';
import { ConfigurationManager } from '../../src/config/ConfigurationManager';
import { FileWatcher } from '../../src/config/FileWatcher';
import { SchemaValidator } from '../../src/config/SchemaValidator';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { Clock } from '../../src/clock/Clock';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T045: Hot-reload performance timing test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * All classes do not exist yet - implementation after Red phase.
 *
 * Performance Requirements:
 * - Total reload time: <50ms (file change → active config)
 * - Debounce: 30ms
 * - Validation: <10ms
 * - Swap: <5ms
 * - No dropped events during reload
 */

describe('Hot-Reload - Performance Timing', () => {
  let coordinator: HotReloadCoordinator;
  let configManager: ConfigurationManager;
  let fileWatcher: FileWatcher;
  let validator: SchemaValidator;
  let engine: GenSeqEngine;
  let clock: Clock;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-perf-'));

    // MUST FAIL - Classes don't exist
    clock = new Clock({ bpm: 120, ppq: 480 });
    validator = new SchemaValidator();
    configManager = new ConfigurationManager({ validator });
    fileWatcher = new FileWatcher({ debounceMs: 30 });
    engine = new GenSeqEngine({ clock, configManager });

    coordinator = new HotReloadCoordinator({
      engine,
      configManager,
      fileWatcher,
      validator
    });
  });

  afterEach(async () => {
    await coordinator?.dispose();
    await fileWatcher?.dispose();
    await engine?.stop();
    clock?.stop();

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should complete full hot-reload cycle in <50ms', async () => {
    const configPath = path.join(tempDir, 'perf-test.json');

    const initialConfig = {
      bpm: 120,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16, pulses: 4 }
      ]
    };

    const updatedConfig = {
      bpm: 140,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16, pulses: 4 },
        { id: 'pat2', steps: 8, pulses: 3 }
      ]
    };

    await fs.writeFile(configPath, JSON.stringify(initialConfig));
    await coordinator.loadConfig(configPath);

    let fileChangeTimestamp = 0;
    let swapCompleteTimestamp = 0;

    coordinator.on('fileChanged', () => {
      fileChangeTimestamp = performance.now();
    });

    coordinator.on('configSwapped', () => {
      swapCompleteTimestamp = performance.now();
    });

    await engine.start();

    // Wait for engine to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Trigger config change
    const changeStartTime = performance.now();
    await fs.writeFile(configPath, JSON.stringify(updatedConfig));

    // Wait for hot-reload to complete
    await new Promise<void>(resolve => {
      const checkComplete = setInterval(() => {
        if (swapCompleteTimestamp > 0) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 5);

      // Timeout after 200ms
      setTimeout(() => {
        clearInterval(checkComplete);
        resolve();
      }, 200);
    });

    const totalTime = swapCompleteTimestamp - fileChangeTimestamp;

    // MUST FAIL - Classes don't exist
    expect(fileChangeTimestamp).toBeGreaterThan(0);
    expect(swapCompleteTimestamp).toBeGreaterThan(0);
    expect(totalTime).toBeLessThan(50); // Total time < 50ms
    expect(totalTime).toBeGreaterThan(0);
  });

  it('should measure debounce timing separately (<30ms)', async () => {
    const configPath = path.join(tempDir, 'debounce-timing.json');

    await fs.writeFile(configPath, JSON.stringify({ bpm: 120 }));

    let fileChangeDetectedTimestamp = 0;
    let debounceCompleteTimestamp = 0;

    fileWatcher.on('change', () => {
      fileChangeDetectedTimestamp = performance.now();
    });

    coordinator.on('debounceComplete', () => {
      debounceCompleteTimestamp = performance.now();
    });

    await fileWatcher.watch(configPath);

    // Wait for watch setup
    await new Promise(resolve => setTimeout(resolve, 50));

    // Trigger file change
    await fs.writeFile(configPath, JSON.stringify({ bpm: 140 }));

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 100));

    const debounceTime = debounceCompleteTimestamp - fileChangeDetectedTimestamp;

    // MUST FAIL - Classes don't exist
    expect(debounceTime).toBeGreaterThan(25); // ~30ms debounce
    expect(debounceTime).toBeLessThan(40);    // Not too slow
  });

  it('should measure validation timing separately (<10ms)', async () => {
    const schema = {
      type: 'object',
      required: ['bpm', 'ppq'],
      properties: {
        bpm: { type: 'number', minimum: 20, maximum: 300 },
        ppq: { type: 'number', enum: [96, 192, 480, 960] },
        patterns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'steps'],
            properties: {
              id: { type: 'string' },
              steps: { type: 'number' },
              pulses: { type: 'number' }
            }
          }
        }
      }
    };

    const validConfig = {
      bpm: 120,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16, pulses: 4 },
        { id: 'pat2', steps: 8, pulses: 3 },
        { id: 'pat3', steps: 12, pulses: 5 }
      ]
    };

    validator.setSchema(schema);

    // Warm up validator
    await validator.validate(validConfig);

    // Measure validation time
    const startTime = performance.now();
    const isValid = await validator.validate(validConfig);
    const validationTime = performance.now() - startTime;

    // MUST FAIL - SchemaValidator doesn't exist
    expect(isValid).toBe(true);
    expect(validationTime).toBeLessThan(10); // <10ms validation
  });

  it('should measure config swap timing separately (<5ms)', async () => {
    const config1 = {
      bpm: 120,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16 }
      ]
    };

    const config2 = {
      bpm: 140,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16 },
        { id: 'pat2', steps: 8 }
      ]
    };

    configManager.setActive(config1);
    await configManager.loadPending(config2);

    // Measure swap time
    const startTime = performance.now();
    await configManager.swap();
    const swapTime = performance.now() - startTime;

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(configManager.getActive()).toEqual(config2);
    expect(swapTime).toBeLessThan(5); // <5ms swap time
  });

  it('should break down complete hot-reload into phases', async () => {
    const configPath = path.join(tempDir, 'phases.json');

    const initialConfig = { bpm: 120, patterns: [] };
    const updatedConfig = { bpm: 140, patterns: [{ id: 'p1', steps: 16 }] };

    await fs.writeFile(configPath, JSON.stringify(initialConfig));
    await coordinator.loadConfig(configPath);

    const phaseTimings: Record<string, number> = {
      fileChange: 0,
      debounceStart: 0,
      debounceEnd: 0,
      validationStart: 0,
      validationEnd: 0,
      swapStart: 0,
      swapEnd: 0
    };

    coordinator.on('fileChanged', () => {
      phaseTimings.fileChange = performance.now();
    });

    coordinator.on('debounceStarted', () => {
      phaseTimings.debounceStart = performance.now();
    });

    coordinator.on('debounceComplete', () => {
      phaseTimings.debounceEnd = performance.now();
    });

    coordinator.on('validationStarted', () => {
      phaseTimings.validationStart = performance.now();
    });

    coordinator.on('validationComplete', () => {
      phaseTimings.validationEnd = performance.now();
    });

    coordinator.on('swapExecuting', () => {
      phaseTimings.swapStart = performance.now();
    });

    coordinator.on('configSwapped', () => {
      phaseTimings.swapEnd = performance.now();
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Trigger change
    await fs.writeFile(configPath, JSON.stringify(updatedConfig));

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 200));

    // Calculate phase durations
    const debounceTime = phaseTimings.debounceEnd - phaseTimings.debounceStart;
    const validationTime = phaseTimings.validationEnd - phaseTimings.validationStart;
    const swapTime = phaseTimings.swapEnd - phaseTimings.swapStart;
    const totalTime = phaseTimings.swapEnd - phaseTimings.fileChange;

    // MUST FAIL - Classes don't exist
    expect(debounceTime).toBeLessThan(35);     // ~30ms debounce
    expect(validationTime).toBeLessThan(10);   // <10ms validation
    expect(swapTime).toBeLessThan(5);          // <5ms swap
    expect(totalTime).toBeLessThan(50);        // <50ms total

    // Verify phases occurred in order
    expect(phaseTimings.debounceStart).toBeGreaterThan(phaseTimings.fileChange);
    expect(phaseTimings.validationStart).toBeGreaterThan(phaseTimings.debounceEnd);
    expect(phaseTimings.swapStart).toBeGreaterThan(phaseTimings.validationEnd);
  });

  it('should not drop events during hot-reload (<50ms window)', async () => {
    const configPath = path.join(tempDir, 'no-drop.json');

    const config = {
      bpm: 120,
      patterns: [
        { id: 'p1', steps: 4, type: 'euclidean', pulses: 4, note: 60 }
      ]
    };

    await fs.writeFile(configPath, JSON.stringify(config));
    await coordinator.loadConfig(configPath);

    const eventTimestamps: number[] = [];

    engine.on('midiOut', (event: any) => {
      if (event.type === 'noteOn') {
        eventTimestamps.push(performance.now());
      }
    });

    await engine.start();

    // Collect baseline events
    await new Promise(resolve => setTimeout(resolve, 500));

    const baselineEventCount = eventTimestamps.length;

    // Trigger hot-reload
    config.patterns[0].pulses = 3;
    await fs.writeFile(configPath, JSON.stringify(config));

    // Continue collecting through reload
    await new Promise(resolve => setTimeout(resolve, 500));

    const allEvents = eventTimestamps.length;
    const eventsAfterReload = allEvents - baselineEventCount;

    // Calculate event intervals
    const intervals: number[] = [];
    for (let i = 1; i < eventTimestamps.length; i++) {
      intervals.push(eventTimestamps[i] - eventTimestamps[i - 1]);
    }

    // Check for timing gaps (dropped events)
    const expectedInterval = 250; // ~4 events/second at 120 BPM
    const gaps = intervals.filter(interval => interval > expectedInterval * 2);

    // MUST FAIL - Classes don't exist
    expect(gaps.length).toBe(0); // No large gaps
    expect(eventsAfterReload).toBeGreaterThan(0);
  });

  it('should maintain performance under high event load', async () => {
    const configPath = path.join(tempDir, 'high-load.json');

    // Create config with many patterns (high event load)
    const initialConfig = {
      bpm: 120,
      ppq: 480,
      patterns: Array.from({ length: 20 }, (_, i) => ({
        id: `pat${i}`,
        steps: 16,
        pulses: 4,
        note: 60 + i
      }))
    };

    const updatedConfig = {
      ...initialConfig,
      bpm: 140 // Change BPM under load
    };

    await fs.writeFile(configPath, JSON.stringify(initialConfig));
    await coordinator.loadConfig(configPath);

    let reloadStartTime = 0;
    let reloadEndTime = 0;

    coordinator.on('fileChanged', () => {
      reloadStartTime = performance.now();
    });

    coordinator.on('configSwapped', () => {
      reloadEndTime = performance.now();
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Trigger reload under load
    await fs.writeFile(configPath, JSON.stringify(updatedConfig));

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 200));

    const reloadTime = reloadEndTime - reloadStartTime;

    // MUST FAIL - Classes don't exist
    // Performance should remain <50ms even under high load
    expect(reloadTime).toBeLessThan(50);
    expect(engine.getActiveConfig().bpm).toBe(140);
  });

  it('should measure memory allocation during hot-reload', async () => {
    const configPath = path.join(tempDir, 'memory.json');

    const config1 = { bpm: 120, patterns: [{ id: 'p1', steps: 16 }] };
    const config2 = { bpm: 140, patterns: [{ id: 'p2', steps: 8 }] };

    await fs.writeFile(configPath, JSON.stringify(config1));
    await coordinator.loadConfig(configPath);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage().heapUsed;

    // Perform multiple hot-reloads
    for (let i = 0; i < 10; i++) {
      const config = i % 2 === 0 ? config2 : config1;
      await fs.writeFile(configPath, JSON.stringify(config));
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (global.gc) {
      global.gc();
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memGrowth = memAfter - memBefore;
    const memGrowthMB = memGrowth / 1024 / 1024;

    // MUST FAIL - Classes don't exist
    // Should not leak significant memory across reloads
    expect(memGrowthMB).toBeLessThan(10); // <10MB growth for 10 reloads
  });

  it('should benchmark hot-reload performance across 100 iterations', async () => {
    const configPath = path.join(tempDir, 'benchmark.json');

    const configs = [
      { bpm: 120, patterns: [{ id: 'p1', steps: 16 }] },
      { bpm: 130, patterns: [{ id: 'p2', steps: 8 }] },
      { bpm: 140, patterns: [{ id: 'p3', steps: 12 }] }
    ];

    await fs.writeFile(configPath, JSON.stringify(configs[0]));
    await coordinator.loadConfig(configPath);

    const reloadTimes: number[] = [];

    coordinator.on('performanceMetrics', (metrics: any) => {
      reloadTimes.push(metrics.reloadTime);
    });

    await engine.start();

    // Perform 100 hot-reloads
    for (let i = 0; i < 100; i++) {
      const config = configs[i % configs.length];
      await fs.writeFile(configPath, JSON.stringify(config));
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate statistics
    const avgReloadTime = reloadTimes.reduce((sum, t) => sum + t, 0) / reloadTimes.length;
    const maxReloadTime = Math.max(...reloadTimes);
    const minReloadTime = Math.min(...reloadTimes);
    const p95ReloadTime = reloadTimes.sort((a, b) => a - b)[Math.floor(reloadTimes.length * 0.95)];

    // MUST FAIL - Classes don't exist
    expect(avgReloadTime).toBeLessThan(50);  // Average <50ms
    expect(maxReloadTime).toBeLessThan(100); // Max <100ms
    expect(p95ReloadTime).toBeLessThan(60);  // 95th percentile <60ms
    expect(reloadTimes.length).toBe(100);
  });
});
