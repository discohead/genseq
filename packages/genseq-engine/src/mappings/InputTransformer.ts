import type { TransformConfig } from '../config/entities/MappingEntity';

/**
 * T060 + T062: Input value transformation with smoothing
 *
 * Transforms MIDI input values (0-127, -8192 to 8191) to target ranges
 * with linear, exponential, or logarithmic curves, dead zones, quantization,
 * and time-based smoothing.
 *
 * Performance contract: <0.1ms transform latency, <1ms smoothing overhead
 *
 * Transformation pipeline:
 * 1. Apply dead zone filtering
 * 2. Apply curve transformation (linear, exponential, logarithmic)
 * 3. Apply scaling to target range
 * 4. Apply smoothing (time-based moving average)
 * 5. Apply quantization if configured
 */

interface SmoothingState {
  values: number[];
  timestamps: number[];
}

export class InputTransformer {
  private smoothingStates: Map<string, SmoothingState> = new Map();

  /**
   * Transform an input value using the specified configuration
   * Returns null if value is in a dead zone
   */
  transform(inputValue: number, config: TransformConfig): number | null {
    // Validate required parameters
    if (!config.inputRange || !Array.isArray(config.inputRange) || config.inputRange.length !== 2) {
      throw new Error('inputRange is required and must be an array of length 2');
    }
    if (!config.outputRange || !Array.isArray(config.outputRange) || config.outputRange.length !== 2) {
      throw new Error('outputRange is required and must be an array of length 2');
    }

    // Step 1: Check dead zones first - return null if in dead zone
    if (this.isInStartDeadZone(inputValue, config) || this.isInEndDeadZone(inputValue, config)) {
      return null;
    }

    // Calculate active input range (excluding dead zones)
    const [inputMin, inputMax] = config.inputRange;
    const startDeadZone = Math.abs(config.deadZone || 0);
    const endDeadZone = Math.abs(config.deadZoneEnd || 0);

    const activeMin = inputMin + startDeadZone;
    const activeMax = inputMax - endDeadZone;
    const activeRange = activeMax - activeMin;

    // Handle zero-width range
    if (activeRange === 0) {
      return config.outputRange[0];
    }

    // Normalize to 0-1 range based on ACTIVE range (after dead zones)
    let normalized = (inputValue - activeMin) / activeRange;

    // Clamp to 0-1
    normalized = Math.max(0, Math.min(1, normalized));

    // Step 2: Apply transformation curve
    let transformed: number;
    switch (config.type) {
      case 'linear':
        transformed = normalized;
        break;
      case 'exponential':
        if (!config.curve) {
          throw new Error('Curve is required for exponential transformation');
        }
        if (config.curve <= 0) {
          throw new Error('Curve must be positive for exponential transformation');
        }
        if (config.curve === 0) {
          throw new Error('Curve cannot be zero for exponential transformation');
        }
        transformed = Math.pow(normalized, config.curve);
        break;
      case 'logarithmic':
        if (!config.curve) {
          throw new Error('Curve is required for logarithmic transformation');
        }
        if (config.curve <= 0) {
          throw new Error('Curve must be positive for logarithmic transformation');
        }
        // Logarithmic curve: log(1 + x * (base - 1)) / log(base)
        // This ensures the curve passes through (0,0) and (1,1)
        const base = config.curve + 1; // curve=1 means base=2
        transformed = Math.log(1 + normalized * (base - 1)) / Math.log(base);
        break;
      default:
        throw new Error(`Unknown transformation type: ${config.type}`);
    }

    // Step 3: Map to output range
    const [outputMin, outputMax] = config.outputRange;
    let result = outputMin + transformed * (outputMax - outputMin);

    // Step 5: Apply quantization if configured
    // (Step 4, smoothing, is only in transformSmoothed)
    if (config.quantize && config.quantize > 0) {
      result = this.quantizeValue(result, config.outputRange, config.quantize);
    }

    return result;
  }

  /**
   * Transform with smoothing (time-based averaging)
   */
  transformSmoothed(
    inputValue: number,
    config: TransformConfig,
    transformerId: string
  ): number | null {
    // First apply base transformation
    const transformedValue = this.transform(inputValue, config);

    // If value is in dead zone, return null
    if (transformedValue === null) {
      return null;
    }

    // If no smoothing configured, return immediately
    if (!config.smoothing || config.smoothing === 0) {
      return transformedValue;
    }

    // Get or create smoothing state
    let state = this.smoothingStates.get(transformerId);
    if (!state) {
      state = { values: [], timestamps: [] };
      this.smoothingStates.set(transformerId, state);
    }

    const now = Date.now();
    const windowMs = config.smoothing;

    // Add new value
    state.values.push(transformedValue);
    state.timestamps.push(now);

    // Remove values outside the time window
    const cutoffTime = now - windowMs;
    while (state.timestamps.length > 0 && state.timestamps[0] < cutoffTime) {
      state.timestamps.shift();
      state.values.shift();
    }

    // Calculate weighted average (more recent values have more weight)
    if (state.values.length === 0) {
      return transformedValue;
    }

    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 0; i < state.values.length; i++) {
      const age = now - state.timestamps[i];
      // Linear weight decay: newer values have weight 1.0, oldest has weight 0.0
      const weight = 1.0 - (age / windowMs);
      weightedSum += state.values[i] * weight;
      weightSum += weight;
    }

    return weightedSum / weightSum;
  }

  /**
   * Quantize a value to discrete steps
   */
  private quantizeValue(value: number, outputRange: [number, number], steps: number): number {
    const [min, max] = outputRange;
    const range = max - min;
    const stepSize = range / (steps - 1);

    // Handle both ascending and descending ranges
    const actualMin = Math.min(min, max);
    const actualMax = Math.max(min, max);

    // Find nearest step
    const normalizedValue = value - min;
    const stepIndex = Math.round(normalizedValue / stepSize);
    const quantizedValue = min + stepIndex * stepSize;

    // Clamp to actual range bounds
    return Math.max(actualMin, Math.min(actualMax, quantizedValue));
  }

  /**
   * Clear smoothing state for a transformer
   */
  clearSmoothing(transformerId: string): void {
    this.smoothingStates.delete(transformerId);
  }

  /**
   * Clear all smoothing states
   */
  clearAllSmoothing(): void {
    this.smoothingStates.clear();
  }


  /**
   * Check if a value is within the dead zone at the start of the range
   */
  isInStartDeadZone(inputValue: number, config: TransformConfig): boolean {
    if (!config.deadZone || config.deadZone === 0) {
      return false;
    }

    const [inputMin, inputMax] = config.inputRange;
    const deadZoneSize = Math.abs(config.deadZone);

    // Always check from inputMin regardless of range direction
    return inputValue >= inputMin && inputValue <= inputMin + deadZoneSize;
  }

  /**
   * Check if a value is within the dead zone at the end of the range
   */
  isInEndDeadZone(inputValue: number, config: TransformConfig): boolean {
    if (!config.deadZoneEnd || config.deadZoneEnd === 0) {
      return false;
    }

    const [inputMin, inputMax] = config.inputRange;
    const deadZoneSize = Math.abs(config.deadZoneEnd);

    // Always check from inputMax regardless of range direction
    return inputValue >= inputMax - deadZoneSize && inputValue <= inputMax;
  }

  /**
   * Get current smoothing state for debugging/testing
   */
  getSmoothingState(transformerId: string): SmoothingState | undefined {
    const state = this.smoothingStates.get(transformerId);
    if (!state) {
      return undefined;
    }

    // Return a copy to prevent external modification
    return {
      values: [...state.values],
      timestamps: [...state.timestamps]
    };
  }
}
