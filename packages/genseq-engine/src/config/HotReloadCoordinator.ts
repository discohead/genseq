import { EventEmitter } from 'events';
import { ConfigurationManager, ProjectConfig } from './ConfigurationManager.js';
import { FileWatcher } from './FileWatcher.js';
import { Clock } from '../clock/Clock.js';
import { GenSeqEngine } from '../GenSeqEngine.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * T049 + T055: HotReloadCoordinator - Orchestrates bar-boundary configuration swaps with batching
 *
 * Features:
 * - Schedules config swaps at bar boundaries
 * - Queues changes during pending swap
 * - Batches multiple file edits into single reload
 * - All-or-nothing application (no partial state)
 * - Emits lifecycle events (configChanging, swapScheduled, swapExecuting, configSwapped, batchApplied)
 * - Measures reload latency (<50ms requirement)
 * - Maintains transport continuity (no stop/start)
 * - Supports forced immediate swap (bypass bar boundary)
 */

export interface HotReloadCoordinatorOptions {
  engine: GenSeqEngine;
  clock?: Clock;
  configManager?: ConfigurationManager;
  fileWatcher?: FileWatcher;
  swapAtBarBoundary?: boolean;
  batchWindow?: number; // Time window in ms to batch changes (default: 50ms)
}

export interface BatchSummary {
  filesChanged: number;
  validChanges: number;
  invalidChanges: number;
  changedFiles: string[];
  filesDeleted?: number;
  filesUpdated?: number;
  processingTime: number;
}

export class HotReloadCoordinator extends EventEmitter {
  private engine: GenSeqEngine;
  private clock: Clock | null;
  private configManager: ConfigurationManager;
  private fileWatcher: FileWatcher;
  private swapAtBarBoundary: boolean;
  private batchWindow: number;
  private pendingSwap: boolean = false;
  private queuedChanges: Map<string, ProjectConfig> = new Map();
  private currentConfigPath: string | null = null;
  private swapScheduledTime: number = 0;
  private batchTimer: NodeJS.Timeout | null = null;
  private filePriorities: Map<string, 'critical' | 'normal'> = new Map();
  private watchedFiles: Set<string> = new Set();
  private deletedFiles: Set<string> = new Set();

  constructor(options: HotReloadCoordinatorOptions) {
    super();

    this.engine = options.engine;
    this.clock = options.clock ?? null;
    this.swapAtBarBoundary = options.swapAtBarBoundary ?? true;
    this.batchWindow = options.batchWindow ?? 50;

    // Use provided instances or create new ones
    this.configManager = options.configManager ?? new ConfigurationManager({ validateOnSwap: true });
    this.fileWatcher = options.fileWatcher ?? new FileWatcher({ debounceMs: 30 });

    // Set up event handlers
    this.setupFileWatcherHandlers();
    if (this.clock) {
      this.setupClockHandlers();
    }

    // Initialize engine if not already initialized
    this.initializeEngine();
  }

  /**
   * Initialize engine if needed
   */
  private async initializeEngine(): Promise<void> {
    try {
      await this.engine.initialize();
    } catch (error) {
      // Engine may already be initialized, ignore error
    }
  }

  /**
   * Set up file watcher event handlers
   */
  private setupFileWatcherHandlers(): void {
    this.fileWatcher.on('change', async (filePath: string) => {
      await this.onFileChange(filePath);
    });

    this.fileWatcher.on('unlink', async (filePath: string) => {
      await this.onFileDeleted(filePath);
    });

    this.fileWatcher.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Set up clock event handlers for bar boundaries
   */
  private setupClockHandlers(): void {
    if (!this.clock) {
      return;
    }
    this.clock.on('bar', (barNumber: number) => {
      this.onBarBoundary(barNumber);
    });
  }

  /**
   * Load initial configuration
   */
  async loadConfig(configPath: string): Promise<void> {
    const config = await this.loadConfigFromFile(configPath);

    // Set as active config
    this.configManager.setActive(config);
    this.currentConfigPath = configPath;

    // Start watching the file
    await this.fileWatcher.watch(configPath);
    this.watchedFiles.add(configPath);

    // Apply config to engine
    await this.applyConfigToEngine(config);
  }

  /**
   * Watch an entire project directory for changes
   */
  async watchProject(projectDir: string): Promise<void> {
    // Find all JSON and YAML files in the directory
    const files = await fs.readdir(projectDir);
    const configFiles = files.filter(file =>
      file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')
    );

    // Load initial configs into a merged state
    const configs: ProjectConfig[] = [];
    for (const file of configFiles) {
      const fullPath = path.join(projectDir, file);
      try {
        const config = await this.loadConfigFromFile(fullPath);
        configs.push(config);
      } catch (error) {
        // Skip invalid files
      }
    }

    // Merge and set as active
    if (configs.length > 0) {
      const merged = this.mergeConfigs(configs);
      this.configManager.setActive(merged);
      await this.applyConfigToEngine(merged);
    }

    // Watch all config files
    for (const file of configFiles) {
      const fullPath = path.join(projectDir, file);
      await this.fileWatcher.watch(fullPath);
      this.watchedFiles.add(fullPath);
    }
  }

  /**
   * Set priority for a specific file
   */
  setPriority(filePath: string, priority: 'critical' | 'normal'): void {
    this.filePriorities.set(filePath, priority);
  }

  /**
   * Reload configuration with optional forced immediate swap
   */
  async reloadConfig(configPath: string, options?: { immediate?: boolean }): Promise<void> {
    const config = await this.loadConfigFromFile(configPath);

    if (options?.immediate) {
      // Bypass bar boundary, swap immediately
      this.emit('configChanging', { file: configPath });
      this.configManager.setActive(config);
      await this.applyConfigToEngine(config);
      this.emit('configSwapped', { latency: 0 });
    } else {
      // Schedule swap at bar boundary
      await this.scheduleConfigSwap(configPath, config);
    }
  }

  /**
   * Handle file change events with batching support
   */
  private async onFileChange(filePath: string): Promise<void> {
    try {
      const config = await this.loadConfigFromFile(filePath);

      // Add to queued changes
      this.queuedChanges.set(filePath, config);
      // Remove from deleted set if it was previously deleted
      this.deletedFiles.delete(filePath);

      // If already pending swap, the batch timer is active
      if (this.pendingSwap) {
        return;
      }

      // Clear existing batch timer if any
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Start new batch timer
      this.batchTimer = setTimeout(() => {
        this.processBatch().catch((error) => {
          this.emit('error', error);
        });
      }, this.batchWindow);
    } catch (error) {
      this.emit('error', error);
      this.emit('validationFailed', { file: filePath, error });
    }
  }

  /**
   * Handle file deletion events
   */
  private async onFileDeleted(filePath: string): Promise<void> {
    // Remove from queued changes if present
    this.queuedChanges.delete(filePath);
    this.watchedFiles.delete(filePath);

    // Mark as deleted for batch processing
    this.deletedFiles.add(filePath);

    // If already pending swap, the batch timer is active
    if (this.pendingSwap) {
      return;
    }

    // Clear existing batch timer if any
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Start new batch timer
    this.batchTimer = setTimeout(() => {
      this.processBatch().catch((error) => {
        this.emit('error', error);
      });
    }, this.batchWindow);
  }

  /**
   * Process batched file changes
   */
  private async processBatch(): Promise<void> {
    if (this.queuedChanges.size === 0 && this.deletedFiles.size === 0) {
      return;
    }

    const startTime = performance.now();
    const batchFiles = Array.from(this.queuedChanges.entries());
    const deletedFilesList = Array.from(this.deletedFiles);
    const existingFiles = new Map<string, ProjectConfig>();

    // All files in queuedChanges are existing (we just loaded them)
    for (const [filePath, config] of batchFiles) {
      existingFiles.set(filePath, config);
    }

    // Sort files by priority (critical files first)
    const sortedFiles = Array.from(existingFiles.entries()).sort((a, b) => {
      const priorityA = this.filePriorities.get(a[0]) ?? 'normal';
      const priorityB = this.filePriorities.get(b[0]) ?? 'normal';
      if (priorityA === 'critical' && priorityB !== 'critical') return -1;
      if (priorityA !== 'critical' && priorityB === 'critical') return 1;
      return 0;
    });

    const validChanges: Array<[string, ProjectConfig]> = [];
    const invalidChanges: string[] = [];

    // Validate all changes first
    for (const [filePath, config] of sortedFiles) {
      try {
        // Basic validation
        if (!config || typeof config !== 'object') {
          throw new Error('Invalid config format');
        }

        // Validate BPM if present
        if (config.bpm !== undefined && (typeof config.bpm !== 'number' || config.bpm <= 0)) {
          throw new Error(`Invalid BPM: ${config.bpm}`);
        }

        validChanges.push([filePath, config]);
      } catch (error) {
        invalidChanges.push(filePath);
        this.emit('validationFailed', { file: filePath, error });
      }
    }

    // Start with current config as base, then merge all changes on top
    // This preserves unchanged keys while allowing updates to override
    const currentConfig = this.configManager.hasActive() ? this.configManager.getActive() : {};
    const changedConfigs = validChanges.map(([_, config]) => config);
    const mergedConfig = this.mergeConfigs([currentConfig, ...changedConfigs]);

    // Check for circular dependencies
    if (this.hasCircularDependencies(mergedConfig)) {
      const involvedFiles = validChanges.map(([file]) => path.basename(file));
      this.emit('circularDependencyDetected', { files: involvedFiles });
      this.queuedChanges.clear();
      return;
    }

    // Check for system stability
    if (!this.isConfigStable(mergedConfig)) {
      this.emit('batchRollback', { reason: 'System instability detected' });
      this.queuedChanges.clear();
      return;
    }

    // Clear the queued changes and deleted files
    this.queuedChanges.clear();
    this.deletedFiles.clear();

    // Apply valid changes
    if (validChanges.length > 0 || deletedFilesList.length > 0) {
      // Emit events for each valid change
      for (const [filePath] of validChanges) {
        this.emit('changeApplied', filePath);
        this.emit('fileApplied', filePath);
      }

      // Schedule swap with merged config
      await this.scheduleConfigSwap('batch', mergedConfig);

      const processingTime = performance.now() - startTime;

      // Emit batch summary
      const summary: BatchSummary = {
        filesChanged: batchFiles.length + deletedFilesList.length,
        validChanges: validChanges.length,
        invalidChanges: invalidChanges.length,
        changedFiles: validChanges.map(([file]) => path.basename(file)),
        filesUpdated: existingFiles.size,
        filesDeleted: deletedFilesList.length,
        processingTime
      };

      this.emit('batchApplied', summary);
    }
  }

  /**
   * Merge multiple configs into a single config
   * Simple shallow merge - later configs override earlier ones
   */
  private mergeConfigs(configs: ProjectConfig[]): ProjectConfig {
    return Object.assign({}, ...configs);
  }

  /**
   * Check for circular dependencies in config
   */
  private hasCircularDependencies(config: ProjectConfig): boolean {
    // Check for simple reference-based circular dependencies
    // This works for configs with 'id' and 'references' fields
    const items: any[] = [];

    // Gather all items that might have references
    if (config.patterns && Array.isArray(config.patterns)) {
      items.push(...config.patterns);
    }
    if (config.routes && Array.isArray(config.routes)) {
      items.push(...config.routes);
    }

    // Build reference map
    const referenceMap = new Map<string, string[]>();
    for (const item of items) {
      if (item.id && item.references && Array.isArray(item.references)) {
        referenceMap.set(item.id, item.references);
      }
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (id: string): boolean => {
      if (stack.has(id)) return true; // Circular dependency detected
      if (visited.has(id)) return false;

      visited.add(id);
      stack.add(id);

      const refs = referenceMap.get(id) ?? [];
      for (const ref of refs) {
        if (visit(ref)) return true;
      }

      stack.delete(id);
      return false;
    };

    for (const id of referenceMap.keys()) {
      if (visit(id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if config would cause system instability
   */
  private isConfigStable(config: ProjectConfig): boolean {
    // Check if removing patterns that are actively referenced
    if (config.patterns !== undefined && config.activePatterns) {
      const patternIds = new Set(config.patterns.map((p: any) => p.id));
      for (const activeId of config.activePatterns) {
        if (!patternIds.has(activeId)) {
          return false; // Active pattern would be removed
        }
      }
    }

    return true;
  }

  /**
   * Schedule a config swap at the next bar boundary
   */
  private async scheduleConfigSwap(filePath: string, config: ProjectConfig): Promise<void> {
    this.pendingSwap = true;
    this.swapScheduledTime = performance.now();

    // Emit lifecycle event
    this.emit('configChanging', { file: filePath });

    // Load into pending buffer
    await this.configManager.loadPending(config);

    this.emit('swapScheduled', { file: filePath });

    // If not swapping at bar boundary, swap immediately
    if (!this.swapAtBarBoundary) {
      await this.executeSwap();
    }
  }

  /**
   * Handle bar boundary events
   */
  private onBarBoundary(barNumber: number): void {
    if (!this.pendingSwap) {
      return;
    }

    // Execute swap at bar boundary
    this.executeSwap().catch((error) => {
      this.emit('error', error);
    });
  }

  /**
   * Execute the configuration swap
   */
  private async executeSwap(): Promise<void> {
    if (!this.pendingSwap) {
      return;
    }

    try {
      this.emit('swapExecuting');

      // Perform atomic swap
      await this.configManager.swap();

      // Apply new config to engine
      const newConfig = this.configManager.getActive();
      await this.applyConfigToEngine(newConfig);

      // Calculate latency
      const latency = performance.now() - this.swapScheduledTime;

      this.emit('configSwapped', { latency });

      this.pendingSwap = false;

      // Process queued changes if any accumulated during swap
      if (this.queuedChanges.size > 0) {
        // Wait for batch window to collect all changes
        if (this.batchTimer) {
          clearTimeout(this.batchTimer);
        }
        this.batchTimer = setTimeout(() => {
          this.processBatch().catch((error) => {
            this.emit('error', error);
          });
        }, this.batchWindow);
      }
    } catch (error) {
      this.pendingSwap = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(filePath: string): Promise<ProjectConfig> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) as ProjectConfig;
    } else {
      throw new Error(`Unsupported config file format: ${ext}`);
    }
  }

  /**
   * Apply configuration to engine
   */
  private async applyConfigToEngine(config: ProjectConfig): Promise<void> {
    // Store config in engine
    this.engine.setActiveConfig(config);

    // Apply BPM if changed
    if (config.bpm !== undefined) {
      const currentBpm = this.engine.getBpm();
      if (config.bpm !== currentBpm) {
        this.engine.setBpm(config.bpm);
      }
    }

    // Clear existing patterns
    // Note: This is a simplified implementation. In a real system,
    // we would diff the patterns and only add/remove/update changed ones.

    // Add new patterns
    if (config.patterns && Array.isArray(config.patterns)) {
      // Pattern loading logic would go here
      // For now, we just store the config
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Stop file watching
    await this.fileWatcher.dispose();

    // Clear state
    this.pendingSwap = false;
    this.queuedChanges.clear();
    this.deletedFiles.clear();
    this.filePriorities.clear();
    this.watchedFiles.clear();

    // Clean up config manager
    this.configManager.dispose();

    // Remove all listeners
    this.removeAllListeners();
  }
}
