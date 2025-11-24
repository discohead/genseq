import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadCoordinator } from '../../src/config/HotReloadCoordinator';
import { Clock } from '../../src/clock/Clock';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T044: HotReloadCoordinator bar-boundary test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * HotReloadCoordinator class does not exist yet - implementation after Red phase.
 *
 * Requirements:
 * - Config swap scheduled at bar boundary
 * - Transport continuity (no stop/start)
 * - Pattern parameter changes take effect immediately after swap
 * - No timing disruption during hot-reload
 */

describe('HotReloadCoordinator - Bar Boundary Swap', () => {
  let coordinator: HotReloadCoordinator;
  let clock: Clock;
  let engine: GenSeqEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));

    // MUST FAIL - Classes don't exist yet
    clock = new Clock({ bpm: 120, ppq: 480 });
    engine = new GenSeqEngine({ clock });

    coordinator = new HotReloadCoordinator({
      engine,
      clock,
      swapAtBarBoundary: true
    });
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.dispose();
    }
    if (engine) {
      await engine.stop();
    }
    if (clock) {
      clock.stop();
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should schedule config swap at next bar boundary', async () => {
    const configPath = path.join(tempDir, 'project.json');

    const initialConfig = {
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      patterns: [
        { id: 'pat1', steps: 16, notes: [60, 64, 67] }
      ]
    };

    const updatedConfig = {
      bpm: 140, // Changed BPM
      timeSignature: { numerator: 4, denominator: 4 },
      patterns: [
        { id: 'pat1', steps: 16, notes: [60, 64, 67] },
        { id: 'pat2', steps: 8, notes: [72, 76] } // Added pattern
      ]
    };

    await fs.writeFile(configPath, JSON.stringify(initialConfig));

    // Load initial config
    await coordinator.loadConfig(configPath);
    await engine.start();

    // Track current bar position
    let currentBar = 0;
    clock.on('bar', (barNumber: number) => {
      currentBar = barNumber;
    });

    // Wait until mid-bar (beat 2 of bar 1)
    await new Promise(resolve => setTimeout(resolve, 250)); // ~0.5 bars at 120 BPM

    const barBeforeChange = currentBar;

    // Trigger config change (should be pending)
    await fs.writeFile(configPath, JSON.stringify(updatedConfig));

    // Wait for file change detection and processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Config should still be old (swap pending)
    expect(engine.getActiveConfig().bpm).toBe(120);
    expect(engine.getActiveConfig().patterns.length).toBe(1);

    // Wait for bar boundary
    await new Promise(resolve => setTimeout(resolve, 700)); // Ensure we cross bar boundary

    const barAfterChange = currentBar;

    // Config should now be updated
    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(barAfterChange).toBeGreaterThan(barBeforeChange);
    expect(engine.getActiveConfig().bpm).toBe(140);
    expect(engine.getActiveConfig().patterns.length).toBe(2);
  });

  it('should maintain transport continuity during hot-reload (no stop/start)', async () => {
    const configPath = path.join(tempDir, 'transport.json');

    const config1 = { bpm: 120, patterns: [{ id: 'p1', steps: 16 }] };
    const config2 = { bpm: 130, patterns: [{ id: 'p2', steps: 8 }] };

    await fs.writeFile(configPath, JSON.stringify(config1));
    await coordinator.loadConfig(configPath);

    const transportEvents: Array<{ event: string; timestamp: number }> = [];

    engine.on('start', () => {
      transportEvents.push({ event: 'start', timestamp: performance.now() });
    });

    engine.on('stop', () => {
      transportEvents.push({ event: 'stop', timestamp: performance.now() });
    });

    engine.on('pause', () => {
      transportEvents.push({ event: 'pause', timestamp: performance.now() });
    });

    await engine.start();

    // Count initial start event
    const startEventsBefore = transportEvents.filter(e => e.event === 'start').length;

    // Wait for mid-bar
    await new Promise(resolve => setTimeout(resolve, 250));

    // Trigger hot-reload
    await fs.writeFile(configPath, JSON.stringify(config2));

    // Wait for bar boundary + reload
    await new Promise(resolve => setTimeout(resolve, 1000));

    // MUST FAIL - HotReloadCoordinator doesn't exist
    // Should have only 1 start event (no stop/start cycle)
    const startEventsAfter = transportEvents.filter(e => e.event === 'start').length;
    const stopEvents = transportEvents.filter(e => e.event === 'stop').length;

    expect(startEventsAfter).toBe(startEventsBefore); // No additional start
    expect(stopEvents).toBe(0); // No stops during reload
    expect(engine.isPlaying()).toBe(true); // Still playing
  });

  it('should apply pattern parameter changes immediately after swap', async () => {
    const configPath = path.join(tempDir, 'patterns.json');

    const initialConfig = {
      bpm: 120,
      patterns: [
        {
          id: 'euclidean1',
          type: 'euclidean',
          steps: 16,
          pulses: 4,
          rotation: 0,
          note: 60
        }
      ]
    };

    const updatedConfig = {
      bpm: 120,
      patterns: [
        {
          id: 'euclidean1',
          type: 'euclidean',
          steps: 16,
          pulses: 8, // Changed from 4 to 8
          rotation: 2, // Changed from 0 to 2
          note: 64   // Changed from 60 to 64
        }
      ]
    };

    await fs.writeFile(configPath, JSON.stringify(initialConfig));
    await coordinator.loadConfig(configPath);

    const midiEvents: Array<{ note: number; timestamp: number }> = [];

    engine.on('midiOut', (event: any) => {
      if (event.type === 'noteOn') {
        midiEvents.push({
          note: event.note,
          timestamp: performance.now()
        });
      }
    });

    await engine.start();

    // Collect MIDI events with initial config
    await new Promise(resolve => setTimeout(resolve, 500));

    const eventsBeforeSwap = midiEvents.length;
    const notesBefore = midiEvents.map(e => e.note);

    // Trigger config change
    await fs.writeFile(configPath, JSON.stringify(updatedConfig));

    // Wait for bar boundary + swap
    await new Promise(resolve => setTimeout(resolve, 600));

    // Collect MIDI events with updated config
    const eventsAfterSwap = midiEvents.slice(eventsBeforeSwap);
    const notesAfter = eventsAfterSwap.map(e => e.note);

    // MUST FAIL - HotReloadCoordinator doesn't exist
    // Notes should change from 60 to 64
    expect(notesBefore.every(n => n === 60)).toBe(true);
    expect(notesAfter.length).toBeGreaterThan(0);
    expect(notesAfter.every(n => n === 64)).toBe(true);

    // More pulses (8 vs 4) should generate more events
    const eventsPerSecondBefore = (eventsBeforeSwap / 0.5);
    const eventsPerSecondAfter = (eventsAfterSwap.length / 0.6);
    expect(eventsPerSecondAfter).toBeGreaterThan(eventsPerSecondBefore);
  });

  it('should handle immediate swap if already at bar boundary', async () => {
    const configPath = path.join(tempDir, 'immediate.json');

    const config1 = { bpm: 120, patterns: [{ id: 'p1', steps: 16 }] };
    const config2 = { bpm: 140, patterns: [{ id: 'p2', steps: 8 }] };

    await fs.writeFile(configPath, JSON.stringify(config1));
    await coordinator.loadConfig(configPath);

    let atBarBoundary = false;
    let swapTimestamp = 0;

    clock.on('bar', () => {
      atBarBoundary = true;
      setTimeout(() => { atBarBoundary = false; }, 10); // 10ms window
    });

    coordinator.on('configSwapped', () => {
      swapTimestamp = performance.now();
    });

    await engine.start();

    // Wait for next bar boundary
    await new Promise<void>(resolve => {
      const checkBar = setInterval(() => {
        if (atBarBoundary) {
          clearInterval(checkBar);
          resolve();
        }
      }, 5);
    });

    // Trigger change right at bar boundary
    await fs.writeFile(configPath, JSON.stringify(config2));

    // Should swap almost immediately (within debounce + processing time)
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(engine.getActiveConfig().bpm).toBe(140);
    expect(swapTimestamp).toBeGreaterThan(0);
  });

  it('should support forced immediate swap bypassing bar boundary', async () => {
    const configPath = path.join(tempDir, 'force-swap.json');

    const config1 = { bpm: 120, patterns: [{ id: 'p1', steps: 16 }] };
    const config2 = { bpm: 140, patterns: [{ id: 'p2', steps: 8 }] };

    await fs.writeFile(configPath, JSON.stringify(config1));
    await coordinator.loadConfig(configPath);
    await engine.start();

    // Wait until mid-bar
    await new Promise(resolve => setTimeout(resolve, 250));

    const bpmBefore = engine.getActiveConfig().bpm;

    // Write updated config to file
    await fs.writeFile(configPath, JSON.stringify(config2));

    // Trigger forced immediate swap (bypass bar boundary)
    await coordinator.reloadConfig(configPath, { immediate: true });

    // Should swap immediately, not wait for bar
    const bpmAfter = engine.getActiveConfig().bpm;

    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(bpmBefore).toBe(120);
    expect(bpmAfter).toBe(140);
  });

  it('should queue multiple config changes and apply at boundaries', async () => {
    const configPath = path.join(tempDir, 'queue.json');

    const configs = [
      { bpm: 120, version: 1 },
      { bpm: 130, version: 2 },
      { bpm: 140, version: 3 }
    ];

    await fs.writeFile(configPath, JSON.stringify(configs[0]));
    await coordinator.loadConfig(configPath);
    await engine.start();

    const appliedVersions: number[] = [];

    coordinator.on('configSwapped', () => {
      appliedVersions.push(engine.getActiveConfig().version);
    });

    // Trigger rapid config changes (within same bar)
    for (let i = 1; i < configs.length; i++) {
      await fs.writeFile(configPath, JSON.stringify(configs[i]));
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait for bar boundaries and processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // MUST FAIL - HotReloadCoordinator doesn't exist
    // Should have applied configs in order at bar boundaries
    expect(appliedVersions.length).toBeGreaterThan(0);
    expect(appliedVersions[appliedVersions.length - 1]).toBe(3); // Final version applied
  });

  it('should emit events for swap lifecycle', async () => {
    const configPath = path.join(tempDir, 'events.json');

    const config1 = { bpm: 120 };
    const config2 = { bpm: 140 };

    await fs.writeFile(configPath, JSON.stringify(config1));
    await coordinator.loadConfig(configPath);

    const lifecycleEvents: string[] = [];

    coordinator.on('configChanging', () => lifecycleEvents.push('configChanging'));
    coordinator.on('swapScheduled', () => lifecycleEvents.push('swapScheduled'));
    coordinator.on('swapExecuting', () => lifecycleEvents.push('swapExecuting'));
    coordinator.on('configSwapped', () => lifecycleEvents.push('configSwapped'));

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Trigger change
    await fs.writeFile(configPath, JSON.stringify(config2));

    // Wait for swap to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(lifecycleEvents).toContain('configChanging');
    expect(lifecycleEvents).toContain('swapScheduled');
    expect(lifecycleEvents).toContain('swapExecuting');
    expect(lifecycleEvents).toContain('configSwapped');

    // Verify order
    expect(lifecycleEvents.indexOf('configChanging')).toBeLessThan(
      lifecycleEvents.indexOf('swapScheduled')
    );
    expect(lifecycleEvents.indexOf('swapScheduled')).toBeLessThan(
      lifecycleEvents.indexOf('swapExecuting')
    );
    expect(lifecycleEvents.indexOf('swapExecuting')).toBeLessThan(
      lifecycleEvents.indexOf('configSwapped')
    );
  });
});

describe('HotReloadCoordinator - Timing Accuracy', () => {
  let coordinator: HotReloadCoordinator;
  let clock: Clock;
  let engine: GenSeqEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    clock = new Clock({ bpm: 120, ppq: 480 });
    engine = new GenSeqEngine({ clock });
    coordinator = new HotReloadCoordinator({ engine, clock });
  });

  afterEach(async () => {
    await coordinator?.dispose();
    await engine?.stop();
    clock?.stop();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should not drop MIDI events during config swap', async () => {
    const configPath = path.join(tempDir, 'no-drop.json');

    const config = {
      bpm: 120,
      patterns: [
        { id: 'p1', steps: 16, type: 'euclidean', pulses: 4, note: 60 }
      ]
    };

    await fs.writeFile(configPath, JSON.stringify(config));
    await coordinator.loadConfig(configPath);

    const midiEventTimestamps: number[] = [];

    engine.on('midiOut', (event: any) => {
      if (event.type === 'noteOn') {
        midiEventTimestamps.push(performance.now());
      }
    });

    await engine.start();

    // Record events for 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    const eventsBeforeSwap = midiEventTimestamps.length;

    // Trigger swap
    config.patterns[0].pulses = 8;
    await fs.writeFile(configPath, JSON.stringify(config));

    // Wait through swap
    await new Promise(resolve => setTimeout(resolve, 600));

    const allEvents = midiEventTimestamps.length;
    const eventsAfterSwap = allEvents - eventsBeforeSwap;

    // Calculate expected event intervals
    const intervals: number[] = [];
    for (let i = 1; i < midiEventTimestamps.length; i++) {
      intervals.push(midiEventTimestamps[i] - midiEventTimestamps[i - 1]);
    }

    // Check for gaps (dropped events would show as large intervals)
    const expectedInterval = 500; // ~120 BPM, 4/16 pattern
    const gaps = intervals.filter(interval => interval > expectedInterval * 2);

    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(gaps.length).toBe(0); // No large gaps = no dropped events
    expect(eventsAfterSwap).toBeGreaterThan(0);
  });

  it('should maintain timing precision across swap boundary', async () => {
    const configPath = path.join(tempDir, 'precision.json');

    const config = {
      bpm: 120,
      patterns: [{ id: 'p1', steps: 4, type: 'euclidean', pulses: 4, note: 60 }]
    };

    await fs.writeFile(configPath, JSON.stringify(config));
    await coordinator.loadConfig(configPath);

    const tickTimestamps: number[] = [];

    clock.on('tick', () => {
      tickTimestamps.push(performance.now());
    });

    await engine.start();

    // Collect ticks before swap
    await new Promise(resolve => setTimeout(resolve, 300));

    const ticksBeforeSwap = tickTimestamps.length;

    // Trigger swap
    config.bpm = 140;
    await fs.writeFile(configPath, JSON.stringify(config));

    // Collect ticks through and after swap
    await new Promise(resolve => setTimeout(resolve, 700));

    // Calculate jitter for ticks before, during, and after swap
    const calculateJitter = (timestamps: number[], bpm: number, ppq: number) => {
      const expectedInterval = (60 * 1000) / (bpm * ppq);
      const intervals: number[] = [];

      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      return intervals.map(interval => Math.abs(interval - expectedInterval));
    };

    const jitterBefore = calculateJitter(
      tickTimestamps.slice(0, ticksBeforeSwap),
      120,
      480
    );

    const jitterAfter = calculateJitter(
      tickTimestamps.slice(ticksBeforeSwap),
      120, // Will stabilize to 140 after swap
      480
    );

    const maxJitterBefore = Math.max(...jitterBefore);
    const maxJitterAfter = Math.max(...jitterAfter.slice(10)); // Skip transition period

    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(maxJitterBefore).toBeLessThan(1.0); // <1ms jitter before
    expect(maxJitterAfter).toBeLessThan(2.0);  // <2ms jitter after (allowing for BPM change)
  });

  it('should synchronize swap with musical timing (bar 1 beat 1)', async () => {
    const configPath = path.join(tempDir, 'sync.json');

    const config1 = { bpm: 120, patterns: [] };
    const config2 = { bpm: 140, patterns: [] };

    await fs.writeFile(configPath, JSON.stringify(config1));
    await coordinator.loadConfig(configPath);

    let swapOccurredAtBar = -1;
    let swapOccurredAtBeat = -1;

    let currentBar = 0;
    let currentBeat = 0;

    clock.on('bar', (bar: number) => { currentBar = bar; });
    clock.on('beat', (beat: number) => { currentBeat = beat; });

    coordinator.on('swapExecuting', () => {
      swapOccurredAtBar = currentBar;
      swapOccurredAtBeat = currentBeat;
    });

    await engine.start();

    // Wait mid-bar
    await new Promise(resolve => setTimeout(resolve, 250));

    // Trigger change
    await fs.writeFile(configPath, JSON.stringify(config2));

    // Wait for swap
    await new Promise(resolve => setTimeout(resolve, 800));

    // MUST FAIL - HotReloadCoordinator doesn't exist
    expect(swapOccurredAtBar).toBeGreaterThan(0);
    expect(swapOccurredAtBeat).toBe(0); // Swapped at beat 1 of bar
  });
});
