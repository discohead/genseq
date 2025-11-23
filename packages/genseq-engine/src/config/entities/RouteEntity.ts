import * as fs from 'fs';
import * as path from 'path';

/**
 * T029: Route entity model for bus-to-device mapping
 *
 * Represents MIDI routing configuration from logical buses to physical devices
 */

export interface RouteEntity {
  id: string;
  bus: string;
  device: string;
  channel: number;
  enabled?: boolean;
  transform?: RouteTransform;
}

export interface RouteTransform {
  transpose?: number;
  velocityScale?: number;
  velocityOffset?: number;
  channelOverride?: number;
}

/**
 * Validation rules for Route entity
 */
export class RouteEntityValidator {
  static validate(config: any): RouteEntity {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Route configuration must be an object');
    }

    // Validate required fields
    if (typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('Route ID is required and must be a non-empty string');
    }

    if (typeof config.bus !== 'string' || config.bus.trim() === '') {
      throw new Error('Route bus is required and must be a non-empty string');
    }

    if (typeof config.device !== 'string' || config.device.trim() === '') {
      throw new Error('Route device is required and must be a non-empty string');
    }

    // Validate channel
    const channel = config.channel !== undefined ? config.channel : 1;
    if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 1 || channel > 16) {
      throw new Error(`Route channel must be between 1 and 16, got ${channel}`);
    }

    // Validate enabled flag
    const enabled = config.enabled !== undefined ? config.enabled : true;
    if (typeof enabled !== 'boolean') {
      throw new Error('Route enabled must be a boolean');
    }

    // Validate transform if present
    let transform: RouteTransform | undefined;
    if (config.transform !== undefined) {
      transform = this.validateTransform(config.transform);
    }

    return {
      id: config.id,
      bus: config.bus,
      device: config.device,
      channel,
      enabled,
      transform
    };
  }

  private static validateTransform(transform: any): RouteTransform {
    if (typeof transform !== 'object' || transform === null) {
      throw new Error('Route transform must be an object');
    }

    const validated: RouteTransform = {};

    // Validate transpose
    if (transform.transpose !== undefined) {
      if (typeof transform.transpose !== 'number' || !Number.isInteger(transform.transpose)) {
        throw new Error('Transform transpose must be an integer');
      }
      if (transform.transpose < -127 || transform.transpose > 127) {
        throw new Error(`Transform transpose must be between -127 and 127, got ${transform.transpose}`);
      }
      validated.transpose = transform.transpose;
    }

    // Validate velocityScale
    if (transform.velocityScale !== undefined) {
      if (typeof transform.velocityScale !== 'number') {
        throw new Error('Transform velocityScale must be a number');
      }
      if (transform.velocityScale < 0 || transform.velocityScale > 2) {
        throw new Error(`Transform velocityScale must be between 0 and 2, got ${transform.velocityScale}`);
      }
      validated.velocityScale = transform.velocityScale;
    }

    // Validate velocityOffset
    if (transform.velocityOffset !== undefined) {
      if (typeof transform.velocityOffset !== 'number' || !Number.isInteger(transform.velocityOffset)) {
        throw new Error('Transform velocityOffset must be an integer');
      }
      if (transform.velocityOffset < -127 || transform.velocityOffset > 127) {
        throw new Error(`Transform velocityOffset must be between -127 and 127, got ${transform.velocityOffset}`);
      }
      validated.velocityOffset = transform.velocityOffset;
    }

    // Validate channelOverride
    if (transform.channelOverride !== undefined) {
      if (typeof transform.channelOverride !== 'number' || !Number.isInteger(transform.channelOverride)) {
        throw new Error('Transform channelOverride must be an integer');
      }
      if (transform.channelOverride < 1 || transform.channelOverride > 16) {
        throw new Error(`Transform channelOverride must be between 1 and 16, got ${transform.channelOverride}`);
      }
      validated.channelOverride = transform.channelOverride;
    }

    return validated;
  }
}

/**
 * Loader for Route entity from JSON files
 */
export class RouteEntityLoader {
  /**
   * Load route configuration from JSON file
   */
  static loadFromFile(filePath: string): RouteEntity {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Route file not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext !== '.json') {
      throw new Error(`Route files must be in JSON format, got ${ext}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      return RouteEntityValidator.validate(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load route from ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load multiple routes from a directory
   */
  static loadFromDirectory(dirPath: string): RouteEntity[] {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Route directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    const routes: RouteEntity[] = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        routes.push(this.loadFromFile(filePath));
      } catch (error) {
        // Log error but continue loading other routes
        console.error(`Error loading route ${file}:`, error);
      }
    }

    return routes;
  }

  /**
   * Load routes from array in single JSON file
   */
  static loadArrayFromFile(filePath: string): RouteEntity[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Route file not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        throw new Error('Route file must contain an array of routes');
      }

      return data.map((config, index) => {
        try {
          return RouteEntityValidator.validate(config);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Route at index ${index}: ${error.message}`);
          }
          throw error;
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load routes from ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create default route
   */
  static createDefault(bus: string, device: string = 'virtual', channel: number = 1): RouteEntity {
    return {
      id: `route-${bus}`,
      bus,
      device,
      channel,
      enabled: true
    };
  }
}
