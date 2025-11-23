import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * T027: Clock entity model and YAML loader
 *
 * Represents clock configuration loaded from clock.yaml
 */

export interface ClockEntity {
  bpm: number;
  ppq: number;
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
  swing?: number;
}

export interface ClockPosition {
  bar: number;
  beat: number;
  tick: number;
}

/**
 * Validation rules for Clock entity
 */
export class ClockEntityValidator {
  static validate(config: any): ClockEntity {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Clock configuration must be an object');
    }

    // Validate BPM
    if (typeof config.bpm !== 'number') {
      throw new Error('Clock BPM must be a number');
    }

    if (config.bpm < 20 || config.bpm > 999) {
      throw new Error(`Clock BPM must be between 20 and 999, got ${config.bpm}`);
    }

    // Validate PPQ
    if (typeof config.ppq !== 'number' || !Number.isInteger(config.ppq)) {
      throw new Error('Clock PPQ must be an integer');
    }

    const validPPQ = [24, 48, 96, 192, 384, 480, 960];
    if (!validPPQ.includes(config.ppq)) {
      throw new Error(`Clock PPQ must be one of [${validPPQ.join(', ')}], got ${config.ppq}`);
    }

    // Validate time signature if present
    if (config.timeSignature !== undefined) {
      if (typeof config.timeSignature !== 'object') {
        throw new Error('Time signature must be an object');
      }

      const { numerator, denominator } = config.timeSignature;

      if (typeof numerator !== 'number' || !Number.isInteger(numerator)) {
        throw new Error('Time signature numerator must be an integer');
      }

      if (numerator < 1 || numerator > 32) {
        throw new Error(`Time signature numerator must be between 1 and 32, got ${numerator}`);
      }

      if (typeof denominator !== 'number' || !Number.isInteger(denominator)) {
        throw new Error('Time signature denominator must be an integer');
      }

      const validDenominators = [2, 4, 8, 16];
      if (!validDenominators.includes(denominator)) {
        throw new Error(`Time signature denominator must be one of [${validDenominators.join(', ')}], got ${denominator}`);
      }
    }

    // Validate swing if present
    if (config.swing !== undefined) {
      if (typeof config.swing !== 'number') {
        throw new Error('Swing must be a number');
      }

      if (config.swing < 0 || config.swing > 100) {
        throw new Error(`Swing must be between 0 and 100, got ${config.swing}`);
      }
    }

    return {
      bpm: config.bpm,
      ppq: config.ppq,
      timeSignature: config.timeSignature || { numerator: 4, denominator: 4 },
      swing: config.swing || 0
    };
  }
}

/**
 * Loader for Clock entity from YAML files
 */
export class ClockEntityLoader {
  /**
   * Load clock configuration from YAML file
   */
  static loadFromFile(filePath: string): ClockEntity {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Clock file not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      return this.loadFromYAML(filePath);
    } else if (ext === '.json') {
      return this.loadFromJSON(filePath);
    } else {
      throw new Error(`Unsupported clock file format: ${ext}. Use .yaml, .yml, or .json`);
    }
  }

  /**
   * Load from YAML file
   */
  private static loadFromYAML(filePath: string): ClockEntity {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = yaml.load(content);

      return ClockEntityValidator.validate(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load clock from ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load from JSON file
   */
  private static loadFromJSON(filePath: string): ClockEntity {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      return ClockEntityValidator.validate(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load clock from ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create default clock configuration
   */
  static createDefault(): ClockEntity {
    return {
      bpm: 120,
      ppq: 960,
      timeSignature: { numerator: 4, denominator: 4 },
      swing: 0
    };
  }
}
