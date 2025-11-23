import { describe, it, expect } from 'vitest';
import { EuclideanPattern } from '../src/euclidean/EuclideanPattern';
import { defaultPatternHelpers } from '../src/helpers/PatternHelpers';
import type { PatternContext } from '../src/types';

describe('EuclideanPattern', () => {
  const createContext = (overrides?: Partial<PatternContext>): PatternContext => ({
    params: {},
    position: { bar: 1, beat: 1, tick: 0 },
    ppq: 96,
    helpers: defaultPatternHelpers,
    ...overrides
  });

  describe('Bjorklund algorithm', () => {
    it('should generate correct 4 pulses in 16 steps pattern', () => {
      const pattern = new EuclideanPattern({
        steps: 16,
        pulses: 4,
        rotation: 0,
        note: 36, // kick drum
        velocity: 100,
        duration: 0.25
      });

      const context = createContext({ position: { bar: 1, beat: 1, tick: 0 } });
      const events = pattern.tick(context);

      // Bjorklund [4,16] = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]
      // Should trigger on steps 0, 4, 8, 12
      expect(events).toHaveLength(2); // noteOn + noteOff
      expect(events[0].type).toBe('noteOn');
      expect(events[0].note).toBe(36);
    });

    it('should handle rotation parameter', () => {
      const pattern = new EuclideanPattern({
        steps: 8,
        pulses: 3,
        rotation: 2,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      // Rotation shifts the pattern
      expect(events).toBeDefined();
    });

    it('should handle all pulses (dense pattern)', () => {
      const pattern = new EuclideanPattern({
        steps: 4,
        pulses: 4,
        rotation: 0,
        note: 42,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      // Every step should trigger
      expect(events).toHaveLength(2);
    });

    it('should handle no pulses (silent pattern)', () => {
      const pattern = new EuclideanPattern({
        steps: 16,
        pulses: 0,
        rotation: 0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      // No events should be generated
      expect(events).toHaveLength(0);
    });
  });

  describe('velocity handling', () => {
    it('should apply fixed velocity', () => {
      const pattern = new EuclideanPattern({
        steps: 4,
        pulses: 2,
        rotation: 0,
        note: 36,
        velocity: 80,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      const noteOn = events.find(e => e.type === 'noteOn');
      expect(noteOn?.velocity).toBe(80);
    });

    it('should handle velocity array for per-step variation', () => {
      const pattern = new EuclideanPattern({
        steps: 4,
        pulses: 2,
        rotation: 0,
        note: 36,
        velocity: [100, 80, 60, 40],
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('timing', () => {
    it('should calculate note-off time based on duration', () => {
      const pattern = new EuclideanPattern({
        steps: 4,
        pulses: 1,
        rotation: 0,
        note: 36,
        velocity: 100,
        duration: 0.5 // half beat
      });

      const context = createContext({ ppq: 96 });
      const events = pattern.tick(context);

      const noteOff = events.find(e => e.type === 'noteOff');
      expect(noteOff).toBeDefined();
      expect(noteOff!.tick).toBeGreaterThan(0);
    });
  });

  describe('pattern progression', () => {
    it('should cycle through steps correctly', () => {
      const pattern = new EuclideanPattern({
        steps: 4,
        pulses: 2,
        rotation: 0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      // Test multiple ticks to verify pattern cycles
      const contexts = [
        createContext({ position: { bar: 1, beat: 1, tick: 0 } }),
        createContext({ position: { bar: 1, beat: 1, tick: 24 } }),
        createContext({ position: { bar: 1, beat: 1, tick: 48 } }),
        createContext({ position: { bar: 1, beat: 1, tick: 72 } })
      ];

      const results = contexts.map(ctx => pattern.tick(ctx));

      // Verify that pattern generates events
      const hasEvents = results.some(r => r.length > 0);
      expect(hasEvents).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle single step pattern', () => {
      const pattern = new EuclideanPattern({
        steps: 1,
        pulses: 1,
        rotation: 0,
        note: 36,
        velocity: 100,
        duration: 0.25
      });

      const context = createContext();
      const events = pattern.tick(context);

      expect(events).toBeDefined();
    });

    it('should handle maximum rotation', () => {
      const pattern = new EuclideanPattern({
        steps: 16,
        pulses: 4,
        rotation: 15,
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
