import { EventEmitter } from 'events';
import { FileWatcher } from '../config/FileWatcher';
import { PatternEntityLoader, type PatternEntity } from '../config/entities/PatternEntity';
import type { Clock } from '../clock/Clock';

/**
 * T056: PatternFileWatcher - Direct pattern file hot-reload integration
 *
 * Simplified hot-reload implementation for pattern files:
 * - Watches pattern directory for file changes
 * - Reloads changed pattern files
 * - Schedules parameter updates at bar boundaries
 * - Emits reload events with latency metrics
 */

export interface PatternFileWatcherOptions {
  clock: Clock;
  patternsPath: string;
  swapAtBarBoundary?: boolean;
}

export class PatternFileWatcher extends EventEmitter {
  private fileWatcher: FileWatcher;
  private clock: Clock;
  private patternsPath: string;
  private swapAtBarBoundary: boolean;
  private pendingUpdates: Map<string, PatternEntity> = new Map();
  private updateScheduledTime: number = 0;
  private swapStartTime: number = 0;

  constructor(options: PatternFileWatcherOptions) {
    super();

    this.clock = options.clock;
    this.patternsPath = options.patternsPath;
    this.swapAtBarBoundary = options.swapAtBarBoundary ?? true;

    this.fileWatcher = new FileWatcher({ debounceMs: 30 });

    // Set up event handlers
    this.setupFileWatcherHandlers();
    this.setupClockHandlers();
  }

  /**
   * Start watching pattern files
   */
  async start(): Promise<void> {
    await this.fileWatcher.watch(this.patternsPath);
    // Give chokidar a moment to fully settle after 'ready' event
    // This is necessary because chokidar needs time after 'ready' to actually start watching
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Stop watching pattern files
   */
  async stop(): Promise<void> {
    await this.fileWatcher.dispose();
    this.pendingUpdates.clear();
  }

  /**
   * Alias for stop() - for consistency with other components
   */
  async dispose(): Promise<void> {
    await this.stop();
  }

  /**
   * Set up file watcher event handlers
   */
  private setupFileWatcherHandlers(): void {
    this.fileWatcher.on('change', async (filePath: string) => {
      await this.handlePatternFileChange(filePath);
    });

    this.fileWatcher.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Set up clock event handlers for bar boundaries
   */
  private setupClockHandlers(): void {
    this.clock.on('bar', () => {
      this.applyPendingUpdates();
    });
  }

  /**
   * Handle pattern file changes
   */
  private async handlePatternFileChange(filePath: string): Promise<void> {
    try {
      // Only process YAML/JSON pattern files
      if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml') && !filePath.endsWith('.json')) {
        return;
      }

      this.updateScheduledTime = performance.now();

      // Load updated pattern
      const pattern = PatternEntityLoader.loadFromFile(filePath);

      this.emit('configChanging', { file: filePath });

      // Queue update
      this.pendingUpdates.set(pattern.id, pattern);

      this.emit('swapScheduled', { file: filePath, patternId: pattern.id });

      // If not waiting for bar boundary, apply immediately
      if (!this.swapAtBarBoundary) {
        this.applyPendingUpdates();
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Apply pending pattern updates
   */
  private applyPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    this.emit('swapExecuting');

    const swapStart = performance.now();
    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    // Emit pattern updates
    for (const [id, pattern] of updates) {
      this.emit('patternUpdated', { id, pattern });
    }

    // Measure actual swap time (not including bar-boundary wait)
    const swapLatency = performance.now() - swapStart;

    this.emit('configSwapped', { latency: swapLatency, count: updates.length });
  }

  /**
   * Check if updates are pending
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0;
  }

  /**
   * Force apply pending updates immediately
   */
  flushUpdates(): void {
    this.applyPendingUpdates();
  }
}
