import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternExecutor } from '../../src/patterns/PatternExecutor';
import { Clock } from '../../src/clock/Clock';
import type { PatternEntity, PatternType } from '@genseq/patterns';
import type { TypeSwapEvent } from '../../src/events/TypeSwapEvent';

describe('PatternExecutor Rollback Mechanism', () => {
  let executor: PatternExecutor;
  let clock: Clock;

  beforeEach(() => {
    clock = new Clock({
      bpm: 120,
      ppq: 96,
      signature: { numerator: 4, denominator: 4 }
    });
    executor = new PatternExecutor({ clock, scheduler: null });
  });

  describe('Type Swap Rollback on Validation Failure', () => {
    it('should preserve previous pattern when new type has invalid parameters', () => {
      // Start with valid euclidean pattern
      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);
      const originalPattern = executor.getPattern('pattern1');
      const originalGenerator = originalPattern?.generator;

      // Attempt type swap with INVALID parameters
      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 2.0, // INVALID: > 1.0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      // Advance to cycle boundary to trigger swap
      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Verify rollback: should still be euclidean
      const currentPattern = executor.getPattern('pattern1');
      expect(currentPattern?.entity.type).toBe('euclidean');
      expect(currentPattern?.generator).toBe(originalGenerator);
      expect(currentPattern?.pendingTypeSwap).toBe(false);
    });

    it('should emit typeSwapFailed event on rollback', () => {
      const failedEvents: TypeSwapEvent[] = [];
      executor.on('typeSwapFailed', (event) => failedEvents.push(event));

      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: -1.0, // INVALID: negative phaseRate
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].patternId).toBe('pattern1');
      expect(failedEvents[0].oldType).toBe('euclidean');
      expect(failedEvents[0].newType).toBe('phase');
      expect(failedEvents[0].status).toBe('failed');
      expect(failedEvents[0].error).toMatch(/invalid phaseRate|phaseRate.*must/i);
    });

    it('should clear pendingTypeSwap flags on rollback', () => {
      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 1.5, // INVALID
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      const beforeBoundary = executor.getPattern('pattern1');
      expect(beforeBoundary?.pendingTypeSwap).toBe(true);

      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      const afterRollback = executor.getPattern('pattern1');
      expect(afterRollback?.pendingTypeSwap).toBe(false);
      expect(afterRollback?.targetType).toBeUndefined();
      expect(afterRollback?.targetEntity).toBeUndefined();
    });
  });

  describe('Transport Continuity During Rollback', () => {
    it('should continue ticking previous pattern during rollback', () => {
      const tickSpy = vi.fn();

      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      // Override generator to spy on ticks
      const pattern = executor.getPattern('pattern1');
      if (pattern) {
        const originalGen = pattern.generator;
        pattern.generator = (context) => {
          tickSpy(context);
          return originalGen ? originalGen(context) : [];
        };
      }

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 2.0, // INVALID
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      const ticksBefore = tickSpy.mock.calls.length;

      // Tick through cycle boundary (rollback occurs)
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      const ticksAfter = tickSpy.mock.calls.length;

      // Verify pattern continued ticking
      expect(ticksAfter).toBeGreaterThan(ticksBefore);
    });

    it('should not interrupt MIDI output during rollback', () => {
      const midiEvents: any[] = [];
      executor.on('event', (event) => midiEvents.push(event));

      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: -1.0, // INVALID: negative phaseRate
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      for (let i = 0; i < 96 * 8; i++) { // Two full cycles
        clock.tick();
        executor.tick();
      }

      // Verify MIDI events continued across rollback
      expect(midiEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Logging on Rollback', () => {
    it('should log detailed error information on rollback', () => {
      const failedEvents: TypeSwapEvent[] = [];
      executor.on('typeSwapFailed', (event) => failedEvents.push(event));

      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 1.5,
          density: 2.0, // Multiple validation errors
          note: 128, // INVALID note
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      expect(failedEvents).toHaveLength(1);
      const event = failedEvents[0];
      expect(event.error).toBeDefined();
      expect(event.error).toMatch(/probability|density|note/i); // Should mention invalid parameter
    });

    it('should include timestamp in rollback events', () => {
      const failedEvents: TypeSwapEvent[] = [];
      executor.on('typeSwapFailed', (event) => failedEvents.push(event));

      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 2.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].timestamp).toBeDefined();
      expect(typeof failedEvents[0].timestamp).toBe('bigint');
    });
  });

  describe('Multiple Rollback Scenarios', () => {
    it('should handle consecutive rollbacks without state corruption', () => {
      const failedEvents: TypeSwapEvent[] = [];
      executor.on('typeSwapFailed', (event) => failedEvents.push(event));

      const originalEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      executor.loadPattern(originalEntity);

      // First invalid swap
      const invalid1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 2.0, note: 60, velocity: 100, duration: 0.5 }
      };

      executor.scheduleTypeSwap('pattern1', invalid1);

      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Second invalid swap
      const invalid2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: -1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };

      executor.scheduleTypeSwap('pattern1', invalid2);

      // Run TWO full cycles to ensure boundary is crossed
      for (let i = 0; i < 96 * 4 * 2; i++) {
        clock.tick();
        executor.tick();
      }

      expect(failedEvents).toHaveLength(2);

      // Verify pattern still in original state
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.entity.type).toBe('euclidean');
      expect(pattern?.pendingTypeSwap).toBe(false);
    });
  });
});
