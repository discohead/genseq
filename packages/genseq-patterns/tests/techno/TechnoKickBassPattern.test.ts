/**
 * TechnoKickBassPattern Tests
 *
 * Test-first development for kick/bass pattern generator (US1).
 * Tests written before implementation per Constitution II.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PatternContext, MidiEvent } from '../../src/types';
import { defaultPatternHelpers } from '../../src/helpers/PatternHelpers';
import {
  TechnoKickBassPattern,
  createTechnoKickBassPattern,
} from '../../src/techno/TechnoKickBassPattern';
import type { TechnoKickBassConfig } from '../../src/techno/types';
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
 * Get all events across multiple ticks
 */
function collectEvents(
  pattern: TechnoKickBassPattern,
  numTicks: number,
  ppq: number = 96
): MidiEvent[] {
  const events: MidiEvent[] = [];
  const ticksPerBeat = ppq;
  const ticksPerBar = ticksPerBeat * 4;

  for (let i = 0; i < numTicks; i++) {
    const bar = Math.floor(i / ticksPerBar) + 1;
    const beatTick = i % ticksPerBar;
    const beat = Math.floor(beatTick / ticksPerBeat) + 1;
    const tick = beatTick % ticksPerBeat;

    const ctx = createMockContext(bar, beat, tick, ppq);
    events.push(...pattern.tick(ctx));
  }

  return events;
}

describe('TechnoKickBassPattern', () => {
  let defaultConfig: TechnoKickBassConfig;

  beforeEach(() => {
    defaultConfig = { ...TECHNO_DEFAULTS.kickBass };
  });

  describe('Kick Generation (AC1.1, AC1.6)', () => {
    it('should trigger kick on every quarter note (beats 1,2,3,4)', () => {
      const pattern = new TechnoKickBassPattern({
        ...defaultConfig,
        bass: { ...defaultConfig.bass, enabled: false }, // disable bass for clarity
      });

      const ppq = 96;
      const ticksPerBar = ppq * 4; // 384 ticks per bar

      // Collect events for one bar
      const events = collectEvents(pattern, ticksPerBar, ppq);

      // Filter kick note-on events
      const kickEvents = events.filter(
        (e) =>
          e.type === 'noteOn' &&
          e.note === defaultConfig.kick.note &&
          e.channel === defaultConfig.kick.channel
      );

      // Should have exactly 4 kicks (one per beat)
      expect(kickEvents.length).toBe(4);
    });

    it('should apply accent velocity on beat 1', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: {
          ...defaultConfig.kick,
          velocity: 100,
          accentVelocity: 127,
        },
        bass: { ...defaultConfig.bass, enabled: false },
      };

      const pattern = new TechnoKickBassPattern(config);

      // Get event at beat 1
      const beat1Event = pattern.tick(createMockContext(1, 1, 0, 96));
      expect(beat1Event.length).toBeGreaterThan(0);

      const kickEvent = beat1Event.find(
        (e) => e.type === 'noteOn' && e.note === config.kick.note
      );
      expect(kickEvent).toBeDefined();
      expect(kickEvent!.velocity).toBe(127); // accent velocity
    });

    it('should use normal velocity on beats 2,3,4', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: {
          ...defaultConfig.kick,
          velocity: 100,
          accentVelocity: 127,
        },
        bass: { ...defaultConfig.bass, enabled: false },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;

      // Advance to beat 2 (tick 96)
      // Need to tick through to beat 2
      for (let i = 0; i < 96; i++) {
        pattern.tick(createMockContext(1, 1, i, ppq));
      }

      const beat2Event = pattern.tick(createMockContext(1, 2, 0, ppq));
      const kickEvent = beat2Event.find(
        (e) => e.type === 'noteOn' && e.note === config.kick.note
      );

      expect(kickEvent).toBeDefined();
      expect(kickEvent!.velocity).toBe(100); // normal velocity, not accent
    });

    it('should use configured kick note and channel', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: {
          ...defaultConfig.kick,
          note: 48,
          channel: 9,
        },
        bass: { ...defaultConfig.bass, enabled: false },
      };

      const pattern = new TechnoKickBassPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 0, 96));

      const kickEvent = events.find((e) => e.type === 'noteOn');
      expect(kickEvent).toBeDefined();
      expect(kickEvent!.note).toBe(48);
      expect(kickEvent!.channel).toBe(9);
    });

    it('should not trigger kick when disabled', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: { ...defaultConfig.bass, enabled: false },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;
      const events = collectEvents(pattern, ppq * 4, ppq);

      // No kick events should be generated
      const kickEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === defaultConfig.kick.note
      );
      expect(kickEvents.length).toBe(0);
    });
  });

  describe('Bass Generation (AC1.2, AC1.4, AC1.5)', () => {
    it('should trigger bass at syncopated positions between kicks', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false }, // disable kick for clarity
        bass: {
          ...defaultConfig.bass,
          syncopation: 2, // 2 sixteenth notes after kick
          notes: [36],
        },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;
      const ticksPerSixteenth = ppq / 4; // 24 ticks per 16th

      // Syncopation of 2 means bass triggers at tick 48 (2 x 24)
      // Advance to that point
      for (let i = 0; i < ticksPerSixteenth * 2; i++) {
        const bar = 1;
        const beat = 1;
        pattern.tick(createMockContext(bar, beat, i, ppq));
      }

      const bassEvent = pattern.tick(
        createMockContext(1, 1, ticksPerSixteenth * 2, ppq)
      );
      const bassNotes = bassEvent.filter(
        (e) =>
          e.type === 'noteOn' && e.channel === defaultConfig.bass.channel
      );

      expect(bassNotes.length).toBeGreaterThan(0);
    });

    it('should sequence through configured bass notes', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: {
          ...defaultConfig.bass,
          notes: [36, 38, 40, 41],
          syncopation: 0, // trigger on downbeat for simplicity
        },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;
      const ticksPerBeat = ppq;

      // Collect bass note-on events for 4 beats
      const bassNotes: number[] = [];

      for (let beat = 1; beat <= 4; beat++) {
        // Tick at the start of each beat
        const events = pattern.tick(createMockContext(1, beat, 0, ppq));
        const bassEvent = events.find(
          (e) =>
            e.type === 'noteOn' && e.channel === config.bass.channel
        );
        if (bassEvent && bassEvent.note !== undefined) {
          bassNotes.push(bassEvent.note);
        }

        // Advance through the rest of the beat
        for (let tick = 1; tick < ticksPerBeat; tick++) {
          pattern.tick(createMockContext(1, beat, tick, ppq));
        }
      }

      expect(bassNotes).toEqual([36, 38, 40, 41]);
    });

    it('should loop bass sequence when shorter than pattern (EC1.1)', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        length: 2, // 2 bars = 8 beats
        kick: { ...defaultConfig.kick, enabled: false },
        bass: {
          ...defaultConfig.bass,
          notes: [36, 38], // only 2 notes, should loop
          syncopation: 0,
        },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;
      const ticksPerBar = ppq * 4;

      // Collect all bass notes over 2 bars (8 beats)
      const bassNotes: number[] = [];

      for (let bar = 1; bar <= 2; bar++) {
        for (let beat = 1; beat <= 4; beat++) {
          const events = pattern.tick(createMockContext(bar, beat, 0, ppq));
          const bassEvent = events.find(
            (e) =>
              e.type === 'noteOn' && e.channel === config.bass.channel
          );
          if (bassEvent && bassEvent.note !== undefined) {
            bassNotes.push(bassEvent.note);
          }

          // Advance through the beat
          for (let tick = 1; tick < ppq; tick++) {
            pattern.tick(createMockContext(bar, beat, tick, ppq));
          }
        }
      }

      // Should loop: 36, 38, 36, 38, 36, 38, 36, 38
      expect(bassNotes).toEqual([36, 38, 36, 38, 36, 38, 36, 38]);
    });

    it('should not trigger bass when disabled', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: { ...defaultConfig.bass, enabled: false },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;
      const events = collectEvents(pattern, ppq * 4, ppq);

      expect(events.length).toBe(0);
    });
  });

  describe('Pattern Length (AC1.7)', () => {
    it('should support 1-bar patterns', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        length: 1,
      };

      const pattern = new TechnoKickBassPattern(config);
      expect(pattern.getLength()).toBe(1);
    });

    it('should support 2-bar patterns', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        length: 2,
      };

      const pattern = new TechnoKickBassPattern(config);
      expect(pattern.getLength()).toBe(2);
    });

    it('should support 4-bar patterns', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        length: 4,
      };

      const pattern = new TechnoKickBassPattern(config);
      expect(pattern.getLength()).toBe(4);
    });

    it('should loop pattern at bar boundary', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        length: 1,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: {
          ...defaultConfig.bass,
          notes: [36],
          syncopation: 0,
        },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;

      // Collect events for 2 bars
      const events = collectEvents(pattern, ppq * 4 * 2, ppq);

      // Should have same number of bass events in bar 1 and bar 2
      const bar1Events = events.filter(
        (e) =>
          e.type === 'noteOn' &&
          e.tick < ppq * 4 &&
          e.channel === config.bass.channel
      );
      const bar2Events = events.filter(
        (e) =>
          e.type === 'noteOn' &&
          e.tick >= ppq * 4 &&
          e.channel === config.bass.channel
      );

      expect(bar1Events.length).toBe(bar2Events.length);
    });
  });

  describe('Velocity Handling (AC1.6, EC1.3)', () => {
    it('should apply configured velocity values', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, velocity: 80 },
        bass: { ...defaultConfig.bass, velocity: 70, syncopation: 2 },
      };

      const pattern = new TechnoKickBassPattern(config);
      const kickEvent = pattern.tick(createMockContext(1, 1, 0, 96));

      const kick = kickEvent.find(
        (e) => e.type === 'noteOn' && e.channel === config.kick.channel
      );
      // Beat 1 uses accent velocity
      expect(kick!.velocity).toBe(config.kick.accentVelocity);
    });

    it('should create gaps when velocity is 0', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, velocity: 0 },
        bass: { ...defaultConfig.bass, enabled: false },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;

      // Beat 2 (not accent beat) should have velocity 0
      for (let i = 0; i < ppq; i++) {
        pattern.tick(createMockContext(1, 1, i, ppq));
      }
      const beat2Events = pattern.tick(createMockContext(1, 2, 0, ppq));

      // With velocity 0, we expect either no event or event with velocity 0
      const kickEvent = beat2Events.find(
        (e) => e.type === 'noteOn' && e.channel === config.kick.channel
      );

      if (kickEvent) {
        expect(kickEvent.velocity).toBe(0);
      }
    });
  });

  describe('Hot-Reload (AC1.8)', () => {
    it('should apply new configuration immediately', () => {
      const pattern = new TechnoKickBassPattern(defaultConfig);

      // Update kick note
      pattern.updateConfig({
        kick: { ...defaultConfig.kick, note: 48 },
      });

      const events = pattern.tick(createMockContext(1, 1, 0, 96));
      const kickEvent = events.find(
        (e) => e.type === 'noteOn' && e.channel === defaultConfig.kick.channel
      );

      expect(kickEvent?.note).toBe(48);
    });

    it('should maintain phase when parameters change', () => {
      const bassChannel = 2;
      const pattern = new TechnoKickBassPattern({
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: {
          ...defaultConfig.bass,
          notes: [36, 38, 40, 41],
          syncopation: 0,
          channel: bassChannel,
        },
      });

      const ppq = 96;

      // Advance to beat 3 (index 2 in sequence)
      for (let beat = 1; beat <= 2; beat++) {
        pattern.tick(createMockContext(1, beat, 0, ppq));
        for (let tick = 1; tick < ppq; tick++) {
          pattern.tick(createMockContext(1, beat, tick, ppq));
        }
      }

      // Change velocity but NOT notes - use partial update
      pattern.updateConfig({
        bass: { velocity: 50 } as any, // partial update, no notes array
      });

      // Next note should be 40 (3rd in sequence), not restart
      const events = pattern.tick(createMockContext(1, 3, 0, ppq));
      const bassNote = events.find(
        (e) => e.type === 'noteOn' && e.channel === bassChannel
      );

      expect(bassNote?.note).toBe(40);
    });
  });

  describe('Validation', () => {
    it('should throw error on invalid kick note', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, note: 200 },
      };

      expect(() => new TechnoKickBassPattern(config)).toThrow();
    });

    it('should throw error on invalid channel', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, channel: 17 },
      };

      expect(() => new TechnoKickBassPattern(config)).toThrow();
    });

    it('should throw error on empty bass notes array when bass enabled', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: { ...defaultConfig.bass, notes: [], enabled: true },
      };

      expect(() => new TechnoKickBassPattern(config)).toThrow();
    });

    it('should accept empty bass notes when bass disabled', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        bass: { ...defaultConfig.bass, notes: [], enabled: false },
      };

      expect(() => new TechnoKickBassPattern(config)).not.toThrow();
    });
  });

  describe('Lifecycle', () => {
    it('should reset to beginning correctly', () => {
      const pattern = new TechnoKickBassPattern({
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: {
          ...defaultConfig.bass,
          notes: [36, 38, 40, 41],
          syncopation: 0,
        },
      });

      const ppq = 96;

      // Advance several beats
      for (let beat = 1; beat <= 3; beat++) {
        pattern.tick(createMockContext(1, beat, 0, ppq));
        for (let tick = 1; tick < ppq; tick++) {
          pattern.tick(createMockContext(1, beat, tick, ppq));
        }
      }

      // Reset
      pattern.reset();

      // Should start from first note again
      const events = pattern.tick(createMockContext(1, 1, 0, ppq));
      const bassNote = events.find(
        (e) => e.type === 'noteOn' && e.channel === defaultConfig.bass.channel
      );

      expect(bassNote?.note).toBe(36);
    });

    it('should cleanup on destroy', () => {
      const pattern = new TechnoKickBassPattern(defaultConfig);
      expect(() => pattern.destroy()).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create working pattern generator function', () => {
      const generator = createTechnoKickBassPattern(defaultConfig);
      const ctx = createMockContext(1, 1, 0, 96);

      const events = generator(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    it('should return MidiEvent array on each call', () => {
      const generator = createTechnoKickBassPattern(defaultConfig);
      const ctx = createMockContext(1, 1, 0, 96);

      const events = generator(ctx);
      expect(events.every((e) => e.type === 'noteOn' || e.type === 'noteOff')).toBe(true);
    });
  });

  describe('MIDI Channel Assignment', () => {
    it('should use separate channels for kick and bass', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, note: 36, channel: 10 },
        bass: { ...defaultConfig.bass, notes: [48], channel: 1, syncopation: 0 }, // different note
      };

      const pattern = new TechnoKickBassPattern(config);
      const events = pattern.tick(createMockContext(1, 1, 0, 96));

      // Find by channel since both are noteOn
      const kickEvent = events.find(
        (e) => e.type === 'noteOn' && e.channel === 10
      );
      const bassEvent = events.find(
        (e) => e.type === 'noteOn' && e.channel === 1
      );

      expect(kickEvent).toBeDefined();
      expect(kickEvent?.note).toBe(36);
      expect(bassEvent).toBeDefined();
      expect(bassEvent?.note).toBe(48);
    });
  });

  describe('Note Duration', () => {
    it('should schedule note-off events based on bass duration', () => {
      const config: TechnoKickBassConfig = {
        ...defaultConfig,
        kick: { ...defaultConfig.kick, enabled: false },
        bass: {
          ...defaultConfig.bass,
          duration: 0.5, // half beat
          syncopation: 0,
        },
      };

      const pattern = new TechnoKickBassPattern(config);
      const ppq = 96;
      const events = pattern.tick(createMockContext(1, 1, 0, ppq));

      const noteOn = events.find((e) => e.type === 'noteOn');
      const noteOff = events.find((e) => e.type === 'noteOff');

      expect(noteOn).toBeDefined();
      expect(noteOff).toBeDefined();
      expect(noteOff!.tick - noteOn!.tick).toBe(ppq * 0.5); // 48 ticks
    });
  });
});
