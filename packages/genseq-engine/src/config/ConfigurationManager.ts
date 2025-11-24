import { EventEmitter } from 'events';
import { ClockEntity } from './entities/ClockEntity.js';
import { PatternEntity } from './entities/PatternEntity.js';
import { RouteEntity } from './entities/RouteEntity.js';

/**
 * T047: ConfigurationManager with dual-buffer atomic configuration swaps
 *
 * Implements atomic swap pattern for hot-reloading configurations:
 * - Active buffer: currently playing configuration
 * - Pending buffer: staged configuration awaiting swap
 *
 * Features:
 * - Atomic swaps (no partial state visible)
 * - Validation before swap
 * - Rollback on validation failure
 * - Thread-safe concurrent access
 * - Conditional swaps with predicates
 * - Immutable config snapshots
 */

export interface ProjectConfig {
  bpm?: number;
  ppq?: number;
  measure?: number;
  iteration?: number;
  timestamp?: number;
  id?: number;
  version?: number;
  patterns?: any[];
  routes?: any[];
  clock?: ClockEntity;
  patternEntities?: PatternEntity[];
  routeEntities?: RouteEntity[];
  [key: string]: any;
}

export interface ConfigurationManagerOptions {
  validateOnSwap?: boolean;
}

export interface ConfigSnapshot {
  id: string;
  config: ProjectConfig;
  timestamp: number;
}

export interface ConfigDiff {
  changed: string[];
  unchanged: string[];
  added: string[];
  removed: string[];
}

/**
 * ConfigurationManager: Thread-safe dual-buffer configuration management
 */
export class ConfigurationManager extends EventEmitter {
  private activeConfig: ProjectConfig | null = null;
  private pendingConfig: ProjectConfig | null = null;
  private swapLock = false;
  private loadLock = false;
  private validator: ((config: ProjectConfig) => boolean) | null = null;
  private options: ConfigurationManagerOptions;
  private snapshots: Map<string, ConfigSnapshot> = new Map();

  constructor(options: ConfigurationManagerOptions = {}) {
    super();
    this.options = {
      validateOnSwap: options.validateOnSwap !== undefined ? options.validateOnSwap : true
    };
  }

  /**
   * Set the active configuration (initial setup)
   */
  setActive(config: ProjectConfig): void {
    // Deep clone to ensure immutability
    this.activeConfig = this.deepClone(config);
  }

  /**
   * Get the currently active configuration
   */
  getActive(): ProjectConfig {
    if (!this.activeConfig) {
      throw new Error('No active configuration set');
    }
    // Return deep clone to prevent external mutations
    return this.deepClone(this.activeConfig);
  }

  /**
   * Check if active configuration exists
   */
  hasActive(): boolean {
    return this.activeConfig !== null;
  }

  /**
   * Load configuration into pending buffer
   */
  async loadPending(config: ProjectConfig): Promise<void> {
    // Wait for any active load to complete
    while (this.loadLock) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.loadLock = true;
    try {
      // Deep clone to ensure immutability
      this.pendingConfig = this.deepClone(config);
    } finally {
      this.loadLock = false;
    }
  }

  /**
   * Get the pending configuration
   */
  getPending(): ProjectConfig | null {
    if (!this.pendingConfig) {
      return null;
    }
    return this.deepClone(this.pendingConfig);
  }

  /**
   * Check if pending configuration exists
   */
  hasPending(): boolean {
    return this.pendingConfig !== null;
  }

  /**
   * Clear the pending buffer
   */
  clearPending(): void {
    this.pendingConfig = null;
  }

  /**
   * Set custom validator function
   */
  setValidator(validator: (config: ProjectConfig) => boolean): void {
    this.validator = validator;
  }

  /**
   * Perform atomic swap from pending to active
   */
  async swap(): Promise<void> {
    // Wait for any active swap to complete
    while (this.swapLock) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.swapLock = true;
    try {
      if (!this.pendingConfig) {
        throw new Error('No pending configuration to swap');
      }

      // Emit beforeSwap event
      this.emit('beforeSwap');

      // Validate if enabled and validator is set
      if (this.options.validateOnSwap && this.validator) {
        try {
          this.validator(this.pendingConfig);
        } catch (error) {
          // Validation failed - rollback
          this.pendingConfig = null;
          this.emit('validationFailed', { errors: error });
          throw error;
        }
      }

      // Atomic swap: single assignment to ensure no partial state
      this.activeConfig = this.pendingConfig;
      this.pendingConfig = null;

      // Emit afterSwap event
      this.emit('afterSwap');
    } finally {
      this.swapLock = false;
    }
  }

  /**
   * Conditional swap with predicate function
   */
  async swapIf(predicate: () => boolean): Promise<boolean> {
    if (!predicate()) {
      return false;
    }

    await this.swap();
    return true;
  }

  /**
   * Create a snapshot of the current active configuration
   */
  createSnapshot(): string {
    if (!this.activeConfig) {
      throw new Error('No active configuration to snapshot');
    }

    const id = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snapshot: ConfigSnapshot = {
      id,
      config: this.deepClone(this.activeConfig),
      timestamp: Date.now()
    };

    this.snapshots.set(id, snapshot);
    return id;
  }

  /**
   * Restore configuration from a snapshot
   */
  restoreSnapshot(snapshotId: string): void {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    this.activeConfig = this.deepClone(snapshot.config);
  }

  /**
   * Get diff between active and pending configurations
   */
  getDiff(): ConfigDiff {
    if (!this.activeConfig || !this.pendingConfig) {
      return {
        changed: [],
        unchanged: [],
        added: [],
        removed: []
      };
    }

    const changed: string[] = [];
    const unchanged: string[] = [];
    const added: string[] = [];
    const removed: string[] = [];

    // Get all keys from both configs
    const activeKeys = new Set(Object.keys(this.activeConfig));
    const pendingKeys = new Set(Object.keys(this.pendingConfig));

    // Check for changed and unchanged keys
    for (const key of activeKeys) {
      if (pendingKeys.has(key)) {
        const activeVal = this.activeConfig[key];
        const pendingVal = this.pendingConfig[key];

        if (this.isEqual(activeVal, pendingVal)) {
          unchanged.push(key);
        } else {
          changed.push(key);

          // Detect added array elements
          if (Array.isArray(activeVal) && Array.isArray(pendingVal)) {
            if (pendingVal.length > activeVal.length) {
              for (let i = activeVal.length; i < pendingVal.length; i++) {
                added.push(`${key}[${i}]`);
              }
            }
          }
        }
      } else {
        removed.push(key);
      }
    }

    // Check for new keys in pending
    for (const key of pendingKeys) {
      if (!activeKeys.has(key)) {
        added.push(key);
      }
    }

    return { changed, unchanged, added, removed };
  }

  /**
   * Dispose of the configuration manager
   */
  dispose(): void {
    this.activeConfig = null;
    this.pendingConfig = null;
    this.validator = null;
    this.snapshots.clear();
    this.removeAllListeners();
  }

  /**
   * Deep clone helper to ensure immutability
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as any;
    }

    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  /**
   * Deep equality check
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((item, i) => this.isEqual(item, b[i]));
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      return keysA.every(key => this.isEqual(a[key], b[key]));
    }

    return false;
  }
}
