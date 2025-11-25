import { describe, it, expect, beforeEach } from 'vitest';
import {
  InputTransformer,
  type TransformConfig
} from '../../src/mappings/InputTransformer';

/**
 * T060, T062, T068: InputTransformer Tests (RED PHASE - MUST FAIL)
 *
 * Tests for input transformation system:
 * - Linear/exponential scaling
 * - Smoothing with time-based averaging (30ms window)
 * - Dead zone handling
 * - Range mapping and clamping
 */

describe('InputTransformer', () => {
  let transformer: InputTransformer;

  beforeEach(() => {
    transformer = new InputTransformer();
  });

  // ============================================================================
  // Linear Transformation Tests
  // ============================================================================

  describe('Linear Transformation', () => {
    it('should transform 0-127 to 0.0-1.0 linearly', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
      };

      expect(transformer.transform(0, config)).toBeCloseTo(0.0, 3);
      expect(transformer.transform(64, config)).toBeCloseTo(0.504, 3); // ~0.5
      expect(transformer.transform(127, config)).toBeCloseTo(1.0, 3);
    });

    it('should transform 0-127 to 60-127 linearly', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [60, 127]
      };

      expect(transformer.transform(0, config)).toBeCloseTo(60, 1);
      expect(transformer.transform(64, config)).toBeCloseTo(93.5, 1);
      expect(transformer.transform(127, config)).toBeCloseTo(127, 1);
    });

    it('should handle inverted output range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [1.0, 0.0] // Inverted
      };

      expect(transformer.transform(0, config)).toBeCloseTo(1.0, 3);
      expect(transformer.transform(64, config)).toBeCloseTo(0.5, 3);
      expect(transformer.transform(127, config)).toBeCloseTo(0.0, 3);
    });

    it('should handle negative output range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [-1.0, 1.0]
      };

      expect(transformer.transform(0, config)).toBeCloseTo(-1.0, 3);
      expect(transformer.transform(64, config)).toBeCloseTo(0.0, 3);
      expect(transformer.transform(127, config)).toBeCloseTo(1.0, 3);
    });

    it('should handle pitch bend input range -8192 to +8191', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [-8192, 8191],
        outputRange: [48, 72] // C3 to C5
      };

      expect(transformer.transform(-8192, config)).toBeCloseTo(48, 1);
      expect(transformer.transform(0, config)).toBeCloseTo(60, 1); // C4 (middle C)
      expect(transformer.transform(8191, config)).toBeCloseTo(72, 1);
    });

    it('should clamp values outside input range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
      };

      expect(transformer.transform(-10, config)).toBeCloseTo(0.0, 3); // Clamped to min
      expect(transformer.transform(200, config)).toBeCloseTo(1.0, 3); // Clamped to max
    });
  });

  // ============================================================================
  // Exponential Transformation Tests
  // ============================================================================

  describe('Exponential Transformation', () => {
    it('should apply exponential curve with factor 2.0', () => {
      const config: TransformConfig = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        curve: 2.0
      };

      const result25 = transformer.transform(32, config); // ~25% input
      const result50 = transformer.transform(64, config); // ~50% input
      const result75 = transformer.transform(96, config); // ~75% input

      // Exponential curve should have more values in lower range
      expect(result25).toBeLessThan(0.25);
      expect(result50).toBeLessThan(0.50);
      expect(result75).toBeGreaterThan(0.50);
    });

    it('should apply logarithmic curve with factor 0.5', () => {
      const config: TransformConfig = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        curve: 0.5 // Inverse curve (logarithmic feel)
      };

      const result25 = transformer.transform(32, config);
      const result50 = transformer.transform(64, config);
      const result75 = transformer.transform(96, config);

      // Logarithmic curve should have more values in upper range
      expect(result25).toBeGreaterThan(0.25);
      expect(result50).toBeGreaterThan(0.50);
    });

    it('should handle exponential with inverted range', () => {
      const config: TransformConfig = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [1.0, 0.0], // Inverted
        curve: 2.0
      };

      expect(transformer.transform(0, config)).toBeCloseTo(1.0, 3);
      expect(transformer.transform(127, config)).toBeCloseTo(0.0, 3);
    });

    it('should throw error if curve not provided for exponential', () => {
      const config: any = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
        // Missing curve
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/curve.*required.*exponential/i);
    });

    it('should throw error if curve is negative', () => {
      const config: any = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        curve: -1.0 // Negative not allowed
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/curve.*positive/i);
    });

    it('should throw error if curve is zero', () => {
      const config: any = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        curve: 0 // Zero not allowed
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/curve.*zero/i);
    });
  });

  // ============================================================================
  // Dead Zone Tests (T068)
  // ============================================================================

  describe('Dead Zone Handling', () => {
    it('should ignore values in dead zone at start of range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        deadZone: 5 // Ignore 0-5
      };

      expect(transformer.transform(0, config)).toBe(null); // In dead zone
      expect(transformer.transform(3, config)).toBe(null); // In dead zone
      expect(transformer.transform(5, config)).toBe(null); // In dead zone
      expect(transformer.transform(6, config)).toBeCloseTo(0.0, 3); // Just outside
    });

    it('should remap values after dead zone to full output range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        deadZone: 10 // Ignore 0-10
      };

      // After dead zone, input 11 should map to output 0.0
      expect(transformer.transform(11, config)).toBeCloseTo(0.0, 3);
      // Input 127 should still map to 1.0
      expect(transformer.transform(127, config)).toBeCloseTo(1.0, 3);
    });

    it('should handle dead zone at end of range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        deadZone: -5 // Ignore last 5 values (122-127)
      };

      expect(transformer.transform(122, config)).toBe(null); // In dead zone
      expect(transformer.transform(127, config)).toBe(null); // In dead zone
      expect(transformer.transform(121, config)).toBeCloseTo(1.0, 3); // Just outside
    });

    it('should handle dead zone at both ends', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        deadZone: 5, // Ignore 0-5
        deadZoneEnd: 5 // Ignore 122-127
      };

      expect(transformer.transform(0, config)).toBe(null);
      expect(transformer.transform(5, config)).toBe(null);
      expect(transformer.transform(127, config)).toBe(null);
      expect(transformer.transform(122, config)).toBe(null);

      expect(transformer.transform(6, config)).toBeCloseTo(0.0, 3);
      expect(transformer.transform(121, config)).toBeCloseTo(1.0, 3);
    });

    it('should apply dead zone before exponential curve', () => {
      const config: TransformConfig = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        curve: 2.0,
        deadZone: 5
      };

      expect(transformer.transform(3, config)).toBe(null); // Dead zone
      expect(transformer.transform(6, config)).not.toBe(null); // Curve applied
    });

    it('should throw error if dead zone exceeds half of input range', () => {
      const config: any = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        deadZone: 70 // Too large (>50% of range)
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/deadZone.*exceeds/i);
    });
  });

  // ============================================================================
  // Smoothing Tests (T062)
  // ============================================================================

  describe('Smoothing with Time-Based Averaging', () => {
    it('should smooth rapid value changes over 30ms window', async () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30 // 30ms averaging window
      };

      const transformerId = 'test-smoother';

      // Simulate rapid fader movement
      const t1 = transformer.transformSmoothed(0, config, transformerId);
      const t2 = transformer.transformSmoothed(127, config, transformerId); // Instant jump

      // Output should be smoothed (not instant jump)
      expect(t2).not.toBeCloseTo(1.0, 1); // Should not reach 1.0 immediately
      expect(t2).toBeGreaterThan(t1); // But should move towards target

      // Wait 30ms for smoothing window
      await new Promise(resolve => setTimeout(resolve, 35));

      const t3 = transformer.transformSmoothed(127, config, transformerId);

      // After window, should converge to target
      expect(t3).toBeCloseTo(1.0, 1);
    });

    it('should maintain separate smoothing states for different transformers', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30
      };

      const result1 = transformer.transformSmoothed(64, config, 'transformer1');
      const result2 = transformer.transformSmoothed(32, config, 'transformer2');

      // Different IDs should have independent smoothing
      expect(result1).not.toBeCloseTo(result2, 1);
    });

    it('should converge exponentially to target value', async () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30
      };

      const transformerId = 'convergence-test';

      transformer.transformSmoothed(0, config, transformerId);

      // Set target to 1.0
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        const value = transformer.transformSmoothed(127, config, transformerId);
        samples.push(value);
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Values should approach target exponentially
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]); // Monotonic increase
      }
    });

    it('should handle smoothing with zero window (no smoothing)', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 0 // No smoothing
      };

      const result = transformer.transformSmoothed(64, config, 'no-smooth');

      // Should behave like non-smoothed transform
      expect(result).toBeCloseTo(0.5, 2);
    });

    it('should reset smoothing state when clearSmoothing called', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30
      };

      const transformerId = 'reset-test';

      transformer.transformSmoothed(127, config, transformerId);

      transformer.clearSmoothing(transformerId);

      const result = transformer.transformSmoothed(0, config, transformerId);

      // After reset, should immediately reflect new value
      expect(result).toBeCloseTo(0.0, 2);
    });

    it('should clear all smoothing states', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30
      };

      transformer.transformSmoothed(127, config, 'id1');
      transformer.transformSmoothed(127, config, 'id2');
      transformer.transformSmoothed(127, config, 'id3');

      transformer.clearAllSmoothing();

      const result1 = transformer.transformSmoothed(0, config, 'id1');
      const result2 = transformer.transformSmoothed(0, config, 'id2');
      const result3 = transformer.transformSmoothed(0, config, 'id3');

      // All should start fresh at 0
      expect(result1).toBeCloseTo(0.0, 2);
      expect(result2).toBeCloseTo(0.0, 2);
      expect(result3).toBeCloseTo(0.0, 2);
    });

    it('should apply smoothing after transformation', async () => {
      const config: TransformConfig = {
        type: 'exponential',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        curve: 2.0,
        smoothing: 30
      };

      const transformerId = 'exp-smooth';

      transformer.transformSmoothed(0, config, transformerId);

      const result1 = transformer.transformSmoothed(127, config, transformerId);

      // Smoothing should be applied AFTER exponential transform
      expect(result1).toBeLessThan(1.0);
      expect(result1).toBeGreaterThan(0.0);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should transform values with <0.1ms latency', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
      };

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        transformer.transform(64, config);
      }
      const end = performance.now();

      const avgLatency = (end - start) / 1000;
      expect(avgLatency).toBeLessThan(0.1); // <0.1ms per transform
    });

    it('should handle smoothing with <1ms latency', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        transformer.transformSmoothed(64, config, 'perf-test');
      }
      const end = performance.now();

      const avgLatency = (end - start) / 100;
      expect(avgLatency).toBeLessThan(1.0); // <1ms per smoothed transform
    });

    it('should efficiently handle 100 concurrent smoothed transformers', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0],
        smoothing: 30
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        transformer.transformSmoothed(64, config, `transformer-${i}`);
      }
      const end = performance.now();

      expect(end - start).toBeLessThan(50); // <50ms for 100 transformers
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero-width input range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [64, 64], // Same min and max
        outputRange: [0.0, 1.0]
      };

      // Should return middle of output range
      expect(transformer.transform(64, config)).toBeCloseTo(0.5, 2);
    });

    it('should handle zero-width output range', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.5, 0.5] // Same min and max
      };

      expect(transformer.transform(0, config)).toBeCloseTo(0.5, 3);
      expect(transformer.transform(64, config)).toBeCloseTo(0.5, 3);
      expect(transformer.transform(127, config)).toBeCloseTo(0.5, 3);
    });

    it('should handle very small input ranges', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [63, 65], // 2-value range
        outputRange: [0.0, 1.0]
      };

      expect(transformer.transform(63, config)).toBeCloseTo(0.0, 3);
      expect(transformer.transform(64, config)).toBeCloseTo(0.5, 3);
      expect(transformer.transform(65, config)).toBeCloseTo(1.0, 3);
    });

    it('should handle very large output ranges', () => {
      const config: TransformConfig = {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0, 10000]
      };

      expect(transformer.transform(0, config)).toBeCloseTo(0, 1);
      expect(transformer.transform(127, config)).toBeCloseTo(10000, 1);
    });

    it('should throw error for invalid transformation type', () => {
      const config: any = {
        type: 'invalid',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/transformation.*type.*invalid/i);
    });

    it('should throw error if inputRange not provided', () => {
      const config: any = {
        type: 'linear',
        outputRange: [0.0, 1.0]
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/inputRange.*required/i);
    });

    it('should throw error if outputRange not provided', () => {
      const config: any = {
        type: 'linear',
        inputRange: [0, 127]
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/outputRange.*required/i);
    });

    it('should throw error if ranges are not arrays of length 2', () => {
      const config: any = {
        type: 'linear',
        inputRange: [0, 64, 127], // Too many values
        outputRange: [0.0, 1.0]
      };

      expect(() => transformer.transform(64, config))
        .toThrow(/range.*length.*2/i);
    });
  });
});
