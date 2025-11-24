import { EventEmitter } from 'events';
import { FileWatcher } from '../config/FileWatcher';
import { ClockEntityLoader, type ClockEntity } from '../config/entities/ClockEntity';
import type { Clock } from '../clock/Clock';

/**
 * ClockFileWatcher - Direct clock file hot-reload integration
 *
 * Features:
 * - Watches clock.yaml for file changes
 * - Reloads BPM configuration
 * - Schedules BPM updates at bar boundaries
 * - Emits reload events with latency metrics
 */

export interface ClockFileWatcherOptions {
  clock: Clock;
  clockFilePath: string;
  swapAtBarBoundary?: boolean;
}

export class ClockFileWatcher extends EventEmitter {
  private fileWatcher: FileWatcher;
  private clock: Clock;
  private clockFilePath: string;
  private swapAtBarBoundary: boolean;
  private pendingUpdate: ClockEntity | null = null;
  private updateScheduledTime: number = 0;

  constructor(options: ClockFileWatcherOptions) {
    super();

    this.clock = options.clock;
    this.clockFilePath = options.clockFilePath;
    this.swapAtBarBoundary = options.swapAtBarBoundary ?? true;

    this.fileWatcher = new FileWatcher({ debounceMs: 30 });

    // Set up event handlers
    this.setupFileWatcherHandlers();
    this.setupClockHandlers();
  }

  /**
   * Start watching clock file
   */
  async start(): Promise<void> {
    await this.fileWatcher.watch(this.clockFilePath);
    // Give chokidar a moment to fully settle after 'ready' event
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Stop watching clock file
   */
  async stop(): Promise<void> {
    await this.fileWatcher.dispose();
    this.pendingUpdate = null;
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
      await this.handleClockFileChange(filePath);
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
      this.applyPendingUpdate();
    });

    // Listen for BPM change confirmation from Clock
    this.clock.on('bpm:changed', (bpm: number) => {
      const latencyMs = performance.now() - this.updateScheduledTime;
      this.emit('config:reloaded', {
        latencyMs,
        filesChanged: 1,
        timestamp: Date.now(),
        bpm
      });
    });

    // Forward BPM scheduled event
    this.clock.on('bpm:scheduled', (event: any) => {
      this.emit('config:swapScheduled', {
        file: this.clockFilePath,
        ...event
      });
    });
  }

  /**
   * Handle clock file changes
   */
  private async handleClockFileChange(filePath: string): Promise<void> {
    try {
      // Only process YAML clock files
      if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
        return;
      }

      // Load and validate clock entity
      const clockEntity = ClockEntityLoader.loadFromFile(filePath);

      // Queue update
      this.pendingUpdate = clockEntity;
      this.updateScheduledTime = performance.now();

      // Emit change detected event
      this.emit('clockFileChanged', {
        file: filePath,
        bpm: clockEntity.bpm
      });

      // If clock is stopped, apply immediately
      // If playing, schedule for next bar boundary
      if (!this.clock.isPlaying()) {
        this.applyPendingUpdate();
      } else {
        // Emit schedule event immediately (actual application happens at bar boundary)
        this.emit('config:swapScheduled', {
          file: filePath,
          from: this.clock.getBpm(),
          to: clockEntity.bpm,
          appliesAt: 'next bar boundary'
        });
      }
    } catch (error) {
      // Validation or parsing error
      this.emit('config:error', {
        error,
        details: {
          file: filePath,
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Apply pending clock update at bar boundary (or immediately if stopped)
   */
  private applyPendingUpdate(): void {
    if (!this.pendingUpdate) {
      return;
    }

    const isPlaying = this.clock.isPlaying();

    if (isPlaying) {
      this.emit('config:swapExecuting');
    }

    try {
      // Update BPM (Clock will handle bar-boundary scheduling internally if playing)
      this.clock.setBpm(this.pendingUpdate.bpm);

      // Clear pending update only after BPM is set
      this.pendingUpdate = null;
    } catch (error) {
      this.emit('error', {
        error,
        message: `Failed to apply clock update: ${error instanceof Error ? error.message : String(error)}`
      });
      this.pendingUpdate = null;
    }
  }
}
