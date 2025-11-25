import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternExecutor } from '../../src/patterns/PatternExecutor';
import { Clock } from '../../src/clock/Clock';
import type { PatternEntity } from '../../src/config/entities/PatternEntity';

/**
 * T011: PatternExecutor type swap test suite (RED PHASE - MUST FAIL)
 *
 * Tests for pattern type swapping during playback:
 * - Schedule type swap for next cycle boundary
 * - Apply type swap atomically
 * - Rollback on failure
 * - Continue transport without interruption
 *
 * This test file MUST be created before type swap implementation exists.
 */

describe('PatternExecutor - Type Swap', () => {
  let clock: Clock;
  let executor: PatternExecutor;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 96 });
    executor = new PatternExecutor({ clock, scheduler: null });
  });

  describe('scheduleTypeSwap', () => {
    it('should schedule type swap for next cycle boundary', () => {
      // Add initial Euclidean pattern
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          steps: 16,
          pulses: 4,
          rotation: 0,
          velocity: 100,
          gateLength: 0.25
        }
      };

      const generator = vi.fn();
      executor.addPattern(euclideanEntity, generator);

      // Schedule type swap to probability
      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          probability: 0.75,
          density: 16,
          velocity: 100,
          gateLength: 0.25
        }
      };

      // This method doesn't exist yet - test MUST FAIL
      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      // Verify swap is pending
      const pattern = executor.getPattern('pattern1');
      expect(pattern).toBeDefined();
      expect((pattern as any).pendingTypeSwap).toBe(true);
      expect((pattern as any).targetType).toBe('probability');
    });

    it('should emit typeSwapScheduled event', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          steps: 16,
          pulses: 4,
          rotation: 0
        }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          probability: 0.75,
          density: 16
        }
      };

      const eventSpy = vi.fn();
      executor.on('typeSwapScheduled', eventSpy);

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      expect(eventSpy).toHaveBeenCalledWith({
        patternId: 'pattern1',
        fromType: 'euclidean',
        toType: 'probability',
        scheduledAt: expect.any(Number)
      });
    });

    it('should reject scheduling for non-existent pattern', () => {
      const entity: PatternEntity = {
        id: 'nonexistent',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {}
      };

      expect(() => {
        executor.scheduleTypeSwap('nonexistent', entity);
      }).toThrow(/pattern.*not found/i);
    });

    it('should allow scheduling multiple type swaps (queue latest)', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      // Schedule first swap
      const probabilityEntity: PatternEntity = {
        ...euclideanEntity,
        type: 'probability',
        parameters: { probability: 0.75, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      // Schedule second swap (should replace first)
      const phaseEntity: PatternEntity = {
        ...euclideanEntity,
        type: 'phase',
        parameters: { phaseRate: 1.5, phaseOffset: 0.25 }
      };

      executor.scheduleTypeSwap('pattern1', phaseEntity);

      const pattern = executor.getPattern('pattern1');
      expect((pattern as any).targetType).toBe('phase');
    });
  });

  describe('applyTypeSwap', () => {
    it('should apply type swap at cycle boundary', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      // Start clock and executor
      clock.start();
      executor.start();

      // Advance to cycle boundary
      const ppq = clock.getPpq();
      const ticksPerCycle = ppq * 4 * 1; // 1 bar

      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      // Verify type was swapped
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.type).toBe('probability');
      expect((pattern as any).pendingTypeSwap).toBe(false);
    });

    it('should emit typeSwapComplete event on successful swap', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      const eventSpy = vi.fn();
      executor.on('typeSwapComplete', eventSpy);

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      clock.start();
      executor.start();

      const ppq = clock.getPpq();
      const ticksPerCycle = ppq * 4 * 1;

      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      expect(eventSpy).toHaveBeenCalledWith({
        patternId: 'pattern1',
        fromType: 'euclidean',
        toType: 'probability',
        completedAt: expect.any(Number),
        latency: expect.any(Number)
      });
    });

    it('should swap from euclidean to probability type', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        ...euclideanEntity,
        type: 'probability',
        parameters: { probability: 0.75, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      const pattern = executor.getPattern('pattern1');
      expect(pattern?.type).toBe('probability');
      expect(pattern?.parameters).toHaveProperty('probability', 0.75);
    });

    it('should swap from probability to phase type', () => {
      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      executor.addPattern(probabilityEntity, vi.fn());

      const phaseEntity: PatternEntity = {
        ...probabilityEntity,
        type: 'phase',
        parameters: { phaseRate: 1.5, phaseOffset: 0.25 }
      };

      executor.scheduleTypeSwap('pattern1', phaseEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      const pattern = executor.getPattern('pattern1');
      expect(pattern?.type).toBe('phase');
      expect(pattern?.parameters).toHaveProperty('phaseRate', 1.5);
    });

    it('should swap from phase to euclidean type', () => {
      const phaseEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase',
        bus: 'synth',
        enabled: true,
        length: 1,
        division: 16,
        channel: 1,
        parameters: { phaseRate: 1.5, phaseOffset: 0.25 }
      };

      executor.addPattern(phaseEntity, vi.fn());

      const euclideanEntity: PatternEntity = {
        ...phaseEntity,
        type: 'euclidean',
        parameters: { steps: 16, pulses: 4 }
      };

      executor.scheduleTypeSwap('pattern1', euclideanEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      const pattern = executor.getPattern('pattern1');
      expect(pattern?.type).toBe('euclidean');
      expect(pattern?.parameters).toHaveProperty('steps', 16);
    });
  });

  describe('rollbackTypeSwap', () => {
    it('should rollback type swap on validation failure', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      // Invalid probability (> 1.0)
      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 1.5, density: 16 } // Invalid
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      // Should still be euclidean (swap failed)
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.type).toBe('euclidean');
      expect((pattern as any).pendingTypeSwap).toBe(false);
    });

    it('should emit typeSwapFailed event on validation failure', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 2.0, density: 16 }
      };

      const eventSpy = vi.fn();
      executor.on('typeSwapFailed', eventSpy);

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      expect(eventSpy).toHaveBeenCalledWith({
        patternId: 'pattern1',
        fromType: 'euclidean',
        toType: 'probability',
        error: expect.any(Error),
        failedAt: expect.any(Number)
      });
    });

    it('should continue playback with original pattern after rollback', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      const generatorSpy = vi.fn(() => []);
      executor.addPattern(euclideanEntity, generatorSpy);

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 1.5, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;

      // Advance through cycle boundary (swap attempt)
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      // Clear call count
      generatorSpy.mockClear();

      // Advance more ticks - original generator should still be called
      for (let i = 0; i < 10; i++) {
        clock.tick();
      }

      expect(generatorSpy).toHaveBeenCalled();
    });

    it('should clear pendingTypeSwap flags after rollback', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const invalidEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: -0.5, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', invalidEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      const pattern = executor.getPattern('pattern1');
      expect((pattern as any).pendingTypeSwap).toBe(false);
      expect((pattern as any).targetType).toBeUndefined();
      expect((pattern as any).targetEntity).toBeUndefined();
    });
  });

  describe('transport continuity', () => {
    it('should continue transport without interruption during type swap', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      const generatorSpy = vi.fn(() => []);
      executor.addPattern(euclideanEntity, generatorSpy);

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      let callCount = 0;

      for (let i = 0; i < ticksPerCycle * 2; i++) {
        const beforeCallCount = generatorSpy.mock.calls.length;
        clock.tick();
        const afterCallCount = generatorSpy.mock.calls.length;

        if (afterCallCount > beforeCallCount) {
          callCount++;
        }
      }

      // Verify generator was called continuously (no gaps)
      expect(callCount).toBeGreaterThan(0);
    });

    it('should complete type swap within 50ms performance requirement', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      let swapLatency = 0;
      executor.on('typeSwapComplete', (event) => {
        swapLatency = event.latency;
      });

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      clock.start();
      executor.start();

      const ticksPerCycle = clock.getPpq() * 4 * 1;
      for (let i = 0; i < ticksPerCycle; i++) {
        clock.tick();
      }

      expect(swapLatency).toBeGreaterThan(0);
      expect(swapLatency).toBeLessThan(50); // <50ms requirement
    });
  });

  describe('ActivePattern interface extensions', () => {
    it('should have pendingTypeSwap field', () => {
      const entity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(entity, vi.fn());

      const pattern = executor.getPattern('pattern1');
      expect((pattern as any).pendingTypeSwap).toBeDefined();
    });

    it('should have targetType field when swap is scheduled', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      const pattern = executor.getPattern('pattern1');
      expect((pattern as any).targetType).toBe('probability');
    });

    it('should have targetEntity field when swap is scheduled', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      executor.scheduleTypeSwap('pattern1', probabilityEntity);

      const pattern = executor.getPattern('pattern1');
      expect((pattern as any).targetEntity).toEqual(probabilityEntity);
    });

    it('should have swapScheduledAt timestamp', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { steps: 16, pulses: 4 }
      };

      executor.addPattern(euclideanEntity, vi.fn());

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: { probability: 0.75, density: 16 }
      };

      const before = performance.now();
      executor.scheduleTypeSwap('pattern1', probabilityEntity);
      const after = performance.now();

      const pattern = executor.getPattern('pattern1');
      const timestamp = (pattern as any).swapScheduledAt;

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
