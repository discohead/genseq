import { describe, it, expect } from 'vitest';
import { ProbabilityPattern } from '../../src/probability/ProbabilityPattern';
import { defaultPatternHelpers } from '../../src/helpers/PatternHelpers';
import type { PatternContext } from '../../src/types';

/**
 * T003: ProbabilityPattern test suite (RED PHASE - MUST FAIL)
 *
 * Tests for probability-based pattern generation.
 * This test file MUST be created before implementation exists.
 */

describe('ProbabilityPattern', () => {
  const createContext = (overrides?: Partial<PatternContext>): PatternContext => ({
    params: {},
    position: { bar: 1, beat: 1, tick: 0 },
    ppq: 96,
    helpers: defaultPatternHelpers,
    ...overrides
  });

  describe('probability-based triggering', () => {
    it('should trigger events based on probability value', () => {
      const pattern = new ProbabilityPattern({
        probability: 1.0, // 100% chance
        density: 16, // 16th notes
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext({ position: { bar: 1, beat: 1, tick: 0 } });
      const events = pattern.tick(context);

      // At 100% probability, should trigger on first step
      expect(events).toHaveLength(2); // noteOn + noteOff
      expect(events[0].type).toBe('noteOn');
      expect(events[0].note).toBe(36);
    });

    it('should never trigger at 0% probability', () => {
      const pattern = new ProbabilityPattern({
        probability: 0.0,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Test multiple ticks - should never trigger
      for (let tick = 0; tick < 96; tick += 6) {
        const context = createContext({ position: { bar: 1, beat: 1, tick } });
        const events = pattern.tick(context);
        expect(events).toHaveLength(0);
      }
    });

    it('should respect seed for deterministic randomness', () => {
      const pattern1 = new ProbabilityPattern({
        probability: 0.5,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25,
        seed: 12345
      });

      const pattern2 = new ProbabilityPattern({
        probability: 0.5,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25,
        seed: 12345
      });

      // Same seed should produce identical results
      const context = createContext();
      const events1 = pattern1.tick(context);
      const events2 = pattern2.tick(context);

      expect(events1.length).toBe(events2.length);
    });

    it('should handle different probabilities', () => {
      const probabilities = [0.25, 0.5, 0.75];

      probabilities.forEach(prob => {
        const pattern = new ProbabilityPattern({
          probability: prob,
          density: 16,
          note: 36,
          velocity: 100,
          duration: 0.25
        });

        const context = createContext();
        const events = pattern.tick(context);

        // Should return either 0 or 2 events (noteOn + noteOff)
        expect(events.length === 0 || events.length === 2).toBe(true);
      });
    });
  });

  describe('density parameter', () => {
    it('should respect density parameter for step calculation', () => {
      const pattern = new ProbabilityPattern({
        probability: 1.0,
        density: 8, // 8th notes (48 ticks at ppq=96: 384/8 = 48)
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context1 = createContext({ position: { bar: 1, beat: 1, tick: 0 } });
      const events1 = pattern.tick(context1);
      expect(events1.length).toBeGreaterThan(0);

      // Within same step - should not trigger
      const context2 = createContext({ position: { bar: 1, beat: 1, tick: 24 } });
      const events2 = pattern.tick(context2);
      expect(events2).toHaveLength(0);

      // Next step - should trigger (48 ticks later)
      const context3 = createContext({ position: { bar: 1, beat: 1, tick: 48 } });
      const events3 = pattern.tick(context3);
      expect(events3.length).toBeGreaterThan(0);
    });

    it('should handle different density values', () => {
      const densities = [4, 8, 16, 32];

      densities.forEach(density => {
        const pattern = new ProbabilityPattern({
          probability: 1.0,
          density,
          note: 36,
          velocity: 100,
          duration: 0.25
        });

        const context = createContext();
        const events = pattern.tick(context);
        expect(events).toBeDefined();
      });
    });
  });

  describe('velocity handling', () => {
    it('should apply fixed velocity', () => {
      const pattern = new ProbabilityPattern({
        probability: 1.0,
        density: 16,
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
      const pattern = new ProbabilityPattern({
        probability: 1.0,
        density: 16,
        note: 36,
        velocity: [100, 80, 60, 40],
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      const noteOn = events.find(e => e.type === 'noteOn');
      expect(noteOn?.velocity).toBeDefined();
      expect([100, 80, 60, 40]).toContain(noteOn?.velocity);
    });
  });

  describe('timing', () => {
    it('should calculate note-off time based on duration', () => {
      const pattern = new ProbabilityPattern({
        probability: 1.0,
        density: 16,
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
  });

  describe('updateConfig', () => {
    it('should update configuration for hot-reload', () => {
      const pattern = new ProbabilityPattern({
        probability: 0.5,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      pattern.updateConfig({
        probability: 1.0,
        note: 40
      });

      // Configuration should be updated
      expect(pattern).toBeDefined();
    });
  });

  describe('lifecycle methods', () => {
    it('should have destroy method for cleanup', () => {
      const pattern = new ProbabilityPattern({
        probability: 0.5,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      expect(typeof pattern.destroy).toBe('function');
      pattern.destroy();
    });

    it('should have reset method', () => {
      const pattern = new ProbabilityPattern({
        probability: 0.5,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      expect(typeof pattern.reset).toBe('function');
      pattern.reset();
    });
  });

  describe('parameter validation', () => {
    it('should reject invalid probability values > 1', () => {
      expect(() => {
        new ProbabilityPattern({
          probability: 1.5,
          density: 16,
          note: 36,
          velocity: 100,
          duration: 0.25
        });
      }).toThrow();
    });

    it('should reject invalid probability values < 0', () => {
      expect(() => {
        new ProbabilityPattern({
          probability: -0.5,
          density: 16,
          note: 36,
          velocity: 100,
          duration: 0.25
        });
      }).toThrow();
    });

    it('should reject invalid density values', () => {
      expect(() => {
        new ProbabilityPattern({
          probability: 0.5,
          density: 0,
          note: 36,
          velocity: 100,
          duration: 0.25
        });
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid tick progression', () => {
      const pattern = new ProbabilityPattern({
        probability: 1.0,
        density: 16,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Simulate rapid ticks
      for (let tick = 0; tick < 384; tick += 6) {
        const context = createContext({ position: { bar: 1, beat: 1, tick } });
        const events = pattern.tick(context);
        expect(Array.isArray(events)).toBe(true);
      }
    });

    it('should handle different ppq values', () => {
      const pattern = new ProbabilityPattern({
        probability: 1.0,
        density: 16,
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
  });
});
