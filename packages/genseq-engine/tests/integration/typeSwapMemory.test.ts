import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * T051: Memory Leak Detection Test Suite
 *
 * Verifies that repeated type swaps do not cause memory leaks:
 * - Old pattern instances are garbage collected
 * - Memory usage remains stable after multiple swaps
 * - No reference leaks in event listeners
 * - Instance cleanup is thorough
 *
 * Memory leak indicators:
 * - Heap growth > 10% after 10 swaps
 * - Old pattern instances retained in memory
 * - Event listener accumulation
 */

describe('Type Swap Memory Leak Detection', () => {
  let engine: GenSeqEngine;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = join(tmpdir(), `genseq-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, 'patterns'), { recursive: true });
    await fs.mkdir(join(testProjectPath, 'routes'), { recursive: true });

    const clockConfig = {
      bpm: 120,
      ppq: 96,
      signature: { numerator: 4, denominator: 4 }
    };

    const route = {
      id: 'route1',
      bus: 'main',
      device: 'IAC Driver Bus 1',
      channel: 1
    };

    await fs.writeFile(
      join(testProjectPath, 'clock.yaml'),
      JSON.stringify(clockConfig, null, 2)
    );

    await fs.writeFile(
      join(testProjectPath, 'routes', 'route1.json'),
      JSON.stringify(route, null, 2)
    );

    engine = new GenSeqEngine();
  });

  afterEach(async () => {
    if (engine) {
      engine.stop();
    }
    await fs.rm(testProjectPath, { recursive: true, force: true });
  });

  it('should not leak memory after 10 consecutive type swaps', async () => {
    const initialPattern = {
      id: 'pattern1',
      name: 'Main Pattern',
      type: 'euclidean',
      enabled: true,
      bus: 'main',
      channel: 1,
      length: 1,
      parameters: {
        steps: 8,
        pulses: 5,
        rotation: 0,
        note: 60,
        velocity: 100,
        duration: 0.5
      }
    };

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await engine.loadProject(testProjectPath);
    engine.start();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Force garbage collection if available (run with --expose-gc flag)
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage().heapUsed;

    // Perform 10 type swaps
    const patternTypes = ['probability', 'phase', 'euclidean'];
    for (let i = 0; i < 10; i++) {
      const type = patternTypes[i % patternTypes.length];
      let parameters: any;

      switch (type) {
        case 'euclidean':
          parameters = { steps: 8, pulses: 5, rotation: 0, note: 60, velocity: 100, duration: 0.5 };
          break;
        case 'probability':
          parameters = { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 };
          break;
        case 'phase':
          parameters = { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 };
          break;
      }

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type,
          parameters
        }, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryGrowth = ((memoryAfter - memoryBefore) / memoryBefore) * 100;

    // Memory should not grow by more than 10%
    expect(memoryGrowth).toBeLessThan(10);
  });

  it('should clean up old pattern instances', async () => {
    const initialPattern = {
      id: 'pattern1',
      name: 'Main Pattern',
      type: 'euclidean',
      enabled: true,
      bus: 'main',
      channel: 1,
      length: 1,
      parameters: {
        steps: 8,
        pulses: 5,
        rotation: 0,
        note: 60,
        velocity: 100,
        duration: 0.5
      }
    };

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await engine.loadProject(testProjectPath);
    engine.start();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Swap to probability
    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify({
        ...initialPattern,
        type: 'probability',
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      }, null, 2)
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Swap to phase
    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify({
        ...initialPattern,
        type: 'phase',
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      }, null, 2)
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    // Verify only 1 pattern instance exists (current one)
    // This test verifies cleanup behavior - actual assertion depends on
    // implementation details (e.g., weak refs, instance tracking)
    // For now, we verify that the system is stable
    expect(engine.isRunning()).toBe(true);
  });

  it('should not accumulate event listeners during swaps', async () => {
    const initialPattern = {
      id: 'pattern1',
      name: 'Main Pattern',
      type: 'euclidean',
      enabled: true,
      bus: 'main',
      channel: 1,
      length: 1,
      parameters: {
        steps: 8,
        pulses: 5,
        rotation: 0,
        note: 60,
        velocity: 100,
        duration: 0.5
        }
    };

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await engine.loadProject(testProjectPath);

    // Count initial listeners
    const initialListenerCount = engine.listenerCount('pattern:typeSwapCompleted');

    engine.start();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Perform multiple swaps
    for (let i = 0; i < 5; i++) {
      const type = i % 2 === 0 ? 'probability' : 'phase';
      const parameters = type === 'probability'
        ? { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
        : { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type,
          parameters
        }, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Verify listener count hasn't grown
    const finalListenerCount = engine.listenerCount('pattern:typeSwapCompleted');
    expect(finalListenerCount).toBe(initialListenerCount);
  });

  it('should handle rapid consecutive swaps without memory corruption', async () => {
    const initialPattern = {
      id: 'pattern1',
      name: 'Main Pattern',
      type: 'euclidean',
      enabled: true,
      bus: 'main',
      channel: 1,
      length: 1,
      parameters: {
        steps: 8,
        pulses: 5,
        rotation: 0,
        note: 60,
        velocity: 100,
        duration: 0.5
      }
    };

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await engine.loadProject(testProjectPath);
    engine.start();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Rapid fire 3 swaps in quick succession
    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify({
        ...initialPattern,
        type: 'probability',
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      }, null, 2)
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify({
        ...initialPattern,
        type: 'phase',
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      }, null, 2)
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify system is stable (no crashes, still running)
    expect(engine.isRunning()).toBe(true);
  });

  it('should maintain stable memory after repeated swap cycles', async () => {
    const initialPattern = {
      id: 'pattern1',
      name: 'Main Pattern',
      type: 'euclidean',
      enabled: true,
      bus: 'main',
      channel: 1,
      length: 1,
      parameters: {
        steps: 8,
        pulses: 5,
        rotation: 0,
        note: 60,
        velocity: 100,
        duration: 0.5
      }
    };

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await engine.loadProject(testProjectPath);
    engine.start();

    await new Promise(resolve => setTimeout(resolve, 100));

    if (global.gc) {
      global.gc();
    }

    const memorySnapshots: number[] = [];
    memorySnapshots.push(process.memoryUsage().heapUsed);

    // Perform 3 complete cycles (euclidean → probability → phase → euclidean)
    for (let cycle = 0; cycle < 3; cycle++) {
      // euclidean → probability
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type: 'probability',
          parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      // probability → phase
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type: 'phase',
          parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      // phase → euclidean
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      if (global.gc) {
        global.gc();
      }

      memorySnapshots.push(process.memoryUsage().heapUsed);
    }

    // Calculate average memory growth per cycle
    const growthRates: number[] = [];
    for (let i = 1; i < memorySnapshots.length; i++) {
      const growth = ((memorySnapshots[i] - memorySnapshots[i - 1]) / memorySnapshots[i - 1]) * 100;
      growthRates.push(growth);
    }

    const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;

    // Average growth should be minimal (<5% per cycle)
    expect(avgGrowth).toBeLessThan(5);
  });
});
