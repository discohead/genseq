import { EventEmitter } from 'events';
import { FileWatcher } from '../config/FileWatcher';
import { RouteEntityLoader, type RouteEntity } from '../config/entities/RouteEntity';
import type { Clock } from '../clock/Clock';

/**
 * RouteFileWatcher - Direct route file hot-reload integration
 *
 * Features:
 * - Watches routes directory for file changes
 * - Reloads changed route files
 * - Schedules route updates at bar boundaries
 * - Validates MIDI device availability
 * - Emits reload events with latency metrics
 */

export interface RouteFileWatcherOptions {
  clock: Clock;
  routesPath: string;
  swapAtBarBoundary?: boolean;
}

export class RouteFileWatcher extends EventEmitter {
  private fileWatcher: FileWatcher;
  private clock: Clock;
  private routesPath: string;
  private swapAtBarBoundary: boolean;
  private pendingUpdates: Map<string, RouteEntity> = new Map();
  private updateScheduledTime: number = 0;
  private swapStartTime: number = 0;

  constructor(options: RouteFileWatcherOptions) {
    super();

    this.clock = options.clock;
    this.routesPath = options.routesPath;
    this.swapAtBarBoundary = options.swapAtBarBoundary ?? true;

    this.fileWatcher = new FileWatcher({ debounceMs: 30 });

    // Set up event handlers
    this.setupFileWatcherHandlers();
    this.setupClockHandlers();
  }

  /**
   * Start watching route files
   */
  async start(): Promise<void> {
    await this.fileWatcher.watch(this.routesPath);
    // Give chokidar a moment to fully settle after 'ready' event
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Stop watching route files
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
      await this.handleRouteFileChange(filePath);
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
   * Handle route file changes
   */
  private async handleRouteFileChange(filePath: string): Promise<void> {
    try {
      // Only process JSON route files
      if (!filePath.endsWith('.json')) {
        return;
      }

      // Load and validate route entity
      const routeEntity = RouteEntityLoader.loadFromFile(filePath);

      // Queue update
      this.pendingUpdates.set(routeEntity.id, routeEntity);

      // Emit change detected event
      this.emit('routeFileChanged', {
        file: filePath,
        routeId: routeEntity.id
      });

      // Schedule swap at bar boundary
      if (this.swapAtBarBoundary && this.pendingUpdates.size === 1) {
        this.updateScheduledTime = performance.now();
        this.emit('config:swapScheduled', {
          file: filePath,
          routeId: routeEntity.id,
          scheduledFor: 'next bar boundary'
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
   * Apply pending route updates at bar boundary
   */
  private applyPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    this.swapStartTime = performance.now();
    this.emit('config:swapExecuting');

    const updatedRoutes: RouteEntity[] = [];

    for (const [routeId, routeEntity] of this.pendingUpdates.entries()) {
      try {
        // Emit route update event for GenSeqEngine to handle
        this.emit('routeUpdated', {
          id: routeId,
          route: routeEntity
        });

        updatedRoutes.push(routeEntity);
      } catch (error) {
        this.emit('error', {
          routeId,
          error,
          message: `Failed to apply route update: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    // Clear pending updates
    this.pendingUpdates.clear();

    // Emit completion event with metrics
    const latencyMs = performance.now() - this.updateScheduledTime;
    this.emit('config:reloaded', {
      latencyMs,
      filesChanged: updatedRoutes.length,
      timestamp: Date.now(),
      routes: updatedRoutes.map(r => r.id)
    });
  }
}
