import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternExecutor } from '../../src/patterns/PatternExecutor';
import { Clock } from '../../src/clock/Clock';
import type { PatternEntity } from '../../src/config/entities/PatternEntity';
import type { PatternGeneratorFn, MidiEvent } from '@genseq/patterns';

/**
 * T050: PatternExecutor tests
 *
 * Tests for live parameter updates without transport interruption
 */

describe('PatternExecutor', () => {
  let clock: Clock;
  let executor: PatternExecutor;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 96, timeSignature: [4, 4] });
    executor = new PatternExecutor({ clock, scheduler: null });
  });

  describe('Pattern Management', () => {
    it('should add pattern and emit patternAdded event', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        note: 60,
        channel: 1,
        parameters: { steps: 16, pulses: 4 }
      };

      const generator: PatternGeneratorFn = () => [];
      const addedSpy = vi.fn();
      executor.on('patternAdded', addedSpy);

      executor.addPattern(pattern, generator);

      expect(addedSpy).toHaveBeenCalledWith('test-pattern');
      expect(executor.getPattern('test-pattern')).toEqual(pattern);
    });

    it('should remove pattern and emit patternRemoved event', () => {
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
      const removedSpy = vi.fn();
      executor.on('patternRemoved', removedSpy);

      executor.addPattern(pattern, generator);
      executor.removePattern('test-pattern');

      expect(removedSpy).toHaveBeenCalledWith('test-pattern');
      expect(executor.getPattern('test-pattern')).toBeUndefined();
    });

    it('should enable and disable patterns', () => {
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
      const enabledSpy = vi.fn();
      const disabledSpy = vi.fn();
      executor.on('patternEnabled', enabledSpy);
      executor.on('patternDisabled', disabledSpy);

      executor.addPattern(pattern, generator);
      executor.enablePattern('test-pattern');
      expect(enabledSpy).toHaveBeenCalledWith('test-pattern');

      executor.disablePattern('test-pattern');
      expect(disabledSpy).toHaveBeenCalledWith('test-pattern');
    });
  });

  describe('T050: Live Parameter Updates', () => {
    it('should update parameters without stopping transport', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        note: 60,
        channel: 1,
        parameters: { steps: 16, pulses: 4, velocity: 100 }
      };

      const generator: PatternGeneratorFn = () => [];
      executor.addPattern(pattern, generator);

      const updatedSpy = vi.fn();
      executor.on('patternUpdated', updatedSpy);

      // Update parameters
      executor.updatePatternParameters('test-pattern', { pulses: 8, velocity: 80 });

      // Should emit update event immediately
      expect(updatedSpy).toHaveBeenCalledWith({
        id: 'test-pattern',
        parameters: { steps: 16, pulses: 8, velocity: 80 }
      });

      // Parameters should be updated
      const updated = executor.getPattern('test-pattern');
      expect(updated?.parameters).toEqual({ steps: 16, pulses: 8, velocity: 80 });
    });

    it('should deep merge parameters without replacing entire object', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: { steps: 16, pulses: 4, rotation: 0, velocity: 100 }
      };

      const generator: PatternGeneratorFn = () => [];
      executor.addPattern(pattern, generator);

      // Update only pulses
      executor.updatePatternParameters('test-pattern', { pulses: 8 });

      // All other parameters should be preserved
      const updated = executor.getPattern('test-pattern');
      expect(updated?.parameters).toEqual({
        steps: 16,
        pulses: 8,
        rotation: 0,
        velocity: 100
      });
    });

    it('should mark pattern for reload on next cycle', async () => {
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

      let eventCount = 0;
      const generator: PatternGeneratorFn = () => {
        eventCount++;
        return [];
      };

      executor.addPattern(pattern, generator);
      executor.start();

      // Update parameters
      executor.updatePatternParameters('test-pattern', { pulses: 8 });

      // Manually trigger ticks to simulate pattern execution
      const ticksPerCycle = 96 * 4 * 1; // PPQ * beats/bar * bars
      for (let i = 0; i < ticksPerCycle + 10; i++) {
        clock.emit('tick', i);
      }

      // Pattern should have been executed with new parameters
      expect(eventCount).toBeGreaterThan(0);

      executor.stop();
    });

    it('should emit patternRegenerated event at cycle boundary', () => {
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

      const regeneratedSpy = vi.fn();
      executor.on('patternRegenerated', regeneratedSpy);

      executor.start();

      // Update parameters
      executor.updatePatternParameters('test-pattern', { pulses: 8 });

      // Advance clock to next cycle
      const ticksPerCycle = 96 * 4 * 1; // PPQ * beats/bar * bars
      for (let i = 0; i < ticksPerCycle + 10; i++) {
        clock.emit('tick', i);
      }

      // Should have emitted regenerated event at cycle boundary
      expect(regeneratedSpy).toHaveBeenCalled();

      executor.stop();
    });

    it('should throw error when updating non-existent pattern', () => {
      expect(() => {
        executor.updatePatternParameters('non-existent', { pulses: 8 });
      }).toThrow('Pattern non-existent not found');
    });

    it('should preserve generator state during update', () => {
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

      let callCount = 0;
      const generator: PatternGeneratorFn = () => {
        callCount++;
        return [];
      };

      executor.addPattern(pattern, generator);
      executor.start();

      // Execute pattern a few times
      for (let i = 0; i < 10; i++) {
        clock.emit('tick', i);
      }
      const callsBeforeUpdate = callCount;

      // Update parameters (should not reset generator)
      executor.updatePatternParameters('test-pattern', { pulses: 8 });

      // Execute pattern more times
      for (let i = 10; i < 20; i++) {
        clock.emit('tick', i);
      }

      // Generator should continue to be called
      expect(callCount).toBeGreaterThan(callsBeforeUpdate);

      executor.stop();
    });
  });

  describe('Pattern Execution', () => {
    it('should execute enabled patterns on tick', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        note: 60,
        channel: 1,
        parameters: { steps: 16, pulses: 4 }
      };

      const events: MidiEvent[] = [
        { tick: 0, type: 'noteOn', note: 60, velocity: 100 }
      ];
      const generator: PatternGeneratorFn = () => events;

      executor.addPattern(pattern, generator);

      const eventSpy = vi.fn();
      executor.on('event', eventSpy);

      executor.start();

      // Trigger a tick
      clock.emit('tick', 0);

      expect(eventSpy).toHaveBeenCalled();

      executor.stop();
    });

    it('should not execute disabled patterns', () => {
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

      const generator: PatternGeneratorFn = () => [
        { tick: 0, type: 'noteOn', note: 60, velocity: 100 }
      ];

      executor.addPattern(pattern, generator);

      const eventSpy = vi.fn();
      executor.on('event', eventSpy);

      executor.start();

      // Trigger a tick
      clock.emit('tick', 0);

      expect(eventSpy).not.toHaveBeenCalled();

      executor.stop();
    });

    it('should emit error event when pattern execution fails', () => {
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

      const generator: PatternGeneratorFn = () => {
        throw new Error('Pattern execution failed');
      };

      executor.addPattern(pattern, generator);

      const errorSpy = vi.fn();
      executor.on('error', errorSpy);

      executor.start();

      // Trigger a tick
      clock.emit('tick', 0);

      expect(errorSpy).toHaveBeenCalled();

      executor.stop();
    });
  });

  describe('Pattern Helpers', () => {
    it('should provide euclidean helper in context', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: {}
      };

      let capturedContext: any = null;
      const generator: PatternGeneratorFn = (context) => {
        capturedContext = context;
        return [];
      };

      executor.addPattern(pattern, generator);
      executor.start();

      clock.emit('tick', 0);

      expect(capturedContext).not.toBeNull();
      expect(capturedContext.helpers.euclidean).toBeDefined();

      const rhythm = capturedContext.helpers.euclidean(16, 4);
      expect(rhythm).toHaveLength(16);
      expect(rhythm.filter((x: boolean) => x).length).toBe(4);

      executor.stop();
    });

    it('should provide probability helper in context', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: {}
      };

      let capturedContext: any = null;
      const generator: PatternGeneratorFn = (context) => {
        capturedContext = context;
        return [];
      };

      executor.addPattern(pattern, generator);
      executor.start();

      clock.emit('tick', 0);

      expect(capturedContext.helpers.probability).toBeDefined();

      // 100% should always return true
      const alwaysTrue = capturedContext.helpers.probability(100);
      expect(alwaysTrue).toBe(true);

      // 0% should always return false
      const alwaysFalse = capturedContext.helpers.probability(0);
      expect(alwaysFalse).toBe(false);

      executor.stop();
    });

    it('should provide scale helper in context', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: {}
      };

      let capturedContext: any = null;
      const generator: PatternGeneratorFn = (context) => {
        capturedContext = context;
        return [];
      };

      executor.addPattern(pattern, generator);
      executor.start();

      clock.emit('tick', 0);

      expect(capturedContext.helpers.scale).toBeDefined();

      // C major scale (60 = C4)
      const note = capturedContext.helpers.scale(60, 'major');
      expect(note).toBe(60);

      executor.stop();
    });

    it('should provide quantize helper in context', () => {
      const pattern: PatternEntity = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: {}
      };

      let capturedContext: any = null;
      const generator: PatternGeneratorFn = (context) => {
        capturedContext = context;
        return [];
      };

      executor.addPattern(pattern, generator);
      executor.start();

      clock.emit('tick', 0);

      expect(capturedContext.helpers.quantize).toBeDefined();

      const quantized = capturedContext.helpers.quantize(17, 8);
      expect(quantized).toBe(16);

      executor.stop();
    });
  });

  describe('Statistics', () => {
    it('should return pattern IDs', () => {
      const pattern1: PatternEntity = {
        id: 'pattern-1',
        name: 'Pattern 1',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: { steps: 16, pulses: 4 }
      };

      const pattern2: PatternEntity = {
        id: 'pattern-2',
        name: 'Pattern 2',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: { steps: 16, pulses: 4 }
      };

      const generator: PatternGeneratorFn = () => [];

      executor.addPattern(pattern1, generator);
      executor.addPattern(pattern2, generator);

      const ids = executor.getPatternIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('pattern-1');
      expect(ids).toContain('pattern-2');
    });

    it('should return active pattern count', () => {
      const pattern1: PatternEntity = {
        id: 'pattern-1',
        name: 'Pattern 1',
        type: 'euclidean',
        enabled: true,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: { steps: 16, pulses: 4 }
      };

      const pattern2: PatternEntity = {
        id: 'pattern-2',
        name: 'Pattern 2',
        type: 'euclidean',
        enabled: false,
        length: 1,
        division: 4,
        bus: 'main',
        parameters: { steps: 16, pulses: 4 }
      };

      const generator: PatternGeneratorFn = () => [];

      executor.addPattern(pattern1, generator);
      executor.addPattern(pattern2, generator);

      expect(executor.getActivePatternCount()).toBe(1);
    });

    it('should clear all patterns', () => {
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
      const clearedSpy = vi.fn();
      executor.on('patternsCleared', clearedSpy);

      executor.addPattern(pattern, generator);
      executor.clearAll();

      expect(clearedSpy).toHaveBeenCalled();
      expect(executor.getPatternIds()).toHaveLength(0);
    });
  });
});
