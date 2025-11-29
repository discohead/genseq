/**
 * TechnoChordPattern Tests
 *
 * Test-first development for chord stab pattern generator (US3).
 * Tests written before implementation per Constitution II.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { PatternContext } from '../../src/types';
import { defaultPatternHelpers } from '../../src/helpers/PatternHelpers';
import { TechnoChordPattern, createTechnoChordPattern } from '../../src/techno/TechnoChordPattern';
import type { TechnoChordConfig } from '../../src/techno/types';
import { TECHNO_DEFAULTS } from '../../src/techno/types';

/**
 * Create a mock PatternContext for testing
 */
function createMockContext(
  bar: number = 1,
  beat: number = 1,
  tick: number = 0,
  ppq: number = 96
): PatternContext {
  return {
    params: {},
    position: { bar, beat, tick },
    ppq,
    helpers: defaultPatternHelpers,
  };
}

/**
 * Default config for tests
 */
const defaultConfig: TechnoChordConfig = {
  ...TECHNO_DEFAULTS.chord,
};

describe('TechnoChordPattern', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Chord Voicing (AC3.1, AC3.4, AC3.5)', () => {
    it('should generate 3-note chords by default', () => {
      const pattern = new TechnoChordPattern(defaultConfig);
      // Position 3 (1-indexed) = step 2 (0-indexed) at beat 1, tick 48
      const context = createMockContext(1, 1, 48); // step 2 = position 3
      const events = pattern.tick(context);

      // Should have 3 noteOn and 3 noteOff events
      const noteOnEvents = events.filter(e => e.type === 'noteOn');
      expect(noteOnEvents).toHaveLength(3);
    });

    it('should support 2-4 note chords', () => {
      // Test 2 notes
      const config2: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, notes: 2 },
      };
      const pattern2 = new TechnoChordPattern(config2);
      const context = createMockContext(1, 1, 48);
      const events2 = pattern2.tick(context);
      expect(events2.filter(e => e.type === 'noteOn')).toHaveLength(2);

      // Test 4 notes
      const config4: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, notes: 4 },
      };
      const pattern4 = new TechnoChordPattern(config4);
      const events4 = pattern4.tick(createMockContext(1, 1, 48));
      expect(events4.filter(e => e.type === 'noteOn')).toHaveLength(4);
    });

    it('should apply chord inversions correctly', () => {
      // Inversion 0: root position
      const config0: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, inversion: 0, notes: 3, root: 60, spread: 4 },
      };
      const pattern0 = new TechnoChordPattern(config0);
      const context = createMockContext(1, 1, 48);
      const events0 = pattern0.tick(context);
      const notes0 = events0.filter(e => e.type === 'noteOn').map(e => e.note).sort((a, b) => a - b);

      // Inversion 1: first note goes up an octave
      const config1: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, inversion: 1, notes: 3, root: 60, spread: 4 },
      };
      const pattern1 = new TechnoChordPattern(config1);
      const events1 = pattern1.tick(createMockContext(1, 1, 48));
      const notes1 = events1.filter(e => e.type === 'noteOn').map(e => e.note).sort((a, b) => a - b);

      // Inversion should change the note arrangement
      expect(notes0).not.toEqual(notes1);
    });

    it('should respect spread parameter', () => {
      // Small spread (2 semitones)
      const configSmall: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, spread: 2, notes: 3, root: 60 },
      };
      const patternSmall = new TechnoChordPattern(configSmall);
      const eventsSmall = patternSmall.tick(createMockContext(1, 1, 48));
      const notesSmall = eventsSmall.filter(e => e.type === 'noteOn').map(e => e.note).sort((a, b) => a - b);

      // Large spread (7 semitones)
      const configLarge: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, spread: 7, notes: 3, root: 60 },
      };
      const patternLarge = new TechnoChordPattern(configLarge);
      const eventsLarge = patternLarge.tick(createMockContext(1, 1, 48));
      const notesLarge = eventsLarge.filter(e => e.type === 'noteOn').map(e => e.note).sort((a, b) => a - b);

      // Larger spread should produce wider note range
      const rangeSmall = notesSmall[notesSmall.length - 1] - notesSmall[0];
      const rangeLarge = notesLarge[notesLarge.length - 1] - notesLarge[0];
      expect(rangeLarge).toBeGreaterThan(rangeSmall);
    });

    it('should degrade to monophonic for single note (EC3.1)', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, notes: 1 },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const noteOnEvents = events.filter(e => e.type === 'noteOn');
      expect(noteOnEvents).toHaveLength(1);
    });

    it('should clamp notes count to valid range', () => {
      // Test with 0 notes (should clamp to 1)
      const config: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, notes: 0 },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const noteOnEvents = events.filter(e => e.type === 'noteOn');
      expect(noteOnEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scale Quantization (AC3.7)', () => {
    it('should quantize chord notes to configured scale', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, root: 60, scale: 'minor' },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const notes = events.filter(e => e.type === 'noteOn').map(e => e.note);

      // Minor scale from C: C, D, Eb, F, G, Ab, Bb = 0, 2, 3, 5, 7, 8, 10 semitones
      const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
      for (const note of notes) {
        const semitone = (note - 60 + 120) % 12;
        expect(minorIntervals).toContain(semitone);
      }
    });

    it('should use configured root note', () => {
      // Root at D4 (62)
      const config: TechnoChordConfig = {
        ...defaultConfig,
        voicing: { ...defaultConfig.voicing, root: 62, scale: 'major' },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const notes = events.filter(e => e.type === 'noteOn').map(e => e.note);

      // All notes should relate to D (root = 62)
      expect(notes.length).toBeGreaterThan(0);
    });

    it('should support multiple scale types', () => {
      const scales = ['major', 'minor', 'dorian', 'phrygian'];
      for (const scale of scales) {
        const config: TechnoChordConfig = {
          ...defaultConfig,
          voicing: { ...defaultConfig.voicing, scale },
        };
        const pattern = new TechnoChordPattern(config);
        const events = pattern.tick(createMockContext(1, 1, 48));
        expect(events.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);
      }
    });
  });

  describe('Rhythm (AC3.2, AC3.3, AC3.8)', () => {
    it('should trigger on configured sparse positions', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        rhythm: { ...defaultConfig.rhythm, positions: [1, 5, 9], density: 100 },
      };
      const pattern = new TechnoChordPattern(config);

      // Position 1 = step 0 = bar 1, beat 1, tick 0
      const events1 = pattern.tick(createMockContext(1, 1, 0));
      expect(events1.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);

      // Reset for clean state
      pattern.reset();

      // Position 2 should NOT trigger (only 1, 5, 9 are active)
      const events2 = pattern.tick(createMockContext(1, 1, 24)); // step 1
      expect(events2.filter(e => e.type === 'noteOn')).toHaveLength(0);
    });

    it('should apply density probability per position', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        rhythm: { ...defaultConfig.rhythm, density: 50 },
      };
      const pattern = new TechnoChordPattern(config);

      // With random mocked to 0.5, density 50% should pass
      vi.spyOn(Math, 'random').mockReturnValue(0.4); // Below 50%
      const events = pattern.tick(createMockContext(1, 1, 48));
      expect(events.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);

      pattern.reset();

      // With random above threshold, should not trigger
      vi.spyOn(Math, 'random').mockReturnValue(0.6); // Above 50%
      const events2 = pattern.tick(createMockContext(1, 1, 48));
      expect(events2.filter(e => e.type === 'noteOn')).toHaveLength(0);
    });

    it('should apply syncopation offset', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        rhythm: { ...defaultConfig.rhythm, positions: [1], syncopation: 12 }, // 12 ticks offset
      };
      const pattern = new TechnoChordPattern(config);

      // Position 1 without syncopation would be tick 0
      // With syncopation 12, the event tick should be offset
      const events = pattern.tick(createMockContext(1, 1, 0));
      if (events.length > 0) {
        const noteOn = events.find(e => e.type === 'noteOn');
        expect(noteOn?.tick).toBe(12); // Should be offset by syncopation
      }
    });

    it('should produce empty pattern when no positions configured', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        rhythm: { ...defaultConfig.rhythm, positions: [] },
      };
      const pattern = new TechnoChordPattern(config);

      // Run through multiple positions
      for (let step = 0; step < 32; step++) {
        const tick = step * 24; // 24 ticks per 16th at 96 PPQ
        const beat = Math.floor(tick / 96) + 1;
        const tickInBeat = tick % 96;
        const events = pattern.tick(createMockContext(1, beat, tickInBeat));
        expect(events.filter(e => e.type === 'noteOn')).toHaveLength(0);
      }
    });

    it('should produce empty events at 0% density', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        rhythm: { ...defaultConfig.rhythm, density: 0 },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      expect(events.filter(e => e.type === 'noteOn')).toHaveLength(0);
    });
  });

  describe('Velocity Curve (AC3.6)', () => {
    it('should apply flat velocity curve', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        velocityCurve: 'flat',
        velocity: 100,
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const noteOns = events.filter(e => e.type === 'noteOn');

      // All notes should have same velocity
      for (const event of noteOns) {
        expect(event.velocity).toBe(100);
      }
    });

    it('should apply decay velocity curve', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        velocityCurve: 'decay',
        velocity: 100,
        voicing: { ...defaultConfig.voicing, notes: 3 },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const noteOns = events.filter(e => e.type === 'noteOn');

      // Higher notes should have lower velocity (decay from bass to treble)
      const sorted = [...noteOns].sort((a, b) => a.note - b.note);
      if (sorted.length >= 2) {
        expect(sorted[0].velocity).toBeGreaterThanOrEqual(sorted[sorted.length - 1].velocity);
      }
    });

    it('should apply accent-first velocity curve', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        velocityCurve: 'accent-first',
        velocity: 100,
        voicing: { ...defaultConfig.voicing, notes: 3 },
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));
      const noteOns = events.filter(e => e.type === 'noteOn');

      // First note (lowest) should have highest velocity
      const sorted = [...noteOns].sort((a, b) => a.note - b.note);
      if (sorted.length >= 2) {
        expect(sorted[0].velocity).toBeGreaterThanOrEqual(sorted[sorted.length - 1].velocity);
      }
    });
  });

  describe('Duration', () => {
    it('should use configured note duration', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        duration: 0.25, // Quarter of a beat = 24 ticks at 96 PPQ
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));

      const noteOn = events.find(e => e.type === 'noteOn');
      const noteOff = events.find(e => e.type === 'noteOff' && e.note === noteOn?.note);

      if (noteOn && noteOff) {
        const duration = noteOff.tick - noteOn.tick;
        expect(duration).toBe(24); // 0.25 * 96 = 24 ticks
      }
    });
  });

  describe('Hot-Reload', () => {
    it('should apply new configuration', () => {
      const pattern = new TechnoChordPattern(defaultConfig);

      // Get initial events
      const events1 = pattern.tick(createMockContext(1, 1, 48));
      const noteCount1 = events1.filter(e => e.type === 'noteOn').length;

      pattern.reset();

      // Update to 4-note chords
      pattern.updateConfig({
        voicing: { notes: 4 } as any,
      });

      const events2 = pattern.tick(createMockContext(1, 1, 48));
      const noteCount2 = events2.filter(e => e.type === 'noteOn').length;

      expect(noteCount2).toBe(4);
      expect(noteCount2).toBeGreaterThan(noteCount1);
    });

    it('should preserve non-updated fields', () => {
      const pattern = new TechnoChordPattern({
        ...defaultConfig,
        velocity: 80,
      });

      pattern.updateConfig({
        voicing: { notes: 2 } as any,
      });

      // Velocity should still be 80
      const events = pattern.tick(createMockContext(1, 1, 48));
      const noteOn = events.find(e => e.type === 'noteOn');
      expect(noteOn?.velocity).toBe(80);
    });
  });

  describe('Lifecycle', () => {
    it('should reset to beginning correctly', () => {
      const pattern = new TechnoChordPattern(defaultConfig);

      // Trigger some events
      pattern.tick(createMockContext(1, 1, 48));

      // Reset
      pattern.reset();

      // Should be able to trigger again at same position
      const events = pattern.tick(createMockContext(1, 1, 48));
      expect(events.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);
    });

    it('should cleanup on destroy', () => {
      const pattern = new TechnoChordPattern(defaultConfig);
      expect(() => pattern.destroy()).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create working pattern generator function', () => {
      const generator = createTechnoChordPattern(defaultConfig);
      expect(typeof generator).toBe('function');

      const events = generator(createMockContext(1, 1, 48));
      expect(events.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);
    });
  });

  describe('MIDI Output', () => {
    it('should use configured channel', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        channel: 5,
      };
      const pattern = new TechnoChordPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 48));

      for (const event of events) {
        expect(event.channel).toBe(5);
      }
    });

    it('should generate noteOn and noteOff pairs', () => {
      const pattern = new TechnoChordPattern(defaultConfig);
      const events = pattern.tick(createMockContext(1, 1, 48));

      const noteOns = events.filter(e => e.type === 'noteOn');
      const noteOffs = events.filter(e => e.type === 'noteOff');

      expect(noteOns.length).toBe(noteOffs.length);

      // Each noteOn should have a matching noteOff
      for (const on of noteOns) {
        const off = noteOffs.find(e => e.note === on.note);
        expect(off).toBeDefined();
      }
    });
  });

  describe('Pattern Length', () => {
    it('should loop pattern based on configured length', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        length: 2,
        rhythm: { ...defaultConfig.rhythm, positions: [1] },
      };
      const pattern = new TechnoChordPattern(config);

      // Position 1 in bar 1
      const events1 = pattern.tick(createMockContext(1, 1, 0));
      expect(events1.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);

      pattern.reset();

      // Position 1 in bar 3 should also trigger (pattern loops every 2 bars)
      const events3 = pattern.tick(createMockContext(3, 1, 0));
      expect(events3.filter(e => e.type === 'noteOn').length).toBeGreaterThan(0);
    });

    it('should report correct length', () => {
      const config: TechnoChordConfig = {
        ...defaultConfig,
        length: 4,
      };
      const pattern = new TechnoChordPattern(config);
      expect(pattern.getLength()).toBe(4);
    });
  });
});
