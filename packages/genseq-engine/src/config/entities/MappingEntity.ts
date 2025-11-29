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
export type TransformType = 'linear' | 'exponential' | 'logarithmic';

export interface TransformConfig {
  type: TransformType;
  inputRange: [number, number];
  outputRange: [number, number];
  curve?: number; // Required for exponential/logarithmic
  smoothing?: number; // Milliseconds for time-based averaging
  deadZone?: number; // Ignore values 0-n at start
  deadZoneEnd?: number; // Ignore values at end
  quantize?: number; // Snap to discrete steps (e.g., 12 for chromatic scale)
}

export interface MappingEntity {
  id: string;
  source: MappingSource;
  target: MappingTarget;
  transform?: TransformConfig; // Not required for scene triggers
  quantize?: 'bar' | 'beat'; // For scene triggers
  threshold?: number; // Minimum CC value to trigger (0-127), useful for buttons that send 127 on press, 0 on release
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

    // Validate threshold (for CC-triggered scene changes)
    let threshold: number | undefined;
    if (config.threshold !== undefined) {
      if (typeof config.threshold !== 'number') {
        throw new Error('Threshold must be a number');
      }
      if (config.threshold < 0 || config.threshold > 127) {
        throw new Error('Threshold must be between 0 and 127');
      }
      threshold = config.threshold;
    }

    return {
      id: config.id,
      source,
      target,
      transform,
      quantize,
      threshold
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
    if (!['linear', 'exponential', 'logarithmic'].includes(transform.type)) {
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
        throw new Error('Pitchbend inputRange must be -8192 to 8191');
      }
    }

    // Validate curve for exponential and logarithmic
    if (transform.type === 'exponential' || transform.type === 'logarithmic') {
      if (typeof transform.curve !== 'number') {
        throw new Error(`Curve is required for ${transform.type} transformation`);
      }
      if (transform.curve <= 0) {
        throw new Error(`Curve must be positive for ${transform.type} transformation`);
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

    // Validate deadZoneEnd
    if (transform.deadZoneEnd !== undefined) {
      if (typeof transform.deadZoneEnd !== 'number') {
        throw new Error('Dead zone end must be a number');
      }
      const rangeSize = Math.abs(transform.inputRange[1] - transform.inputRange[0]);
      if (Math.abs(transform.deadZoneEnd) > rangeSize / 2) {
        throw new Error('Dead zone end exceeds half of input range');
      }
    }

    // Validate quantize
    if (transform.quantize !== undefined) {
      if (typeof transform.quantize !== 'number') {
        throw new Error('Quantize must be a number');
      }
      if (transform.quantize <= 0) {
        throw new Error('Quantize must be positive');
      }
    }

    return transform as TransformConfig;
  }

  /**
   * Detect circular dependencies in mapping configurations (T067)
   *
   * Circular dependency occurs when:
   * - A parameter is mapped to a macro
   * - That macro targets the same parameter (or another parameter in the same pattern)
   * - Creating a feedback loop
   *
   * This is a graph analysis problem - we check for cycles in the dependency graph.
   *
   * @param mappings Array of all mapping configurations
   * @throws Error if circular dependency is detected
   */
  static detectCircularDependencies(mappings: MappingEntity[]): void {
    // Build dependency graph
    const graph = new Map<string, Set<string>>();

    for (const mapping of mappings) {
      // Source identifier
      let sourceKey: string | null = null;
      if (mapping.source.type === 'parameter') {
        sourceKey = `param:${mapping.source.patternId}:${mapping.source.parameter}`;
      }

      // Target identifier
      let targetKey: string | null = null;
      if (mapping.target.type === 'parameter') {
        targetKey = `param:${mapping.target.patternId}:${mapping.target.parameter}`;
      } else if (mapping.target.type === 'macro') {
        targetKey = `macro:${mapping.target.macroId}`;
      }

      // Add edge if both source and target are control flow elements
      if (sourceKey && targetKey) {
        if (!graph.has(sourceKey)) {
          graph.set(sourceKey, new Set());
        }
        graph.get(sourceKey)!.add(targetKey);
      }
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) {
        return true; // Cycle detected
      }
      if (visited.has(node)) {
        return false; // Already processed
      }

      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (hasCycle(neighbor)) {
            return true;
          }
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check all nodes for cycles
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          throw new Error(`Circular dependency detected in mapping configuration involving: ${node}`);
        }
      }
    }
  }
}

/**
 * Loader for Mapping entity from file
 */
export class MappingEntityLoader {
  /**
   * Normalize file format to internal entity format
   * Handles alternative field names from example files
   */
  private static normalizeConfig(config: any): any {
    const normalized: any = { ...config };

    // Normalize source: 'input' -> 'source'
    if (config.input && !config.source) {
      const input = config.input;
      normalized.source = {
        type: input.type,
        channel: input.channel,
        device: input.device === 'any' ? undefined : input.device,
      };

      // CC number -> controller
      if (input.type === 'cc' && input.number !== undefined) {
        normalized.source.controller = input.number;
      }

      // Note number
      if (input.type === 'note' && input.number !== undefined) {
        normalized.source.note = input.number;
      }

      delete normalized.input;
    }

    // Normalize target: 'macro' -> 'macroId'
    if (config.target) {
      normalized.target = { ...config.target };
      if (config.target.macro && !config.target.macroId) {
        normalized.target.macroId = config.target.macro;
        delete normalized.target.macro;
      }
    }

    // Normalize transform: inputMin/inputMax/outputMin/outputMax -> inputRange/outputRange
    if (config.transform) {
      const t = config.transform;
      normalized.transform = { ...t };

      // Infer type from curve string if present
      if (t.curve && typeof t.curve === 'string' && !t.type) {
        normalized.transform.type = t.curve;
      }

      // Default to linear if no type specified
      if (!normalized.transform.type) {
        normalized.transform.type = 'linear';
      }

      // Convert range format
      if (t.inputMin !== undefined && t.inputMax !== undefined && !t.inputRange) {
        normalized.transform.inputRange = [t.inputMin, t.inputMax];
        delete normalized.transform.inputMin;
        delete normalized.transform.inputMax;
      }

      if (t.outputMin !== undefined && t.outputMax !== undefined && !t.outputRange) {
        normalized.transform.outputRange = [t.outputMin, t.outputMax];
        delete normalized.transform.outputMin;
        delete normalized.transform.outputMax;
      }

      // smooth -> smoothing
      if (t.smooth !== undefined && t.smoothing === undefined) {
        normalized.transform.smoothing = t.smooth;
        delete normalized.transform.smooth;
      }

      // deadzone -> deadZone
      if (t.deadzone !== undefined && t.deadZone === undefined) {
        normalized.transform.deadZone = t.deadzone;
        delete normalized.transform.deadzone;
      }

      // Remove curve string (it's now the type)
      if (typeof normalized.transform.curve === 'string') {
        delete normalized.transform.curve;
      }

      // Add curve exponent for exponential/logarithmic if not present
      if ((normalized.transform.type === 'exponential' || normalized.transform.type === 'logarithmic') &&
          normalized.transform.curve === undefined) {
        normalized.transform.curve = 2.0; // Default curve exponent
      }
    }

    // Normalize behavior fields (for scene triggers)
    if (config.behavior) {
      // behavior.quantize -> quantize
      if (config.behavior.quantize && !config.quantize) {
        normalized.quantize = config.behavior.quantize;
      }
      // behavior.threshold -> threshold
      if (config.behavior.threshold !== undefined && config.threshold === undefined) {
        normalized.threshold = config.behavior.threshold;
      }
      delete normalized.behavior;
    }

    return normalized;
  }

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

      // Normalize config before validation
      const normalizedConfig = this.normalizeConfig(config);
      console.log(`[MappingEntityLoader] Normalized config for ${path.basename(filePath)}:`, JSON.stringify(normalizedConfig, null, 2));

      return MappingEntityValidator.validate(normalizedConfig);
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

  /**
   * Load multiple mappings from a directory
   */
  static loadFromDirectory(dirPath: string): MappingEntity[] {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Mapping directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath).filter(f =>
      f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')
    );
    const mappings: MappingEntity[] = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        mappings.push(this.load(filePath));
      } catch (error) {
        // Log error but continue loading other mappings
        console.error(`Error loading mapping ${file}:`, error);
      }
    }

    return mappings;
  }

  /**
   * Load mappings from array in single JSON/YAML file
   */
  static loadArrayFromFile(filePath: string): MappingEntity[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Mapping file not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let data: any;
      if (ext === '.yaml' || ext === '.yml') {
        data = yaml.load(content);
      } else if (ext === '.json') {
        data = JSON.parse(content);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      if (!Array.isArray(data)) {
        throw new Error('Mapping file must contain an array of mappings');
      }

      return data.map((config, index) => {
        try {
          return MappingEntityValidator.validate(config);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Mapping at index ${index}: ${error.message}`);
          }
          throw error;
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load mappings from ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }
}
