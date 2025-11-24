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
 */

export interface PatternCreationResult {
  instance: EuclideanPattern | ProbabilityPattern | PhasePattern;
  generator: PatternGeneratorFn;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
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
  createPattern(entity: PatternEntity): PatternCreationResult {
    // Validate pattern type
    if (!this.isValidPatternType(entity.type)) {
      throw new Error(
        `Unknown pattern type: ${entity.type}. Valid types: euclidean, probability, phase, script`
      );
    }

    // Validate parameters before creation
    const validation = this.validateParameters(entity.type, entity.parameters);
    if (!validation.valid) {
      throw new Error(
        `Invalid parameters for ${entity.type} pattern: ${validation.errors.join(', ')}`
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
   * T015: Validate parameters for specific pattern type
   *
   * Performs type-specific validation using JSON schemas and constructor logic.
   *
   * @param type - Pattern type
   * @param parameters - Parameter object to validate
   * @returns Validation result with errors if invalid
   */
  validateParameters(type: PatternType, parameters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    try {
      switch (type) {
        case 'euclidean':
          this.validateEuclideanParameters(parameters, errors);
          break;
        case 'probability':
          this.validateProbabilityParameters(parameters, errors);
          break;
        case 'phase':
          this.validatePhaseParameters(parameters, errors);
          break;
        case 'script':
          // Script validation would check file existence
          errors.push('Script pattern validation not yet implemented');
          break;
        default:
          errors.push(`Unknown pattern type: ${type}`);
      }
    } catch (error) {
      errors.push((error as Error).message);
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
  getParameterSchema(type: PatternType): Record<string, any> {
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
  createGenerator(
    instance: EuclideanPattern | ProbabilityPattern | PhasePattern
  ): PatternGeneratorFn {
    return (context: PatternContext) => {
      return instance.tick(context);
    };
  }

  // Private helper methods

  private isValidPatternType(type: string): type is PatternType {
    return ['euclidean', 'probability', 'phase', 'script'].includes(type);
  }

  private createEuclideanInstance(entity: PatternEntity): EuclideanPattern {
    const params = entity.parameters as any;
    const config: EuclideanPatternConfig = {
      steps: params.steps,
      pulses: params.pulses,
      rotation: params.rotation ?? 0,
      note: (entity as any).note ?? params.note ?? 60,
      velocity: params.velocity ?? 100,
      duration: params.gateLength ?? params.duration ?? 0.25
    };

    return new EuclideanPattern(config);
  }

  private createProbabilityInstance(entity: PatternEntity): ProbabilityPattern {
    const params = entity.parameters as any;
    const config: ProbabilityPatternConfig = {
      probability: params.probability,
      density: params.density,
      note: (entity as any).note ?? params.note ?? 60,
      velocity: params.velocity ?? 100,
      duration: params.gateLength ?? params.duration ?? 0.25,
      seed: params.seed,
      velocityModulation: params.velocityModulation ?? false
    };

    return new ProbabilityPattern(config);
  }

  private createPhaseInstance(entity: PatternEntity): PhasePattern {
    const params = entity.parameters as any;
    const config: PhasePatternConfig = {
      phaseRate: params.phaseRate,
      phaseOffset: params.phaseOffset,
      note: (entity as any).note ?? params.note ?? 60,
      velocity: params.velocity ?? 100,
      duration: params.gateLength ?? params.duration ?? 0.25,
      velocityModulation: params.velocityModulation ?? false
    };

    return new PhasePattern(config);
  }

  private validateEuclideanParameters(
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

  private validateProbabilityParameters(
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

  private validatePhaseParameters(
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
