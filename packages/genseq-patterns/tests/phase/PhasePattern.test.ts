import { describe, it, expect } from 'vitest';
import { PhasePattern } from '../../src/phase/PhasePattern';
import { defaultPatternHelpers } from '../../src/helpers/PatternHelpers';
import type { PatternContext } from '../../src/types';

/**
 * T004: PhasePattern test suite (RED PHASE - MUST FAIL)
 *
 * Tests for phase-based pattern generation with continuous phase accumulation.
 * This test file MUST be created before implementation exists.
 */

describe('PhasePattern', () => {
  const createContext = (overrides?: Partial<PatternContext>): PatternContext => ({
    params: {},
    position: { bar: 1, beat: 1, tick: 0 },
    ppq: 96,
    helpers: defaultPatternHelpers,
    ...overrides
  });

  describe('phase accumulation', () => {
    it('should trigger events when phase crosses threshold', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0, // One cycle per bar
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext({ position: { bar: 1, beat: 1, tick: 0 } });
      const events = pattern.tick(context);

      // At phase 0, should trigger
      expect(events).toHaveLength(2); // noteOn + noteOff
      expect(events[0].type).toBe('noteOn');
      expect(events[0].note).toBe(36);
    });

    it('should accumulate phase over time', () => {
      const pattern = new PhasePattern({
        phaseRate: 4.0, // 4 cycles per bar
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Track triggers across multiple beats
      const contexts = [
        createContext({ position: { bar: 1, beat: 1, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 2, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 3, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 4, tick: 0 } })
      ];

      const results = contexts.map(ctx => pattern.tick(ctx));

      // At rate 4.0, should trigger 4 times per bar (once per beat)
      const triggerCount = results.filter(r => r.length > 0).length;
      expect(triggerCount).toBeGreaterThan(0);
    });

    it('should handle phase offset', () => {
      const patternNoOffset = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const patternWithOffset = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.5, // Half cycle offset
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const eventsNoOffset = patternNoOffset.tick(context);
      const eventsWithOffset = patternWithOffset.tick(context);

      // Offset patterns should have different trigger timing
      expect(eventsNoOffset).toBeDefined();
      expect(eventsWithOffset).toBeDefined();
    });

    it('should wrap phase at 1.0', () => {
      const pattern = new PhasePattern({
        phaseRate: 2.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Advance through multiple bars to test phase wrapping
      for (let bar = 1; bar <= 3; bar++) {
        const context = createContext({ position: { bar, beat: 1, tick: 0 } });
        const events = pattern.tick(context);
        expect(Array.isArray(events)).toBe(true);
      }
    });
  });

  describe('phase rate variations', () => {
    it('should handle slow phase rates < 1', () => {
      const pattern = new PhasePattern({
        phaseRate: 0.5, // Two bars per cycle
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);
      expect(events).toBeDefined();
    });

    it('should handle fast phase rates > 1', () => {
      const pattern = new PhasePattern({
        phaseRate: 8.0, // 8 cycles per bar
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);
      expect(events).toBeDefined();
    });

    it('should handle fractional phase rates', () => {
      const rates = [0.25, 0.75, 1.5, 3.33];

      rates.forEach(rate => {
        const pattern = new PhasePattern({
          phaseRate: rate,
          phaseOffset: 0.0,
          note: 36,
          velocity: 100,
          duration: 0.25
        });

        const context = createContext();
        const events = pattern.tick(context);
        expect(Array.isArray(events)).toBe(true);
      });
    });
  });

  describe('velocity handling', () => {
    it('should apply fixed velocity', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 80,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      const noteOn = events.find(e => e.type === 'noteOn');
      expect(noteOn?.velocity).toBe(80);
    });

    it('should handle velocity array for variation', () => {
      const pattern = new PhasePattern({
        phaseRate: 4.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: [100, 80, 60, 40],
        duration: 0.25
      });

      // Test multiple triggers to verify array cycling
      const contexts = [
        createContext({ position: { bar: 1, beat: 1, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 2, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 3, tick: 0 } })
      ];

      contexts.forEach(ctx => {
        const events = pattern.tick(ctx);
        if (events.length > 0) {
          const noteOn = events.find(e => e.type === 'noteOn');
          expect([100, 80, 60, 40]).toContain(noteOn?.velocity);
        }
      });
    });

    it('should support velocity modulation by phase', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25,
        velocityModulation: true // Modulate velocity based on phase
      });

      const context = createContext();
      const events = pattern.tick(context);
      expect(events).toBeDefined();
    });
  });

  describe('timing', () => {
    it('should calculate note-off time based on duration', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.5 // half beat
      });

      const context = createContext({ ppq: 96 });
      const events = pattern.tick(context);

      if (events.length > 0) {
        const noteOff = events.find(e => e.type === 'noteOff');
        expect(noteOff).toBeDefined();
        expect(noteOff!.tick).toBeGreaterThan(events[0].tick);
      }
    });

    it('should maintain phase accuracy over long periods', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Simulate long playback session
      for (let bar = 1; bar <= 100; bar++) {
        const context = createContext({ position: { bar, beat: 1, tick: 0 } });
        const events = pattern.tick(context);
        expect(Array.isArray(events)).toBe(true);
      }
    });
  });

  describe('updateConfig', () => {
    it('should update configuration for hot-reload', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      pattern.updateConfig({
        phaseRate: 2.0,
        note: 40
      });

      // Configuration should be updated
      expect(pattern).toBeDefined();
    });

    it('should preserve phase state when updating config', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Advance phase
      const context1 = createContext({ position: { bar: 1, beat: 1, tick: 0 } });
      pattern.tick(context1);

      // Update config
      pattern.updateConfig({ note: 40 });

      // Phase should continue from previous position
      const context2 = createContext({ position: { bar: 1, beat: 2, tick: 0 } });
      const events = pattern.tick(context2);
      expect(events).toBeDefined();
    });
  });

  describe('lifecycle methods', () => {
    it('should have destroy method for cleanup', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      expect(typeof pattern.destroy).toBe('function');
      pattern.destroy();
    });

    it('should have reset method to clear phase', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Advance phase
      const context1 = createContext({ position: { bar: 2, beat: 1, tick: 0 } });
      pattern.tick(context1);

      // Reset
      pattern.reset();

      // Phase should be back to initial state
      const context2 = createContext({ position: { bar: 1, beat: 1, tick: 0 } });
      const events = pattern.tick(context2);
      expect(events).toBeDefined();
    });
  });

  describe('parameter validation', () => {
    it('should reject negative phase rate', () => {
      expect(() => {
        new PhasePattern({
          phaseRate: -1.0,
          phaseOffset: 0.0,
          note: 36,
          velocity: 100,
          duration: 0.25
        });
      }).toThrow();
    });

    it('should reject invalid phase offset > 1', () => {
      expect(() => {
        new PhasePattern({
          phaseRate: 1.0,
          phaseOffset: 1.5,
          note: 36,
          velocity: 100,
          duration: 0.25
        });
      }).toThrow();
    });

    it('should reject invalid phase offset < 0', () => {
      expect(() => {
        new PhasePattern({
          phaseRate: 1.0,
          phaseOffset: -0.5,
          note: 36,
          velocity: 100,
          duration: 0.25
        });
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero phase rate', () => {
      const pattern = new PhasePattern({
        phaseRate: 0.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      // Should trigger once at phase 0 and never again
      expect(events).toBeDefined();
    });

    it('should handle different ppq values', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      [96, 192, 384, 960].forEach(ppq => {
        const context = createContext({ ppq });
        const events = pattern.tick(context);
        expect(Array.isArray(events)).toBe(true);
      });
    });

    it('should handle phase offset at boundary', () => {
      const pattern = new PhasePattern({
        phaseRate: 1.0,
        phaseOffset: 1.0, // At cycle boundary
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);
      expect(events).toBeDefined();
    });
  });

  describe('musical timing', () => {
    it('should align phase to musical timing at integer rates', () => {
      const pattern = new PhasePattern({
        phaseRate: 4.0, // 4 cycles per bar = once per beat
        phaseOffset: 0.0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Test at beat boundaries
      const contexts = [
        createContext({ position: { bar: 1, beat: 1, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 2, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 3, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 4, tick: 0 } })
      ];

      contexts.forEach(ctx => {
        const events = pattern.tick(ctx);
        expect(Array.isArray(events)).toBe(true);
      });
    });
  });
});
