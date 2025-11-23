import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar from 'chokidar';
import YAML from 'yaml';
import { SchemaValidator, type ValidationResult } from './SchemaValidator';

export interface ConfigLoaderConfig {
  watchEnabled?: boolean;
  validateOnLoad?: boolean;
  enableCache?: boolean;
  debounceMs?: number;
}

export interface LoadOptions {
  validate?: boolean;
}

export interface WatchOptions {
  debounceMs?: number;
}

/**
 * T019: Configuration loader with file watching
 *
 * Loads JSON/YAML files with hot-reload support
 * Uses chokidar for efficient file watching
 * Integrates with SchemaValidator for validation
 */
export class ConfigLoader extends EventEmitter {
  private config: ConfigLoaderConfig;
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private cache: Map<string, { data: any; mtime: number }> = new Map();
  private schema: any | null = null;
  private validator: SchemaValidator;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ConfigLoaderConfig = {}) {
    super();
    this.config = {
      watchEnabled: false,
      validateOnLoad: false,
      enableCache: false,
      debounceMs: 100,
      ...config
    };
    this.validator = new SchemaValidator({ enableLineNumbers: true });
  }

  async loadFile(filePath: string, options: LoadOptions = {}): Promise<any> {
    const absolutePath = path.resolve(filePath);

    // Check cache if enabled
    if (this.config.enableCache) {
      const cached = await this.checkCache(absolutePath);
      if (cached) {
        return cached;
      }
    }

    try {
      // Read file
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Parse based on extension
      const ext = path.extname(absolutePath).toLowerCase();
      let data: any;

      if (ext === '.json') {
        try {
          data = JSON.parse(content);
        } catch (parseError: any) {
          throw new Error(`Failed to parse JSON file: ${parseError.message}`);
        }
      } else if (ext === '.yaml' || ext === '.yml') {
        try {
          data = YAML.parse(content);
        } catch (parseError: any) {
          throw new Error(`Failed to parse YAML file: ${parseError.message}`);
        }
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      // Validate if schema is set and validation is enabled
      const shouldValidate = options.validate !== undefined ? options.validate : this.config.validateOnLoad;

      if (shouldValidate && this.schema) {
        const result = this.validator.validate(data, this.schema, { filePath: absolutePath });

        if (!result.valid) {
          const errorMessages = result.errors.map(e => e.message).join(', ');
          const error: any = new Error(`Configuration validation failed: ${errorMessages}`);
          error.validationErrors = result.errors;
          throw error;
        }
      }

      // Update cache
      if (this.config.enableCache) {
        const stats = await fs.stat(absolutePath);
        this.cache.set(absolutePath, {
          data,
          mtime: stats.mtimeMs
        });
      }

      return data;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${absolutePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied reading configuration file: ${absolutePath}`);
      } else {
        throw error;
      }
    }
  }

  async watch(filePath: string, options: WatchOptions = {}): Promise<void> {
    const absolutePath = path.resolve(filePath);

    if (this.watchers.has(absolutePath)) {
      return; // Already watching
    }

    const debounceMs = options.debounceMs || this.config.debounceMs || 100;

    const watcher = chokidar.watch(absolutePath, {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', async (changedPath) => {
      // Debounce rapid changes
      if (this.debounceTimers.has(absolutePath)) {
        clearTimeout(this.debounceTimers.get(absolutePath)!);
      }

      const timer = setTimeout(async () => {
        this.debounceTimers.delete(absolutePath);

        try {
          // Invalidate cache
          this.cache.delete(absolutePath);

          // Reload config
          const config = await this.loadFile(absolutePath);

          this.emit('reload', config, absolutePath);
        } catch (error) {
          this.emit('error', error);
        }
      }, debounceMs);

      this.debounceTimers.set(absolutePath, timer);
    });

    watcher.on('unlink', () => {
      this.emit('error', new Error(`Configuration file deleted: ${absolutePath}`));
    });

    watcher.on('error', (error) => {
      this.emit('error', error);
    });

    this.watchers.set(absolutePath, watcher);
  }

  async dispose(): Promise<void> {
    // Close all watchers
    for (const [path, watcher] of this.watchers) {
      await watcher.close();
    }

    this.watchers.clear();

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }

    this.debounceTimers.clear();

    // Clear cache
    this.cache.clear();
  }

  setSchema(schema: any): void {
    this.schema = schema;
  }

  isCached(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    return this.cache.has(absolutePath);
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async checkCache(absolutePath: string): Promise<any | null> {
    const cached = this.cache.get(absolutePath);

    if (!cached) {
      return null;
    }

    try {
      // Check if file has been modified
      const stats = await fs.stat(absolutePath);

      if (stats.mtimeMs === cached.mtime) {
        return cached.data;
      }

      // File has been modified, invalidate cache
      this.cache.delete(absolutePath);
      return null;
    } catch (error) {
      // File doesn't exist anymore, invalidate cache
      this.cache.delete(absolutePath);
      return null;
    }
  }
}
