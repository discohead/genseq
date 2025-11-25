import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * T057: Mapping entity model and YAML loader
 *
 * Maps MIDI input (CC, notes, pitch bend) to pattern parameters, macros, or scenes
 */

// Source types
export type MappingSourceType = 'cc' | 'note' | 'pitchbend' | 'parameter';

export interface CCSource {
  type: 'cc';
  channel: number; // 1-16
  controller: number; // 0-127
  device?: string; // Optional device filter
}

export interface NoteSource {
  type: 'note';
  channel: number; // 1-16
  note: number; // 0-127
  device?: string;
}

export interface PitchBendSource {
  type: 'pitchbend';
  channel: number; // 1-16
  device?: string;
}

export interface ParameterSource {
  type: 'parameter';
  patternId: string;
  parameter: string;
}

export type MappingSource = CCSource | NoteSource | PitchBendSource | ParameterSource;

// Target types
export type MappingTargetType = 'parameter' | 'macro' | 'scene';

export interface ParameterTarget {
  type: 'parameter';
  patternId: string;
  parameter: string;
}

export interface MacroTarget {
  type: 'macro';
  macroId: string;
}

export interface SceneTarget {
  type: 'scene';
  sceneId: string;
}

export type MappingTarget = ParameterTarget | MacroTarget | SceneTarget;

// Transform types
export type TransformType = 'linear' | 'exponential';

export interface TransformConfig {
  type: TransformType;
  inputRange: [number, number];
  outputRange: [number, number];
  curve?: number; // Required for exponential
  smoothing?: number; // Milliseconds for time-based averaging
  deadZone?: number; // Ignore values 0-n at start
  deadZoneEnd?: number; // Ignore values at end
}

export interface MappingEntity {
  id: string;
  source: MappingSource;
  target: MappingTarget;
  transform?: TransformConfig; // Not required for scene triggers
  quantize?: 'bar' | 'beat'; // For scene triggers
}

/**
 * Validation rules for Mapping entity
 */
export class MappingEntityValidator {
  static validate(config: any): MappingEntity {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Mapping configuration must be an object');
    }

    // Validate ID
    if (typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('Mapping ID is required and must be a non-empty string');
    }

    // Validate source
    const source = this.validateSource(config.source);

    // Validate target
    const target = this.validateTarget(config.target);

    // Validate transform (required unless target is scene)
    let transform: TransformConfig | undefined;
    if (target.type !== 'scene') {
      if (!config.transform) {
        throw new Error('Transform is required for non-scene targets');
      }
      transform = this.validateTransform(config.transform, source.type);
    }

    // Validate quantize (only for scene triggers)
    let quantize: 'bar' | 'beat' | undefined;
    if (config.quantize !== undefined) {
      if (target.type !== 'scene') {
        throw new Error('Quantize can only be used with scene targets');
      }
      if (config.quantize !== 'bar' && config.quantize !== 'beat') {
        throw new Error('Quantize must be "bar" or "beat"');
      }
      quantize = config.quantize;
    }

    return {
      id: config.id,
      source,
      target,
      transform,
      quantize
    };
  }

  private static validateSource(source: any): MappingSource {
    if (typeof source !== 'object' || source === null) {
      throw new Error('Mapping source must be an object');
    }

    const type = source.type as MappingSourceType;

    if (!['cc', 'note', 'pitchbend', 'parameter'].includes(type)) {
      throw new Error(`Invalid source type: ${type}`);
    }

    // Validate channel for MIDI sources
    if (type === 'cc' || type === 'note' || type === 'pitchbend') {
      if (typeof source.channel !== 'number') {
        throw new Error('Source channel is required and must be a number');
      }
      if (source.channel < 1 || source.channel > 16) {
        throw new Error(`Source channel must be between 1 and 16, got ${source.channel}`);
      }
    }

    // Type-specific validation
    switch (type) {
      case 'cc':
        if (typeof source.controller !== 'number') {
          throw new Error('CC controller number is required');
        }
        if (source.controller < 0 || source.controller > 127) {
          throw new Error(`CC controller must be between 0 and 127, got ${source.controller}`);
        }
        return source as CCSource;

      case 'note':
        if (typeof source.note !== 'number') {
          throw new Error('Note number is required');
        }
        if (source.note < 0 || source.note > 127) {
          throw new Error(`Note must be between 0 and 127, got ${source.note}`);
        }
        return source as NoteSource;

      case 'pitchbend':
        return source as PitchBendSource;

      case 'parameter':
        if (typeof source.patternId !== 'string' || source.patternId.trim() === '') {
          throw new Error('Source patternId is required for parameter source');
        }
        if (typeof source.parameter !== 'string' || source.parameter.trim() === '') {
          throw new Error('Source parameter is required for parameter source');
        }
        return source as ParameterSource;

      default:
        throw new Error(`Unknown source type: ${type}`);
    }
  }

  private static validateTarget(target: any): MappingTarget {
    if (typeof target !== 'object' || target === null) {
      throw new Error('Mapping target must be an object');
    }

    const type = target.type as MappingTargetType;

    if (!['parameter', 'macro', 'scene'].includes(type)) {
      throw new Error(`Invalid target type: ${type}`);
    }

    switch (type) {
      case 'parameter':
        if (typeof target.patternId !== 'string' || target.patternId.trim() === '') {
          throw new Error('Target patternId is required for parameter target');
        }
        if (typeof target.parameter !== 'string' || target.parameter.trim() === '') {
          throw new Error('Target parameter is required for parameter target');
        }
        return target as ParameterTarget;

      case 'macro':
        if (typeof target.macroId !== 'string' || target.macroId.trim() === '') {
          throw new Error('Target macroId is required for macro target');
        }
        return target as MacroTarget;

      case 'scene':
        if (typeof target.sceneId !== 'string' || target.sceneId.trim() === '') {
          throw new Error('Target sceneId is required for scene target');
        }
        return target as SceneTarget;

      default:
        throw new Error(`Unknown target type: ${type}`);
    }
  }

  private static validateTransform(transform: any, sourceType: MappingSourceType): TransformConfig {
    if (typeof transform !== 'object' || transform === null) {
      throw new Error('Transform must be an object');
    }

    // Validate type
    if (!['linear', 'exponential'].includes(transform.type)) {
      throw new Error(`Invalid transformation type: ${transform.type}`);
    }

    // Validate inputRange
    if (!Array.isArray(transform.inputRange) || transform.inputRange.length !== 2) {
      throw new Error('Transform inputRange must be an array of length 2');
    }
    if (typeof transform.inputRange[0] !== 'number' || typeof transform.inputRange[1] !== 'number') {
      throw new Error('Transform inputRange values must be numbers');
    }

    // Validate outputRange
    if (!Array.isArray(transform.outputRange) || transform.outputRange.length !== 2) {
      throw new Error('Transform outputRange must be an array of length 2');
    }
    if (typeof transform.outputRange[0] !== 'number' || typeof transform.outputRange[1] !== 'number') {
      throw new Error('Transform outputRange values must be numbers');
    }

    // Validate pitch bend input range
    if (sourceType === 'pitchbend') {
      const [min, max] = transform.inputRange;
      if (min !== -8192 || max !== 8191) {
        throw new Error('Pitch bend inputRange must be [-8192, 8191]');
      }
    }

    // Validate curve for exponential
    if (transform.type === 'exponential') {
      if (typeof transform.curve !== 'number') {
        throw new Error('Curve is required for exponential transformation');
      }
      if (transform.curve <= 0) {
        throw new Error('Curve must be positive for exponential transformation');
      }
    }

    // Validate smoothing
    if (transform.smoothing !== undefined) {
      if (typeof transform.smoothing !== 'number') {
        throw new Error('Smoothing must be a number (milliseconds)');
      }
      if (transform.smoothing < 0) {
        throw new Error('Smoothing cannot be negative');
      }
    }

    // Validate dead zone
    if (transform.deadZone !== undefined) {
      if (typeof transform.deadZone !== 'number') {
        throw new Error('Dead zone must be a number');
      }
      const rangeSize = Math.abs(transform.inputRange[1] - transform.inputRange[0]);
      if (Math.abs(transform.deadZone) > rangeSize / 2) {
        throw new Error('Dead zone exceeds half of input range');
      }
    }

    return transform as TransformConfig;
  }
}

/**
 * Loader for Mapping entity from file
 */
export class MappingEntityLoader {
  static load(filePath: string): MappingEntity {
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

      return MappingEntityValidator.validate(config);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Mapping file not found: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse mapping file ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }
}
