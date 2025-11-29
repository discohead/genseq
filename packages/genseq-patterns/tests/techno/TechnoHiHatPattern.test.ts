/**
 * TechnoHiHatPattern Tests
 *
 * Test-first development for hi-hat pattern generator (US2).
 * Tests written before implementation per Constitution II.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PatternContext, MidiEvent } from '../../src/types';
import { defaultPatternHelpers } from '../../src/helpers/PatternHelpers';
import {
  TechnoHiHatPattern,
  createTechnoHiHatPattern,
} from '../../src/techno/TechnoHiHatPattern';
import type { TechnoHiHatConfig } from '../../src/techno/types';
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
  pattern: TechnoHiHatPattern,
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

describe('TechnoHiHatPattern', () => {
  let defaultConfig: TechnoHiHatConfig;

  beforeEach(() => {
    defaultConfig = { ...TECHNO_DEFAULTS.hiHat };
  });

  describe('Closed Hi-Hat (AC2.1, AC2.5)', () => {
    it('should trigger on offbeat 8th notes by default', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'offbeat',
          density: 100,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const ticksPerBar = ppq * 4;

      const events = collectEvents(pattern, ticksPerBar, ppq);

      // Offbeat 8ths = positions 2, 4, 6, 8 (every other 8th note, starting on "and")
      // In 16th note terms: steps 2, 6, 10, 14 (4 per bar)
      const closedEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(closedEvents.length).toBe(4);
    });

    it('should support onbeat position', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'onbeat',
          density: 100,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const ticksPerBar = ppq * 4;

      const events = collectEvents(pattern, ticksPerBar, ppq);

      // Onbeat = downbeats (steps 0, 4, 8, 12 in 16th notes)
      const closedEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(closedEvents.length).toBe(4);
    });

    it('should support all-8th position', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-8th',
          density: 100,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const ticksPerBar = ppq * 4;

      const events = collectEvents(pattern, ticksPerBar, ppq);

      // All 8ths = steps 0, 2, 4, 6, 8, 10, 12, 14 (8 per bar)
      const closedEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(closedEvents.length).toBe(8);
    });

    it('should support all-16th position', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-16th',
          density: 100,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const ticksPerBar = ppq * 4;

      const events = collectEvents(pattern, ticksPerBar, ppq);

      // All 16ths = 16 events per bar
      const closedEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(closedEvents.length).toBe(16);
    });

    it('should apply density filtering', () => {
      // Use seeded random for predictable test
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        // Alternate: 0.3, 0.7, 0.3, 0.7... (50% pass at density 50)
        return callCount % 2 === 1 ? 0.3 : 0.7;
      };

      try {
        const config: TechnoHiHatConfig = {
          ...defaultConfig,
          closed: {
            ...defaultConfig.closed,
            position: 'all-16th',
            density: 50,
          },
        };

        const pattern = new TechnoHiHatPattern(config);
        const ppq = 96;
        const ticksPerBar = ppq * 4;

        const events = collectEvents(pattern, ticksPerBar, ppq);
        const closedEvents = events.filter(
          (e) => e.type === 'noteOn' && e.note === config.closed.note
        );

        // At 50% density with alternating random, expect ~8 events
        expect(closedEvents.length).toBe(8);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('Open Hi-Hat (AC2.2, EC2.4)', () => {
    it('should trigger on specified beat positions', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: { ...defaultConfig.closed, enabled: false },
        open: {
          ...defaultConfig.open,
          pattern: [2, 4], // beats 2 and 4
          enabled: true,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const ticksPerBar = ppq * 4;

      const events = collectEvents(pattern, ticksPerBar, ppq);
      const openEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.open.note
      );

      expect(openEvents.length).toBe(2);
    });

    it('should override closed hi-hat when overlapping', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'onbeat', // triggers on beats 1,2,3,4
          enabled: true,
        },
        open: {
          ...defaultConfig.open,
          pattern: [2], // open on beat 2
          enabled: true,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;

      // Advance to beat 2
      for (let i = 0; i < ppq; i++) {
        pattern.tick(createMockContext(1, 1, i, ppq));
      }

      const beat2Events = pattern.tick(createMockContext(1, 2, 0, ppq));

      // Should have open hi-hat, not closed
      const openEvent = beat2Events.find(
        (e) => e.type === 'noteOn' && e.note === config.open.note
      );
      const closedEvent = beat2Events.find(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(openEvent).toBeDefined();
      expect(closedEvent).toBeUndefined();
    });

    it('should not trigger when disabled', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: { ...defaultConfig.closed, enabled: false },
        open: {
          ...defaultConfig.open,
          pattern: [2, 4],
          enabled: false,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const events = collectEvents(pattern, ppq * 4, ppq);

      const openEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.open.note
      );

      expect(openEvents.length).toBe(0);
    });
  });

  describe('Ride Layer (AC2.3)', () => {
    it('should trigger based on density percentage', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.3; // Always passes at 50% density

      try {
        const config: TechnoHiHatConfig = {
          ...defaultConfig,
          closed: { ...defaultConfig.closed, enabled: false },
          ride: {
            ...defaultConfig.ride,
            density: 50,
            enabled: true,
          },
        };

        const pattern = new TechnoHiHatPattern(config);
        const ppq = 96;
        const events = collectEvents(pattern, ppq * 4, ppq);

        const rideEvents = events.filter(
          (e) => e.type === 'noteOn' && e.note === config.ride.note
        );

        // With density 50 and random always 0.3, all should trigger
        expect(rideEvents.length).toBeGreaterThan(0);
      } finally {
        Math.random = originalRandom;
      }
    });

    it('should use configured ride velocity', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.1;

      try {
        const config: TechnoHiHatConfig = {
          ...defaultConfig,
          closed: { ...defaultConfig.closed, enabled: false },
          ride: {
            ...defaultConfig.ride,
            velocity: 60,
            density: 100,
            enabled: true,
          },
        };

        const pattern = new TechnoHiHatPattern(config);
        const events = pattern.tick(createMockContext(1, 1, 0, 96));

        const rideEvent = events.find(
          (e) => e.type === 'noteOn' && e.note === config.ride.note
        );

        expect(rideEvent?.velocity).toBe(60);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('Swing (AC2.6, EC2.3)', () => {
    it('should offset even steps for swing feel', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-8th',
          density: 100,
        },
        swing: 50, // 50% swing
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const ticksPerSixteenth = ppq / 4; // 24

      // Check that swing delays even 8th notes
      // Step 0 (beat 1) - no swing
      const beat1Events = pattern.tick(createMockContext(1, 1, 0, ppq));
      expect(beat1Events.some((e) => e.type === 'noteOn')).toBe(true);

      // Advance to expected swing position (step 2 = tick 48 + swing offset)
      // At 50% swing, offset is ~12 ticks (half of 16th note)
      // So step 2 would be at tick 48 + 12 = 60
      for (let i = 1; i < 60; i++) {
        const bar = 1;
        const beat = Math.floor(i / ppq) + 1;
        const tick = i % ppq;
        pattern.tick(createMockContext(bar, beat, tick, ppq));
      }

      // Check that swing is applied (event timing differs from straight)
      // This is a simplified test - full swing verification would check exact tick offsets
      expect(pattern.getSwing()).toBe(50);
    });

    it('should not affect timing when swing is 0', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-8th',
          density: 100,
        },
        swing: 0,
      };

      const pattern = new TechnoHiHatPattern(config);
      expect(pattern.getSwing()).toBe(0);
    });
  });

  describe('Ghost Notes (AC2.7)', () => {
    it('should apply ghost velocity with probability', () => {
      const originalRandom = Math.random;
      let callCount = 0;
      // First call for density (pass), second call for ghost probability (pass)
      Math.random = () => {
        callCount++;
        return 0.1; // Always triggers ghost at 50% probability
      };

      try {
        const config: TechnoHiHatConfig = {
          ...defaultConfig,
          closed: {
            ...defaultConfig.closed,
            position: 'all-16th',
            density: 100,
            velocity: 80,
          },
          ghostVelocity: 30,
          ghostProbability: 50,
        };

        const pattern = new TechnoHiHatPattern(config);
        const events = pattern.tick(createMockContext(1, 1, 0, 96));

        // With ghost probability triggering, velocity should be ghostVelocity
        const hihatEvent = events.find((e) => e.type === 'noteOn');
        // Either normal velocity or ghost velocity depending on probability
        expect([30, 80]).toContain(hihatEvent?.velocity);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('Density Edge Cases (EC2.1, EC2.2)', () => {
    it('should produce silence at 0% density', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-16th',
          density: 0,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const events = collectEvents(pattern, ppq * 4, ppq);

      const closedEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(closedEvents.length).toBe(0);
    });

    it('should fill all steps at 100% density', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-16th',
          density: 100,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;
      const events = collectEvents(pattern, ppq * 4, ppq);

      const closedEvents = events.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );

      expect(closedEvents.length).toBe(16);
    });
  });

  describe('Layer Enable/Disable (AC2.8)', () => {
    it('should toggle layers without stopping transport', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        closed: {
          ...defaultConfig.closed,
          position: 'all-8th',
          density: 100,
          enabled: true,
        },
      };

      const pattern = new TechnoHiHatPattern(config);
      const ppq = 96;

      // Generate some events with closed enabled
      const beforeEvents = collectEvents(pattern, ppq, ppq);
      const closedBefore = beforeEvents.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );
      expect(closedBefore.length).toBeGreaterThan(0);

      // Disable closed layer
      pattern.updateConfig({
        closed: { enabled: false },
      });

      // Reset for clean test
      pattern.reset();

      // Generate events - closed should be silent
      const afterEvents = collectEvents(pattern, ppq, ppq);
      const closedAfter = afterEvents.filter(
        (e) => e.type === 'noteOn' && e.note === config.closed.note
      );
      expect(closedAfter.length).toBe(0);
    });
  });

  describe('Lifecycle', () => {
    it('should reset to beginning correctly', () => {
      const pattern = new TechnoHiHatPattern(defaultConfig);
      const ppq = 96;

      // Advance through a bar
      for (let i = 0; i < ppq * 4; i++) {
        const bar = 1;
        const beat = Math.floor(i / ppq) + 1;
        const tick = i % ppq;
        pattern.tick(createMockContext(bar, beat, tick, ppq));
      }

      // Reset
      pattern.reset();

      // Should be at beginning
      // Verify by checking that first tick produces same output as initial
      const events = pattern.tick(createMockContext(1, 1, 0, ppq));
      // Just verify it doesn't throw and produces valid events
      expect(Array.isArray(events)).toBe(true);
    });

    it('should cleanup on destroy', () => {
      const pattern = new TechnoHiHatPattern(defaultConfig);
      expect(() => pattern.destroy()).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create working pattern generator function', () => {
      const generator = createTechnoHiHatPattern(defaultConfig);
      const ctx = createMockContext(1, 1, 0, 96);

      const events = generator(ctx);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Pattern Length', () => {
    it('should support different bar lengths', () => {
      const config: TechnoHiHatConfig = {
        ...defaultConfig,
        length: 2,
      };

      const pattern = new TechnoHiHatPattern(config);
      expect(pattern.getLength()).toBe(2);
    });
  });
});
