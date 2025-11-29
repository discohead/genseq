import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * T058: Macro entity model and YAML loader
 *
 * Enables one-to-many control: single input controls multiple pattern parameters
 */

export interface MacroTarget {
  patternId: string; // Pattern ID or wildcard (*,drum-*,*-kick)
  parameter: string; // Parameter name (density, velocity, note, etc.)
  scale?: number; // Scaling factor (0-2.0, default 1.0)
  offset?: number; // Offset value (-127 to +127, default 0)
  clamp?: {
    min?: number;
    max?: number;
  };
  priority?: number; // Execution priority (default 0)
}

export interface MacroEntity {
  id: string;
  targets: MacroTarget[];
}

/**
 * Validation rules for Macro entity
 */
export class MacroEntityValidator {
  static validate(config: any): MacroEntity {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Macro configuration must be an object');
    }

    // Validate ID
    if (typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('Macro ID is required and must be a non-empty string');
    }

    // Validate targets
    if (!Array.isArray(config.targets)) {
      throw new Error('Macro targets is required and must be an array');
    }

    if (config.targets.length === 0) {
      throw new Error('Macro targets cannot be empty, must have at least one target');
    }

    const targets = config.targets.map((target: any, index: number) => {
      return this.validateTarget(target, index);
    });

    return {
      id: config.id,
      targets
    };
  }

  private static validateTarget(target: any, index: number): MacroTarget {
    if (typeof target !== 'object' || target === null) {
      throw new Error(`Macro target ${index} must be an object`);
    }

    // Validate patternId
    if (typeof target.patternId !== 'string' || target.patternId.trim() === '') {
      throw new Error(`Macro target ${index}: patternId is required`);
    }

    // Validate wildcard pattern
    if (target.patternId.includes('*')) {
      const asteriskCount = (target.patternId.match(/\*/g) || []).length;
      if (asteriskCount > 1) {
        throw new Error(`Wildcard pattern can only have a single wildcard`);
      }
      // Valid patterns: *, prefix-*, *-suffix
      const validPattern = /^(\*|[\w-]+\*|\*[\w-]+)$/;
      if (!validPattern.test(target.patternId)) {
        throw new Error(`Wildcard pattern can only have a single wildcard`);
      }
    }

    // Validate parameter
    if (typeof target.parameter !== 'string' || target.parameter.trim() === '') {
      throw new Error(`Macro target ${index}: parameter is required`);
    }

    // Validate scale (default 1.0)
    // Note: scale can be large when derived from scaling: { min, max } ranges
    // e.g., pulses 1-8 produces scale=7, steps 1-16 produces scale=15
    let scale = 1.0;
    if (target.scale !== undefined) {
      if (typeof target.scale !== 'number') {
        throw new Error(`Macro target ${index}: scale must be a number`);
      }
      if (target.scale < 0) {
        throw new Error(`Macro target ${index}: scale cannot be negative`);
      }
      scale = target.scale;
    }

    // Validate offset (default 0)
    let offset = 0;
    if (target.offset !== undefined) {
      if (typeof target.offset !== 'number') {
        throw new Error(`Macro target ${index}: offset must be a number`);
      }
      if (target.offset < -127 || target.offset > 127) {
        throw new Error(`Macro target ${index}: offset must be between -127 and 127`);
      }
      offset = target.offset;
    }

    // Validate clamp
    let clamp: { min?: number; max?: number } | undefined;
    if (target.clamp !== undefined) {
      if (typeof target.clamp !== 'object' || target.clamp === null) {
        throw new Error(`Macro target ${index}: clamp must be an object`);
      }

      if (target.clamp.min !== undefined && target.clamp.max !== undefined) {
        if (target.clamp.min > target.clamp.max) {
          throw new Error(`Macro target ${index}: clamp min cannot be greater than max`);
        }
      }

      clamp = target.clamp;
    }

    // Validate priority (default 0)
    let priority = 0;
    if (target.priority !== undefined) {
      if (typeof target.priority !== 'number' || !Number.isInteger(target.priority)) {
        throw new Error(`Macro target ${index}: priority must be an integer`);
      }
      priority = target.priority;
    }

    return {
      patternId: target.patternId,
      parameter: target.parameter,
      scale,
      offset,
      clamp,
      priority
    };
  }
}

/**
 * Loader for Macro entity from file
 */
export class MacroEntityLoader {
  /**
   * Normalize macro config from file format to internal format
   *
   * Converts:
   * - scaling: { min, max } → scale, offset, clamp
   *   Formula: output = min + (input * (max - min))
   *   Where input is expected to be 0-1 from mapping transform
   */
  private static normalizeConfig(config: any): any {
    const normalized = { ...config };

    if (config.targets && Array.isArray(config.targets)) {
      normalized.targets = config.targets.map((target: any) => {
        const normalizedTarget = { ...target };

        // Convert scaling: { min, max } to scale/offset/clamp
        if (target.scaling && !target.scale && !target.offset) {
          const { min, max } = target.scaling;

          if (typeof min === 'number' && typeof max === 'number') {
            // Formula: output = min + (input * (max - min))
            // In scale/offset terms: output = (input * scale) + offset
            normalizedTarget.scale = max - min;
            normalizedTarget.offset = min;
            normalizedTarget.clamp = { min, max };
          }

          delete normalizedTarget.scaling;
        }

        return normalizedTarget;
      });
    }

    return normalized;
  }

  static load(filePath: string): MacroEntity {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let config: any;
      if (ext === '.yaml' || ext === '.yml') {
        config = yaml.load(content);
      } else if (ext === '.json') {
        config = JSON.parse(content);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      // Normalize config before validation
      const normalizedConfig = this.normalizeConfig(config);

      return MacroEntityValidator.validate(normalizedConfig);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Macro file not found: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse macro file ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }
}
