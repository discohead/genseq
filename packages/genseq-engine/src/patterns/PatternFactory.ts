import {
  EuclideanPattern,
  type EuclideanPatternConfig,
  ProbabilityPattern,
  type ProbabilityPatternConfig,
  PhasePattern,
  type PhasePatternConfig,
  type PatternGeneratorFn,
  type PatternContext
} from '@genseq/patterns';
import type { PatternEntity } from '../config/entities/PatternEntity';

// Import JSON schemas
import euclideanSchema from '../../../../schemas/pattern.schema.json';
import probabilitySchema from '../../../../schemas/patterns/probability.schema.json';
import phaseSchema from '../../../../schemas/patterns/phase.schema.json';

/**
 * T014-T017: PatternFactory - Centralized pattern instance creation and validation
 *
 * Responsibilities:
 * - Create pattern instances from PatternEntity configurations
 * - Validate type-specific parameters against JSON schemas
 * - Generate pattern generator functions
 * - Provide schema introspection for type validation
 *
 * This factory enables type swapping by abstracting pattern creation logic
 * that was previously embedded in GenSeqEngine.
 *
 * ## T065: Parameter Classification
 *
 * **Common Parameters** (shared across all pattern types):
 * - note: MIDI note number (0-127), default: 60
 * - velocity: MIDI velocity (1-127 or array), default: 100
 * - duration: Note duration in beats (0.01-16), default: 0.25
 *
 * **Type-Specific Parameters**:
 * - Euclidean: steps, pulses, rotation
 * - Probability: probability, density, seed (optional), velocityModulation (optional)
 * - Phase: phaseRate, phaseOffset, velocityModulation (optional)
 *
 * ## T066: Parameter Handling During Type Changes
 *
 * PatternFactory uses ALL parameters from the provided entity.
 * No automatic preservation of parameters from previous pattern types.
 * If common parameters are omitted, schema defaults are applied.
 *
 * Examples:
 * - euclidean → probability with note=64 → uses note=64 (from new entity)
 * - euclidean → probability without note → uses note=60 (schema default)
 * - Old pattern's parameters are NOT automatically preserved
 */

export interface PatternCreationResult {
  instance: EuclideanPattern | ProbabilityPattern | PhasePattern;
  generator: PatternGeneratorFn;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

type PatternType = 'euclidean' | 'probability' | 'phase' | 'script';

export class PatternFactory {
  /**
   * T014: Create pattern instance and generator from entity configuration
   *
   * @param entity - PatternEntity with type and parameters
   * @returns Pattern instance and generator function
   * @throws Error if pattern type is unknown or parameters are invalid
   */
  static createPattern(entity: PatternEntity): PatternCreationResult {
    // Validate pattern type
    if (!this.isValidPatternType(entity.type)) {
      throw new Error(
        `Unknown pattern type: ${entity.type}. Valid types: euclidean, probability, phase, script`
      );
    }

    // Validate parameters before creation
    const validation = this.validateParameters(entity.type, entity.parameters);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => e.message).join(', ');
      throw new Error(
        `Invalid parameters for ${entity.type} pattern: ${errorMessages}`
      );
    }

    // Create pattern instance based on type
    let instance: EuclideanPattern | ProbabilityPattern | PhasePattern;

    switch (entity.type) {
      case 'euclidean':
        instance = this.createEuclideanInstance(entity);
        break;
      case 'probability':
        instance = this.createProbabilityInstance(entity);
        break;
      case 'phase':
        instance = this.createPhaseInstance(entity);
        break;
      case 'script':
        throw new Error('Script patterns not yet supported in PatternFactory');
      default:
        throw new Error(`Unhandled pattern type: ${entity.type}`);
    }

    // Create generator function
    const generator = this.createGenerator(instance);

    return { instance, generator };
  }

  /**
   * T015/T041/T042: Validate parameters for specific pattern type
   *
   * Performs type-specific validation by calling pattern constructors.
   * Returns detailed error messages with parameter paths.
   *
   * @param type - Pattern type
   * @param parameters - Parameter object to validate
   * @returns Validation result with structured errors
   */
  static validateParameters(type: PatternType, parameters: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      // Create a temporary entity for validation
      const tempEntity = {
        id: 'validation-temp',
        type,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters
      } as PatternEntity;

      // Attempt to create instance - this will throw if parameters are invalid
      switch (type) {
        case 'euclidean':
          this.createEuclideanInstance(tempEntity);
          break;
        case 'probability':
          this.createProbabilityInstance(tempEntity);
          break;
        case 'phase':
          this.createPhaseInstance(tempEntity);
          break;
        case 'script':
          errors.push({
            path: '/parameters',
            message: 'Script pattern validation not yet implemented'
          });
          break;
        default:
          errors.push({
            path: '/type',
            message: `Unknown pattern type: ${type}`
          });
      }
    } catch (error) {
      errors.push({
        path: '/parameters',
        message: (error as Error).message
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * T016: Get parameter schema for pattern type
   *
   * Returns JSON schema definition for pattern type parameters.
   *
   * @param type - Pattern type
   * @returns JSON schema object
   * @throws Error if pattern type is unknown
   */
  static getParameterSchema(type: PatternType): Record<string, any> {
    switch (type) {
      case 'euclidean':
        // Extract euclidean properties from main pattern schema
        return euclideanSchema.properties.euclidean || {};
      case 'probability':
        return probabilitySchema;
      case 'phase':
        return phaseSchema;
      case 'script':
        return euclideanSchema.properties.script || {};
      default:
        throw new Error(`Unknown pattern type: ${type}`);
    }
  }

  /**
   * T017: Create generator function helper
   *
   * Wraps pattern instance tick() method as a generator function.
   *
   * @param instance - Pattern instance
   * @returns Generator function that calls instance.tick()
   */
  static createGenerator(
    instance: EuclideanPattern | ProbabilityPattern | PhasePattern
  ): PatternGeneratorFn {
    return (context: PatternContext) => {
      return instance.tick(context);
    };
  }

  // Private helper methods

  private static isValidPatternType(type: string): type is PatternType {
    return ['euclidean', 'probability', 'phase', 'script'].includes(type);
  }

  /**
   * T069-T070: Create euclidean instance with schema defaults
   */
  private static createEuclideanInstance(entity: PatternEntity): EuclideanPattern {
    const params = entity.parameters as any;
    const config: EuclideanPatternConfig = {
      steps: params.steps,
      pulses: params.pulses,
      rotation: params.rotation ?? 0, // Schema default
      // T069: Apply schema defaults for common parameters
      note: params.note ?? 60, // Schema default
      velocity: params.velocity ?? 100, // Schema default
      duration: params.duration ?? 0.25 // Schema default
    };

    return new EuclideanPattern(config);
  }

  /**
   * T069-T070: Create probability instance with schema defaults
   */
  private static createProbabilityInstance(entity: PatternEntity): ProbabilityPattern {
    const params = entity.parameters as any;
    const config: ProbabilityPatternConfig = {
      probability: params.probability,
      density: params.density ?? 16, // Schema default
      // T069: Apply schema defaults for common parameters
      note: params.note ?? 60, // Schema default
      velocity: params.velocity ?? 100, // Schema default
      duration: params.duration ?? 0.25, // Schema default
      seed: params.seed,
      velocityModulation: params.velocityModulation ?? false // Schema default
    };

    return new ProbabilityPattern(config);
  }

  /**
   * T069-T070: Create phase instance with schema defaults
   */
  private static createPhaseInstance(entity: PatternEntity): PhasePattern {
    const params = entity.parameters as any;
    const config: PhasePatternConfig = {
      phaseRate: params.phaseRate ?? 1.0, // Schema default
      phaseOffset: params.phaseOffset ?? 0.0, // Schema default
      // T070: Apply schema defaults for common parameters
      note: params.note ?? 60, // Schema default
      velocity: params.velocity ?? 100, // Schema default
      duration: params.duration ?? 0.25, // Schema default
      velocityModulation: params.velocityModulation ?? false // Schema default
    };

    return new PhasePattern(config);
  }

  private static validateEuclideanParameters(
    params: Record<string, any>,
    errors: string[]
  ): void {
    // Required parameters
    if (params.steps === undefined) {
      errors.push('Missing required parameter: steps');
    } else if (typeof params.steps !== 'number' || params.steps < 1 || params.steps > 64) {
      errors.push('steps must be a number between 1 and 64');
    }

    if (params.pulses === undefined) {
      errors.push('Missing required parameter: pulses');
    } else if (
      typeof params.pulses !== 'number' ||
      params.pulses < 0 ||
      params.pulses > 64
    ) {
      errors.push('pulses must be a number between 0 and 64');
    }

    // Validate pulses <= steps
    if (params.steps !== undefined && params.pulses !== undefined) {
      if (params.pulses > params.steps) {
        errors.push('pulses cannot be greater than steps');
      }
    }

    // Optional parameters
    if (params.rotation !== undefined) {
      if (typeof params.rotation !== 'number' || params.rotation < 0) {
        errors.push('rotation must be a non-negative number');
      }
    }

    if (params.velocity !== undefined) {
      if (Array.isArray(params.velocity)) {
        for (const v of params.velocity) {
          if (typeof v !== 'number' || v < 1 || v > 127) {
            errors.push('velocity array values must be between 1 and 127');
            break;
          }
        }
      } else if (typeof params.velocity !== 'number' || params.velocity < 1 || params.velocity > 127) {
        errors.push('velocity must be a number between 1 and 127');
      }
    }

    if (params.gateLength !== undefined) {
      if (typeof params.gateLength !== 'number' || params.gateLength <= 0) {
        errors.push('gateLength must be a positive number');
      }
    }
  }

  private static validateProbabilityParameters(
    params: Record<string, any>,
    errors: string[]
  ): void {
    // Required parameters
    if (params.probability === undefined) {
      errors.push('Missing required parameter: probability');
    } else if (
      typeof params.probability !== 'number' ||
      params.probability < 0 ||
      params.probability > 1
    ) {
      errors.push('probability must be a number between 0.0 and 1.0');
    }

    if (params.density === undefined) {
      errors.push('Missing required parameter: density');
    } else if (typeof params.density !== 'number' || params.density <= 0) {
      errors.push('density must be a positive number');
    }

    // Velocity validation
    if (params.velocity !== undefined) {
      if (Array.isArray(params.velocity)) {
        for (const v of params.velocity) {
          if (typeof v !== 'number' || v < 1 || v > 127) {
            errors.push('velocity array values must be between 1 and 127');
            break;
          }
        }
      } else if (typeof params.velocity !== 'number' || params.velocity < 1 || params.velocity > 127) {
        errors.push('velocity must be a number between 1 and 127');
      }
    }

    // Duration/gateLength validation
    if (params.gateLength !== undefined) {
      if (typeof params.gateLength !== 'number' || params.gateLength <= 0) {
        errors.push('gateLength must be a positive number');
      }
    }
  }

  private static validatePhaseParameters(
    params: Record<string, any>,
    errors: string[]
  ): void {
    // Required parameters
    if (params.phaseRate === undefined) {
      errors.push('Missing required parameter: phaseRate');
    } else if (typeof params.phaseRate !== 'number' || params.phaseRate < 0) {
      errors.push('phaseRate must be a non-negative number');
    }

    if (params.phaseOffset === undefined) {
      errors.push('Missing required parameter: phaseOffset');
    } else if (
      typeof params.phaseOffset !== 'number' ||
      params.phaseOffset < 0 ||
      params.phaseOffset > 1
    ) {
      errors.push('phaseOffset must be a number between 0.0 and 1.0');
    }

    // Velocity validation
    if (params.velocity !== undefined) {
      if (Array.isArray(params.velocity)) {
        for (const v of params.velocity) {
          if (typeof v !== 'number' || v < 1 || v > 127) {
            errors.push('velocity array values must be between 1 and 127');
            break;
          }
        }
      } else if (typeof params.velocity !== 'number' || params.velocity < 1 || params.velocity > 127) {
        errors.push('velocity must be a number between 1 and 127');
      }
    }

    // Duration/gateLength validation
    if (params.gateLength !== undefined) {
      if (typeof params.gateLength !== 'number' || params.gateLength <= 0) {
        errors.push('gateLength must be a positive number');
      }
    }
  }
}
