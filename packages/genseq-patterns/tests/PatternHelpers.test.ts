import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PatternHelperImpl, defaultPatternHelpers } from '../src/helpers/PatternHelpers';

/**
 * PatternHelpers Tests
 *
 * Tests for Euclidean rhythm generation, probability, scale quantization,
 * and value quantization utilities
 */

describe('PatternHelpers - Euclidean Rhythms', () => {
  let helpers: PatternHelperImpl;

  beforeEach(() => {
    helpers = new PatternHelperImpl();
  });

  describe('Basic Patterns', () => {
    it('should generate 4-of-16 pattern (classic kick)', () => {
      const pattern = helpers.euclidean(16, 4);

      expect(pattern).toHaveLength(16);
      expect(pattern.filter(p => p).length).toBe(4);
    });

    it('should generate 3-of-8 pattern (tresillo)', () => {
      const pattern = helpers.euclidean(8, 3);

      expect(pattern).toHaveLength(8);
      expect(pattern.filter(p => p).length).toBe(3);
    });

    it('should generate 5-of-8 pattern (cinquillo)', () => {
      const pattern = helpers.euclidean(8, 5);

      expect(pattern).toHaveLength(8);
      expect(pattern.filter(p => p).length).toBe(5);
    });

    it('should generate 5-of-13 pattern', () => {
      const pattern = helpers.euclidean(13, 5);

      expect(pattern).toHaveLength(13);
      expect(pattern.filter(p => p).length).toBe(5);
    });

    it('should generate 7-of-12 pattern', () => {
      const pattern = helpers.euclidean(12, 7);

      expect(pattern).toHaveLength(12);
      expect(pattern.filter(p => p).length).toBe(7);
    });

    it('should generate 2-of-5 pattern', () => {
      const pattern = helpers.euclidean(5, 2);

      expect(pattern).toHaveLength(5);
      expect(pattern.filter(p => p).length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should generate all-false pattern for 0 pulses', () => {
      const pattern = helpers.euclidean(16, 0);

      expect(pattern).toHaveLength(16);
      expect(pattern.every(p => !p)).toBe(true);
    });

    it('should generate all-true pattern when pulses equals steps', () => {
      const pattern = helpers.euclidean(8, 8);

      expect(pattern).toHaveLength(8);
      expect(pattern.every(p => p)).toBe(true);
    });

    it('should generate single pulse pattern', () => {
      const pattern = helpers.euclidean(8, 1);

      expect(pattern).toHaveLength(8);
      expect(pattern.filter(p => p).length).toBe(1);
      expect(pattern[0]).toBe(true);
    });

    it('should handle steps - 1 pulses', () => {
      const pattern = helpers.euclidean(8, 7);

      expect(pattern).toHaveLength(8);
      expect(pattern.filter(p => p).length).toBe(7);
    });
  });

  describe('Distribution Evenness', () => {
    it('should distribute 4 pulses evenly across 16 steps', () => {
      const pattern = helpers.euclidean(16, 4);

      // Expected: pulses at positions 0, 4, 8, 12 (every 4 steps)
      expect(pattern[0]).toBe(true);
      expect(pattern[4]).toBe(true);
      expect(pattern[8]).toBe(true);
      expect(pattern[12]).toBe(true);
    });

    it('should distribute 2 pulses evenly across 8 steps', () => {
      const pattern = helpers.euclidean(8, 2);

      // Expected: pulses at positions 0 and 4
      expect(pattern[0]).toBe(true);
      expect(pattern[4]).toBe(true);
    });

    it('should distribute 3 pulses across 8 steps', () => {
      const pattern = helpers.euclidean(8, 3);

      // Should have roughly even spacing
      expect(pattern[0]).toBe(true);
      // The other 2 pulses should be roughly evenly distributed
      const pulseIndices = pattern.map((p, i) => p ? i : -1).filter(i => i >= 0);
      expect(pulseIndices).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for zero steps', () => {
      expect(() => helpers.euclidean(0, 0)).toThrow('Invalid Euclidean parameters');
    });

    it('should throw error for negative steps', () => {
      expect(() => helpers.euclidean(-5, 2)).toThrow('Invalid Euclidean parameters');
    });

    it('should throw error for negative pulses', () => {
      expect(() => helpers.euclidean(8, -1)).toThrow('Invalid Euclidean parameters');
    });

    it('should throw error for pulses greater than steps', () => {
      expect(() => helpers.euclidean(8, 10)).toThrow('Invalid Euclidean parameters');
    });
  });
});

describe('PatternHelpers - Probability', () => {
  let helpers: PatternHelperImpl;

  beforeEach(() => {
    helpers = new PatternHelperImpl();
  });

  describe('Boundary Values', () => {
    it('should always return false for 0% probability', () => {
      // Run multiple times to ensure consistency
      for (let i = 0; i < 100; i++) {
        expect(helpers.probability(0)).toBe(false);
      }
    });

    it('should always return true for 100% probability', () => {
      // Run multiple times to ensure consistency
      for (let i = 0; i < 100; i++) {
        expect(helpers.probability(100)).toBe(true);
      }
    });
  });

  describe('Statistical Distribution', () => {
    it('should return ~50% true for 50% probability', () => {
      const trials = 1000;
      let trueCount = 0;

      for (let i = 0; i < trials; i++) {
        if (helpers.probability(50)) {
          trueCount++;
        }
      }

      const percentage = (trueCount / trials) * 100;
      // Allow 10% tolerance for statistical variance
      expect(percentage).toBeGreaterThan(40);
      expect(percentage).toBeLessThan(60);
    });

    it('should return ~25% true for 25% probability', () => {
      const trials = 1000;
      let trueCount = 0;

      for (let i = 0; i < trials; i++) {
        if (helpers.probability(25)) {
          trueCount++;
        }
      }

      const percentage = (trueCount / trials) * 100;
      // Allow 10% tolerance
      expect(percentage).toBeGreaterThan(15);
      expect(percentage).toBeLessThan(35);
    });

    it('should return ~75% true for 75% probability', () => {
      const trials = 1000;
      let trueCount = 0;

      for (let i = 0; i < trials; i++) {
        if (helpers.probability(75)) {
          trueCount++;
        }
      }

      const percentage = (trueCount / trials) * 100;
      // Allow 10% tolerance
      expect(percentage).toBeGreaterThan(65);
      expect(percentage).toBeLessThan(85);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for negative probability', () => {
      expect(() => helpers.probability(-10)).toThrow('Probability must be between 0 and 100');
    });

    it('should throw error for probability over 100', () => {
      expect(() => helpers.probability(150)).toThrow('Probability must be between 0 and 100');
    });
  });

  describe('Mock Random for Deterministic Tests', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when random is below threshold', () => {
      (Math.random as ReturnType<typeof vi.fn>).mockReturnValue(0.3);
      expect(helpers.probability(50)).toBe(true); // 30 < 50
    });

    it('should return false when random is above threshold', () => {
      (Math.random as ReturnType<typeof vi.fn>).mockReturnValue(0.7);
      expect(helpers.probability(50)).toBe(false); // 70 >= 50
    });

    it('should return false when random equals threshold', () => {
      (Math.random as ReturnType<typeof vi.fn>).mockReturnValue(0.5);
      expect(helpers.probability(50)).toBe(false); // 50 is not less than 50
    });
  });
});

describe('PatternHelpers - Scale Quantization', () => {
  let helpers: PatternHelperImpl;

  beforeEach(() => {
    helpers = new PatternHelperImpl();
  });

  describe('Major Scale', () => {
    it('should quantize to major scale notes', () => {
      // C4 = 60, Major scale: C D E F G A B
      expect(helpers.scale(60, 'major')).toBe(60); // C -> C
      expect(helpers.scale(61, 'major')).toBe(60); // C# -> C (closest)
      expect(helpers.scale(62, 'major')).toBe(62); // D -> D
      expect(helpers.scale(63, 'major')).toBe(62); // D# -> D (closest)
      expect(helpers.scale(64, 'major')).toBe(64); // E -> E
      expect(helpers.scale(65, 'major')).toBe(65); // F -> F
      expect(helpers.scale(66, 'major')).toBe(65); // F# -> F (closest)
      expect(helpers.scale(67, 'major')).toBe(67); // G -> G
      expect(helpers.scale(68, 'major')).toBe(67); // G# -> G (closest)
      expect(helpers.scale(69, 'major')).toBe(69); // A -> A
      expect(helpers.scale(70, 'major')).toBe(69); // A# -> A (closest)
      expect(helpers.scale(71, 'major')).toBe(71); // B -> B
    });

    it('should handle octave boundaries', () => {
      // C3 = 48
      expect(helpers.scale(48, 'major')).toBe(48);
      // C5 = 72
      expect(helpers.scale(72, 'major')).toBe(72);
    });

    it('should be case-insensitive', () => {
      expect(helpers.scale(60, 'MAJOR')).toBe(60);
      expect(helpers.scale(60, 'Major')).toBe(60);
    });
  });

  describe('Minor Scale', () => {
    it('should quantize to minor scale notes', () => {
      // C minor: C D Eb F G Ab Bb
      expect(helpers.scale(60, 'minor')).toBe(60); // C -> C
      expect(helpers.scale(62, 'minor')).toBe(62); // D -> D
      expect(helpers.scale(63, 'minor')).toBe(63); // Eb -> Eb
      expect(helpers.scale(64, 'minor')).toBe(63); // E -> Eb (closest)
      expect(helpers.scale(65, 'minor')).toBe(65); // F -> F
      expect(helpers.scale(67, 'minor')).toBe(67); // G -> G
      expect(helpers.scale(68, 'minor')).toBe(68); // Ab -> Ab
      expect(helpers.scale(70, 'minor')).toBe(70); // Bb -> Bb
    });
  });

  describe('All Scale Types', () => {
    const scaleTests = [
      { name: 'dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
      { name: 'phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
      { name: 'lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
      { name: 'mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
      { name: 'aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
      { name: 'locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
      { name: 'chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { name: 'pentatonic', intervals: [0, 2, 4, 7, 9] },
      { name: 'blues', intervals: [0, 3, 5, 6, 7, 10] }
    ];

    for (const { name, intervals } of scaleTests) {
      it(`should recognize ${name} scale`, () => {
        // Just test that scale notes map to themselves
        for (const interval of intervals) {
          const note = 60 + interval;
          expect(helpers.scale(note, name)).toBe(note);
        }
      });
    }
  });

  describe('Pentatonic Scale', () => {
    it('should quantize to pentatonic scale notes', () => {
      // C pentatonic: C D E G A (intervals: 0, 2, 4, 7, 9)
      expect(helpers.scale(60, 'pentatonic')).toBe(60); // C -> C
      expect(helpers.scale(61, 'pentatonic')).toBe(60); // C# -> C
      expect(helpers.scale(62, 'pentatonic')).toBe(62); // D -> D
      expect(helpers.scale(63, 'pentatonic')).toBe(62); // D# -> D
      expect(helpers.scale(64, 'pentatonic')).toBe(64); // E -> E
      expect(helpers.scale(65, 'pentatonic')).toBe(64); // F -> E (closest)
      expect(helpers.scale(66, 'pentatonic')).toBe(67); // F# -> G (closest)
      expect(helpers.scale(67, 'pentatonic')).toBe(67); // G -> G
    });
  });

  describe('Blues Scale', () => {
    it('should quantize to blues scale notes', () => {
      // C blues: C Eb F F# G Bb (intervals: 0, 3, 5, 6, 7, 10)
      expect(helpers.scale(60, 'blues')).toBe(60); // C -> C
      expect(helpers.scale(63, 'blues')).toBe(63); // Eb -> Eb
      expect(helpers.scale(65, 'blues')).toBe(65); // F -> F
      expect(helpers.scale(66, 'blues')).toBe(66); // F# -> F#
      expect(helpers.scale(67, 'blues')).toBe(67); // G -> G
      expect(helpers.scale(70, 'blues')).toBe(70); // Bb -> Bb
    });
  });

  describe('Chromatic Scale', () => {
    it('should return the same note for chromatic scale', () => {
      // All notes are in the chromatic scale
      for (let note = 0; note <= 127; note++) {
        expect(helpers.scale(note, 'chromatic')).toBe(note);
      }
    });
  });

  describe('Octave Handling', () => {
    it('should preserve octave when quantizing', () => {
      // C3 (48) in major scale
      expect(helpers.scale(49, 'major')).toBe(48); // C#3 -> C3

      // C5 (72) in major scale
      expect(helpers.scale(73, 'major')).toBe(72); // C#5 -> C5
    });

    it('should handle low notes', () => {
      expect(helpers.scale(0, 'major')).toBe(0);
      expect(helpers.scale(1, 'major')).toBe(0);
    });

    it('should handle high notes', () => {
      expect(helpers.scale(127, 'major')).toBe(127);
      expect(helpers.scale(126, 'major')).toBe(125); // B -> B (interval 11)
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown scale', () => {
      expect(() => helpers.scale(60, 'unknown')).toThrow('Unknown scale: unknown');
    });

    it('should throw error for empty scale name', () => {
      expect(() => helpers.scale(60, '')).toThrow('Unknown scale:');
    });
  });
});

describe('PatternHelpers - Value Quantization', () => {
  let helpers: PatternHelperImpl;

  beforeEach(() => {
    helpers = new PatternHelperImpl();
  });

  describe('Basic Quantization', () => {
    it('should quantize to step size', () => {
      expect(helpers.quantize(5, 4)).toBe(4);
      expect(helpers.quantize(6, 4)).toBe(8);
      expect(helpers.quantize(7, 4)).toBe(8);
      expect(helpers.quantize(8, 4)).toBe(8);
    });

    it('should round to nearest step', () => {
      expect(helpers.quantize(0.4, 1)).toBe(0);
      expect(helpers.quantize(0.5, 1)).toBe(1);
      expect(helpers.quantize(0.6, 1)).toBe(1);
    });

    it('should handle exact multiples', () => {
      expect(helpers.quantize(10, 5)).toBe(10);
      expect(helpers.quantize(100, 25)).toBe(100);
    });
  });

  describe('Different Step Sizes', () => {
    it('should quantize to step 1', () => {
      expect(helpers.quantize(2.3, 1)).toBe(2);
      expect(helpers.quantize(2.7, 1)).toBe(3);
    });

    it('should quantize to step 10', () => {
      expect(helpers.quantize(14, 10)).toBe(10);
      expect(helpers.quantize(15, 10)).toBe(20);
      expect(helpers.quantize(16, 10)).toBe(20);
    });

    it('should quantize to fractional step', () => {
      expect(helpers.quantize(0.3, 0.25)).toBe(0.25);
      expect(helpers.quantize(0.4, 0.25)).toBe(0.5);
      expect(helpers.quantize(0.1, 0.25)).toBe(0);
    });
  });

  describe('Negative Values', () => {
    it('should handle negative values', () => {
      // Math.round rounds toward positive infinity for .5 values
      // -5/4 = -1.25, rounds to -1, * 4 = -4
      // -6/4 = -1.5, rounds to -1 (toward +inf), * 4 = -4
      // -7/4 = -1.75, rounds to -2, * 4 = -8
      expect(helpers.quantize(-5, 4)).toBe(-4);
      expect(helpers.quantize(-6, 4)).toBe(-4); // JS Math.round behavior
      expect(helpers.quantize(-7, 4)).toBe(-8);
    });
  });

  describe('Zero Values', () => {
    it('should return 0 for value 0', () => {
      expect(helpers.quantize(0, 4)).toBe(0);
      expect(helpers.quantize(0, 10)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for zero step', () => {
      expect(() => helpers.quantize(5, 0)).toThrow('Quantize step must be positive');
    });

    it('should throw error for negative step', () => {
      expect(() => helpers.quantize(5, -1)).toThrow('Quantize step must be positive');
    });
  });
});

describe('PatternHelpers - Default Instance', () => {
  it('should export a default instance', () => {
    expect(defaultPatternHelpers).toBeInstanceOf(PatternHelperImpl);
  });

  it('should have all helper methods', () => {
    expect(typeof defaultPatternHelpers.euclidean).toBe('function');
    expect(typeof defaultPatternHelpers.probability).toBe('function');
    expect(typeof defaultPatternHelpers.scale).toBe('function');
    expect(typeof defaultPatternHelpers.quantize).toBe('function');
  });

  it('should work correctly', () => {
    expect(defaultPatternHelpers.euclidean(8, 3)).toHaveLength(8);
    expect(defaultPatternHelpers.scale(60, 'major')).toBe(60);
    expect(defaultPatternHelpers.quantize(5, 4)).toBe(4);
  });
});
