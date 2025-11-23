import type { PatternHelpers } from '../types';

/**
 * T024: Pattern helper utility functions
 *
 * Provides common pattern generation utilities:
 * - Euclidean rhythm generation
 * - Probability functions
 * - Scale quantization
 * - Value quantization
 */
export class PatternHelperImpl implements PatternHelpers {
  /**
   * Generate Euclidean rhythm pattern
   * Distributes pulses as evenly as possible across steps
   */
  euclidean(steps: number, pulses: number): boolean[] {
    if (steps <= 0 || pulses < 0 || pulses > steps) {
      throw new Error(`Invalid Euclidean parameters: steps=${steps}, pulses=${pulses}`);
    }

    const pattern: boolean[] = new Array(steps).fill(false);

    if (pulses === 0) {
      return pattern;
    }

    if (pulses === steps) {
      return new Array(steps).fill(true);
    }

    // Bjorklund's algorithm
    const slope = steps / pulses;

    for (let i = 0; i < pulses; i++) {
      const index = Math.floor(i * slope);
      pattern[index] = true;
    }

    return pattern;
  }

  /**
   * Probability test with given chance (0-100)
   */
  probability(chance: number): boolean {
    if (chance < 0 || chance > 100) {
      throw new Error(`Probability must be between 0 and 100, got ${chance}`);
    }

    return Math.random() * 100 < chance;
  }

  /**
   * Quantize note to given scale
   */
  scale(note: number, scaleName: string): number {
    const scales: Record<string, number[]> = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      phrygian: [0, 1, 3, 5, 7, 8, 10],
      lydian: [0, 2, 4, 6, 7, 9, 11],
      mixolydian: [0, 2, 4, 5, 7, 9, 10],
      aeolian: [0, 2, 3, 5, 7, 8, 10],
      locrian: [0, 1, 3, 5, 6, 8, 10],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      pentatonic: [0, 2, 4, 7, 9],
      blues: [0, 3, 5, 6, 7, 10]
    };

    const scaleIntervals = scales[scaleName.toLowerCase()];

    if (!scaleIntervals) {
      throw new Error(`Unknown scale: ${scaleName}`);
    }

    // Get octave and note within octave
    const octave = Math.floor(note / 12);
    const noteInOctave = note % 12;

    // Find closest scale note
    let closestInterval = scaleIntervals[0];
    let minDistance = Math.abs(noteInOctave - closestInterval);

    for (const interval of scaleIntervals) {
      const distance = Math.abs(noteInOctave - interval);
      if (distance < minDistance) {
        minDistance = distance;
        closestInterval = interval;
      }
    }

    return (octave * 12) + closestInterval;
  }

  /**
   * Quantize value to nearest step
   */
  quantize(value: number, step: number): number {
    if (step <= 0) {
      throw new Error(`Quantize step must be positive, got ${step}`);
    }

    return Math.round(value / step) * step;
  }
}

/**
 * Default pattern helpers instance
 */
export const defaultPatternHelpers = new PatternHelperImpl();
