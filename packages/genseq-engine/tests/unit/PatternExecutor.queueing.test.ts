import { describe, it, expect, beforeEach } from 'vitest';
import { PatternExecutor } from '../../src/patterns/PatternExecutor';
import { Clock } from '../../src/clock/Clock';
import type { PatternEntity, PatternType } from '@genseq/patterns';

/**
 * T052: Rapid Type Change Queue Test
 *
 * Verifies that rapid consecutive type changes are handled correctly:
 * - Only the most recent change is applied
 * - Intermediate changes are skipped/deduplicated
 * - No state corruption from rapid changes
 * - Pending swaps are properly replaced
 *
 * Scenarios:
 * - 3 rapid changes within single cycle → only last applied
 * - Change during pending swap → replaces pending swap
 * - Change immediately after swap → queues correctly
 */

describe('PatternExecutor Rapid Type Change Queueing', () => {
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

  describe('Single Cycle Multiple Changes', () => {
    it('should apply only the most recent change when multiple swaps scheduled in same cycle', () => {
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

      // Schedule 3 type swaps rapidly
      const swap1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      };

      const swap2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };

      const swap3: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.5, density: 0.8, note: 64, velocity: 90, duration: 0.25 }
      };

      executor.scheduleTypeSwap('pattern1', swap1);
      executor.scheduleTypeSwap('pattern1', swap2);
      executor.scheduleTypeSwap('pattern1', swap3);

      const typeSwapEvents: any[] = [];
      executor.on('typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Advance to cycle boundary
      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Should only have 1 swap event (to final type)
      expect(typeSwapEvents).toHaveLength(1);
      expect(typeSwapEvents[0].toType).toBe('probability');

      // Verify final pattern type
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.entity.type).toBe('probability');
      expect(pattern?.entity.parameters.probability).toBe(0.5);
      expect(pattern?.entity.parameters.density).toBe(0.8);
    });

    it('should emit swapReplaced event when pending swap is replaced', () => {
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

      const swapReplacedEvents: any[] = [];
      executor.on('typeSwapReplaced', (event) => swapReplacedEvents.push(event));

      // Schedule first swap
      const swap1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap1);

      // Replace with second swap
      const swap2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap2);

      // Should emit swapReplaced event
      expect(swapReplacedEvents).toHaveLength(1);
      expect(swapReplacedEvents[0].patternId).toBe('pattern1');
      expect(swapReplacedEvents[0].replacedType).toBe('probability');
      expect(swapReplacedEvents[0].newType).toBe('phase');
    });
  });

  describe('Rapid Changes Across Cycle Boundaries', () => {
    it('should handle change immediately after swap completes', () => {
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

      const typeSwapEvents: any[] = [];
      executor.on('typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // First swap
      const swap1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap1);

      clock.start();

      // Advance to cycle boundary (first swap completes)
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Immediately schedule second swap
      const swap2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap2);

      // Advance to next cycle boundary (second swap completes)
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Should have 2 swap events
      expect(typeSwapEvents).toHaveLength(2);
      expect(typeSwapEvents[0].toType).toBe('probability');
      expect(typeSwapEvents[1].toType).toBe('phase');

      // Verify final pattern type
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.entity.type).toBe('phase');
    });

    it('should handle multiple changes across several cycles', () => {
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

      const typeSwapEvents: any[] = [];
      executor.on('typeSwapCompleted', (event) => typeSwapEvents.push(event));

      clock.start();

      // Swap 1: euclidean → probability
      const swap1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap1);

      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Swap 2: probability → phase
      const swap2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap2);

      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Swap 3: phase → euclidean
      const swap3: PatternEntity = {
        ...originalEntity,
        type: 'euclidean' as PatternType,
        parameters: { steps: 16, pulses: 7, rotation: 2, note: 64, velocity: 110, duration: 0.25 }
      };
      executor.scheduleTypeSwap('pattern1', swap3);

      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Should have 3 swap events
      expect(typeSwapEvents).toHaveLength(3);
      expect(typeSwapEvents[0].toType).toBe('probability');
      expect(typeSwapEvents[1].toType).toBe('phase');
      expect(typeSwapEvents[2].toType).toBe('euclidean');

      // Verify final pattern type and parameters
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.entity.type).toBe('euclidean');
      expect(pattern?.entity.parameters.steps).toBe(16);
      expect(pattern?.entity.parameters.pulses).toBe(7);
    });
  });

  describe('Deduplication Logic', () => {
    it('should track swap timestamps and apply only latest', () => {
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

      // Schedule multiple swaps with different timestamps
      const timestamps: number[] = [];

      const swap1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap1);
      timestamps.push(Date.now());

      const swap2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap2);
      timestamps.push(Date.now());

      const swap3: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.5, density: 0.8, note: 64, velocity: 90, duration: 0.25 }
      };
      executor.scheduleTypeSwap('pattern1', swap3);
      timestamps.push(Date.now());

      // Get pending swap info
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.pendingTypeSwap).toBe(true);
      expect(pattern?.targetType).toBe('probability');

      // Advance to cycle boundary
      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Verify only latest swap was applied
      const finalPattern = executor.getPattern('pattern1');
      expect(finalPattern?.entity.type).toBe('probability');
      expect(finalPattern?.entity.parameters.probability).toBe(0.5);
      expect(finalPattern?.entity.parameters.density).toBe(0.8);
    });

    it('should not apply stale swaps if newer swap already applied', () => {
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

      const typeSwapEvents: any[] = [];
      executor.on('typeSwapCompleted', (event) => typeSwapEvents.push(event));

      clock.start();

      // Schedule first swap
      const swap1: PatternEntity = {
        ...originalEntity,
        type: 'probability' as PatternType,
        parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap1);

      // Advance to cycle boundary
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Verify first swap applied
      expect(typeSwapEvents).toHaveLength(1);
      expect(typeSwapEvents[0].toType).toBe('probability');

      // Schedule second swap immediately
      const swap2: PatternEntity = {
        ...originalEntity,
        type: 'phase' as PatternType,
        parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
      };
      executor.scheduleTypeSwap('pattern1', swap2);

      // Advance to next cycle boundary
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Should have 2 total swap events (no duplicates)
      expect(typeSwapEvents).toHaveLength(2);
      expect(typeSwapEvents[1].toType).toBe('phase');

      // Verify final type
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.entity.type).toBe('phase');
    });
  });

  describe('State Corruption Prevention', () => {
    it('should maintain consistent state during rapid changes', () => {
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

      // Rapid fire 5 swaps
      for (let i = 0; i < 5; i++) {
        const type = ['probability', 'phase', 'euclidean'][i % 3] as PatternType;
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

        const swap: PatternEntity = {
          ...originalEntity,
          type,
          parameters
        };
        executor.scheduleTypeSwap('pattern1', swap);
      }

      // Verify pattern is in consistent state
      const pattern = executor.getPattern('pattern1');
      expect(pattern?.pendingTypeSwap).toBe(true);
      expect(pattern?.targetType).toBeDefined();
      expect(pattern?.targetEntity).toBeDefined();

      // Advance to cycle boundary
      clock.start();
      for (let i = 0; i < 96 * 4; i++) {
        clock.tick();
        executor.tick();
      }

      // Verify swap completed successfully
      const finalPattern = executor.getPattern('pattern1');
      expect(finalPattern?.pendingTypeSwap).toBe(false);
      expect(finalPattern?.entity.type).toBe('phase'); // Last in sequence: i=4 -> phase
    });
  });
});
