import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * T028: Pattern entity model and JSON/YAML loader
 *
 * Represents pattern configuration loaded from pattern JSON files
 */

export interface PatternEntity {
  id: string;
  name: string;
  type: 'euclidean' | 'probability' | 'phase' | 'script' | 'techno-kick-bass' | 'techno-hihat' | 'techno-chord' | 'techno-lead';
  enabled: boolean;
  length: number; // bars
  division: number; // note division
  bus: string;
  note?: number;
  channel?: number;
  parameters: PatternParameters;
  scriptPath?: string;
  scriptParams?: Record<string, any>;
}

export interface PatternParameters {
  // Euclidean
  steps?: number;
  pulses?: number;
  rotation?: number;

  // Probability
  probability?: number;
  density?: number;

  // Phase
  phaseOffset?: number;
  phaseRate?: number;

  // Common
  velocity?: number | number[];
  gateLength?: number;
  humanize?: number;
}

/**
 * Validation rules for Pattern entity
 */
export class PatternEntityValidator {
  static validate(config: any): PatternEntity {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Pattern configuration must be an object');
    }

    // Validate required fields
    if (typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('Pattern ID is required and must be a non-empty string');
    }

    if (typeof config.name !== 'string' || config.name.trim() === '') {
      throw new Error('Pattern name is required and must be a non-empty string');
    }

    const validTypes = ['euclidean', 'probability', 'phase', 'script', 'techno-kick-bass', 'techno-hihat', 'techno-chord', 'techno-lead'];
    if (!validTypes.includes(config.type)) {
      throw new Error(`Pattern type must be one of [${validTypes.join(', ')}], got ${config.type}`);
    }

    if (typeof config.bus !== 'string' || config.bus.trim() === '') {
      throw new Error('Pattern bus is required and must be a non-empty string');
    }

    // Validate optional fields
    const enabled = config.enabled !== undefined ? config.enabled : true;
    if (typeof enabled !== 'boolean') {
      throw new Error('Pattern enabled must be a boolean');
    }

    const length = config.length !== undefined ? config.length : 1;
    if (typeof length !== 'number' || length <= 0) {
      throw new Error('Pattern length must be a positive number');
    }

    const division = config.division !== undefined ? config.division : 4;
    if (typeof division !== 'number' || division <= 0) {
      throw new Error('Pattern division must be a positive number');
    }

    // Validate note if present
    if (config.note !== undefined) {
      if (typeof config.note !== 'number' || config.note < 0 || config.note > 127) {
        throw new Error(`Pattern note must be between 0 and 127, got ${config.note}`);
      }
    }

    // Validate channel if present
    if (config.channel !== undefined) {
      if (typeof config.channel !== 'number' || config.channel < 1 || config.channel > 16) {
        throw new Error(`Pattern channel must be between 1 and 16, got ${config.channel}`);
      }
    }

    // Validate parameters based on type
    // Parameters can be under 'parameters' or under the type-specific key (e.g., 'euclidean')
    // For techno patterns, extract all type-specific properties
    let parameters: any;
    if (config.type.startsWith('techno-')) {
      // Techno patterns: extract type-specific config (kick, bass, closed, open, etc.)
      parameters = this.extractTechnoParameters(config);
    } else {
      parameters = config.parameters || config[config.type] || {};
    }
    this.validateParameters(config.type, parameters);

    // Validate script path for script patterns
    if (config.type === 'script') {
      if (typeof config.scriptPath !== 'string' || config.scriptPath.trim() === '') {
        throw new Error('Script pattern must have a scriptPath');
      }
    }

    return {
      id: config.id,
      name: config.name,
      type: config.type,
      enabled,
      length,
      division,
      bus: config.bus,
      note: config.note,
      channel: config.channel,
      parameters,
      scriptPath: config.scriptPath,
      scriptParams: config.scriptParams
    };
  }

  /**
   * Extract techno-specific parameters from config
   * Techno patterns have properties like kick, bass, closed, open, chord, lead at root level
   */
  private static extractTechnoParameters(config: any): any {
    // Fields that are NOT pattern parameters (they're entity metadata)
    const metadataFields = ['$schema', 'id', 'name', 'type', 'bus', 'enabled', 'length', 'division', 'note', 'channel'];

    const params: any = {};
    for (const key of Object.keys(config)) {
      if (!metadataFields.includes(key)) {
        params[key] = config[key];
      }
    }
    return params;
  }

  private static validateParameters(type: string, params: any): void {
    if (typeof params !== 'object' || params === null) {
      throw new Error('Pattern parameters must be an object');
    }

    switch (type) {
      case 'euclidean':
        this.validateEuclideanParameters(params);
        break;
      case 'probability':
        this.validateProbabilityParameters(params);
        break;
      case 'phase':
        this.validatePhaseParameters(params);
        break;
      // script parameters are validated by the script itself
    }
  }

  private static validateEuclideanParameters(params: any): void {
    if (typeof params.steps !== 'number' || !Number.isInteger(params.steps) || params.steps <= 0) {
      throw new Error('Euclidean pattern steps must be a positive integer');
    }

    if (typeof params.pulses !== 'number' || !Number.isInteger(params.pulses) || params.pulses < 0) {
      throw new Error('Euclidean pattern pulses must be a non-negative integer');
    }

    if (params.pulses > params.steps) {
      throw new Error('Euclidean pattern pulses cannot exceed steps');
    }

    if (params.rotation !== undefined) {
      if (typeof params.rotation !== 'number' || !Number.isInteger(params.rotation) || params.rotation < 0) {
        throw new Error('Euclidean pattern rotation must be a non-negative integer');
      }
    }
  }

  private static validateProbabilityParameters(params: any): void {
    if (typeof params.probability !== 'number' || params.probability < 0 || params.probability > 100) {
      throw new Error('Probability pattern probability must be between 0 and 100');
    }

    if (params.density !== undefined) {
      if (typeof params.density !== 'number' || params.density < 0 || params.density > 1) {
        throw new Error('Probability pattern density must be between 0 and 1');
      }
    }
  }

  private static validatePhaseParameters(params: any): void {
    if (params.phaseOffset !== undefined) {
      if (typeof params.phaseOffset !== 'number') {
        throw new Error('Phase pattern phaseOffset must be a number');
      }
    }

    if (params.phaseRate !== undefined) {
      if (typeof params.phaseRate !== 'number') {
        throw new Error('Phase pattern phaseRate must be a number');
      }
    }
  }
}

/**
 * Loader for Pattern entity from JSON files
 */
export class PatternEntityLoader {
  /**
   * Load pattern configuration from JSON or YAML file
   */
  static loadFromFile(filePath: string): PatternEntity {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Pattern file not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') {
      throw new Error(`Pattern files must be in JSON or YAML format, got ${ext}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let data: any;

      if (ext === '.json') {
        data = JSON.parse(content);
      } else {
        data = yaml.load(content);
      }

      return PatternEntityValidator.validate(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load pattern from ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load multiple patterns from a directory
   */
  static loadFromDirectory(dirPath: string): PatternEntity[] {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Pattern directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath).filter(f =>
      f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')
    );
    const patterns: PatternEntity[] = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        patterns.push(this.loadFromFile(filePath));
      } catch (error) {
        // Log error but continue loading other patterns
        console.error(`Error loading pattern ${file}:`, error);
      }
    }

    return patterns;
  }

  /**
   * Create default euclidean pattern
   */
  static createDefaultEuclidean(id: string, bus: string): PatternEntity {
    return {
      id,
      name: `Euclidean ${id}`,
      type: 'euclidean',
      enabled: true,
      length: 1,
      division: 4,
      bus,
      note: 60,
      channel: 1,
      parameters: {
        steps: 16,
        pulses: 4,
        rotation: 0,
        velocity: 100,
        gateLength: 24
      }
    };
  }
}
