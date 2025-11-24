import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PatternExecutor } from '../../src/patterns/PatternExecutor';
import { Clock } from '../../src/clock/Clock';
import type { PatternEntity } from '../../src/config/entities/PatternEntity';
import type { PatternGeneratorFn } from '@genseq/patterns';

/**
 * T050: Integration test for hot-reload parameter updates
 *
 * Validates that pattern parameters can be updated while transport is running
 * without interruption to playback.
 */

describe('PatternExecutor - Hot Reload Integration', () => {
  let clock: Clock;
  let executor: PatternExecutor;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 96, timeSignature: [4, 4] });
    executor = new PatternExecutor({ clock, scheduler: null });
  });

  afterEach(() => {
    if (clock) {
      clock.stop();
    }
    if (executor) {
      executor.stop();
    }
  });

  it('should update euclidean pattern parameters during playback', async () => {
    // Setup: Create a euclidean pattern
    const pattern: PatternEntity = {
      id: 'euclidean-1',
      name: 'Euclidean Pattern',
      type: 'euclidean',
      enabled: true,
      length: 1,
      division: 4,
      bus: 'main',
      note: 60,
      channel: 1,
      parameters: {
        steps: 16,
        pulses: 4,
        rotation: 0,
        velocity: 100,
        gateLength: 24
      }
    };

    // Track parameter changes
    const parameterHistory: any[] = [];
    const generator: PatternGeneratorFn = (context) => {
      parameterHistory.push({ ...context.params });
      return [];
    };

    executor.addPattern(pattern, generator);
    executor.start();
    clock.start();

    // Simulate some playback
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify initial parameters are used
    expect(parameterHistory.length).toBeGreaterThan(0);
    expect(parameterHistory[0].pulses).toBe(4);
    expect(parameterHistory[0].velocity).toBe(100);

    // Hot-reload: Update parameters while playing
    executor.updatePatternParameters('euclidean-1', {
      pulses: 8,
      velocity: 80
    });

    // Continue playback
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify new parameters are eventually used
    const recentParams = parameterHistory[parameterHistory.length - 1];
    expect(recentParams.pulses).toBe(8);
    expect(recentParams.velocity).toBe(80);

    // Verify unchanged parameters are preserved
    expect(recentParams.steps).toBe(16);
    expect(recentParams.rotation).toBe(0);
    expect(recentParams.gateLength).toBe(24);
  });

  it('should emit update events in correct order', () => {
    const pattern: PatternEntity = {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'euclidean',
      enabled: true,
      length: 1,
      division: 4,
      bus: 'main',
      parameters: { steps: 16, pulses: 4 }
    };

    const generator: PatternGeneratorFn = () => [];
    executor.addPattern(pattern, generator);

    const events: string[] = [];
    executor.on('patternUpdated', (data) => {
      events.push(`updated:${data.id}:${data.parameters.pulses}`);
    });
    executor.on('patternRegenerated', (data) => {
      events.push(`regenerated:${data.id}:${data.parameters.pulses}`);
    });

    executor.start();

    // Update parameters
    executor.updatePatternParameters('test-pattern', { pulses: 8 });

    // Verify immediate update event
    expect(events[0]).toBe('updated:test-pattern:8');

    // Trigger cycle boundary
    const ticksPerCycle = 96 * 4 * 1;
    for (let i = 0; i < ticksPerCycle + 10; i++) {
      clock.emit('tick', i);
    }

    // Verify regenerated event at cycle boundary
    expect(events).toContain('regenerated:test-pattern:8');
    expect(events.indexOf('updated:test-pattern:8')).toBeLessThan(
      events.indexOf('regenerated:test-pattern:8')
    );

    executor.stop();
  });

  it('should handle multiple rapid parameter updates', () => {
    const pattern: PatternEntity = {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'euclidean',
      enabled: true,
      length: 1,
      division: 4,
      bus: 'main',
      parameters: { steps: 16, pulses: 4, velocity: 100 }
    };

    const generator: PatternGeneratorFn = () => [];
    executor.addPattern(pattern, generator);
    executor.start();

    // Rapid updates
    executor.updatePatternParameters('test-pattern', { pulses: 5 });
    executor.updatePatternParameters('test-pattern', { pulses: 6 });
    executor.updatePatternParameters('test-pattern', { pulses: 7 });
    executor.updatePatternParameters('test-pattern', { velocity: 80 });

    // Final parameters should have all updates
    const updated = executor.getPattern('test-pattern');
    expect(updated?.parameters).toEqual({
      steps: 16,
      pulses: 7,
      velocity: 80
    });

    executor.stop();
  });

  it('should maintain pattern playback during parameter updates', async () => {
    const pattern: PatternEntity = {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'euclidean',
      enabled: true,
      length: 1,
      division: 4,
      bus: 'main',
      parameters: { steps: 16, pulses: 4 }
    };

    let executionCount = 0;
    const generator: PatternGeneratorFn = () => {
      executionCount++;
      return [];
    };

    executor.addPattern(pattern, generator);
    executor.start();
    clock.start();

    // Let it run
    await new Promise(resolve => setTimeout(resolve, 50));
    const countBeforeUpdate = executionCount;

    // Update parameters
    executor.updatePatternParameters('test-pattern', { pulses: 8 });

    // Continue running
    await new Promise(resolve => setTimeout(resolve, 50));
    const countAfterUpdate = executionCount;

    // Pattern should continue executing throughout
    expect(countBeforeUpdate).toBeGreaterThan(0);
    expect(countAfterUpdate).toBeGreaterThan(countBeforeUpdate);
  });

  it('should handle parameter updates for disabled patterns', () => {
    const pattern: PatternEntity = {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'euclidean',
      enabled: false,
      length: 1,
      division: 4,
      bus: 'main',
      parameters: { steps: 16, pulses: 4 }
    };

    const generator: PatternGeneratorFn = () => [];
    executor.addPattern(pattern, generator);

    // Update disabled pattern
    executor.updatePatternParameters('test-pattern', { pulses: 8 });

    // Parameters should be updated
    const updated = executor.getPattern('test-pattern');
    expect(updated?.parameters.pulses).toBe(8);

    // When enabled, should use new parameters
    executor.enablePattern('test-pattern');
    expect(updated?.parameters.pulses).toBe(8);
  });

  it('should properly calculate cycle boundaries for different pattern lengths', () => {
    // 1-bar pattern
    const pattern1: PatternEntity = {
      id: 'pattern-1bar',
      name: '1 Bar Pattern',
      type: 'euclidean',
      enabled: true,
      length: 1,
      division: 4,
      bus: 'main',
      parameters: { steps: 16, pulses: 4 }
    };

    // 2-bar pattern
    const pattern2: PatternEntity = {
      id: 'pattern-2bar',
      name: '2 Bar Pattern',
      type: 'euclidean',
      enabled: true,
      length: 2,
      division: 4,
      bus: 'main',
      parameters: { steps: 32, pulses: 8 }
    };

    const generator: PatternGeneratorFn = () => [];
    executor.addPattern(pattern1, generator);
    executor.addPattern(pattern2, generator);

    const regeneratedEvents: any[] = [];
    executor.on('patternRegenerated', (data) => {
      regeneratedEvents.push(data);
    });

    executor.start();

    // Update both patterns
    executor.updatePatternParameters('pattern-1bar', { pulses: 5 });
    executor.updatePatternParameters('pattern-2bar', { pulses: 10 });

    // 1-bar pattern should regenerate at 96*4 = 384 ticks
    // 2-bar pattern should regenerate at 96*4*2 = 768 ticks
    for (let i = 0; i < 800; i++) {
      clock.emit('tick', i);
    }

    // Both patterns should have regenerated
    expect(regeneratedEvents.some(e => e.id === 'pattern-1bar')).toBe(true);
    expect(regeneratedEvents.some(e => e.id === 'pattern-2bar')).toBe(true);

    executor.stop();
  });
});
