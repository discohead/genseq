import { EventEmitter } from 'events';
import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';

/**
 * T048: FileWatcher with 30ms debouncing for configuration file changes
 *
 * Features:
 * - Watches JSON, YAML, YML files
 * - 30ms debounce window (configurable)
 * - Independent debouncing per file path
 * - Emits 'change', 'add', 'unlink' events
 * - Resource cleanup with dispose()
 */

export interface FileWatcherOptions {
  debounceMs?: number;
}

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceMs: number;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private watchedPaths: Set<string> = new Set();

  constructor(options: FileWatcherOptions = {}) {
    super();
    this.debounceMs = options.debounceMs ?? 30;
  }

  /**
   * Watch a file or directory for changes
   * @param filePath Absolute path to file or directory to watch
   */
  async watch(filePath: string): Promise<void> {
    const normalizedPath = path.normalize(filePath);

    // If already watching this exact path, skip
    if (this.watchedPaths.has(normalizedPath)) {
      return;
    }

    // Create a new watcher for this path
    const watcher = chokidar.watch(normalizedPath, {
      persistent: true,
      ignoreInitial: true, // Don't emit events for existing files
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log'
      ],
      // Use a small awaitWriteFinish to stabilize rapid writes
      awaitWriteFinish: {
        stabilityThreshold: 5,
        pollInterval: 5
      }
    });

    // Set up event handlers
    watcher.on('change', (changedPath: string, stats?: fs.Stats) => {
      this.handleFileChange(changedPath, stats);
    });

    watcher.on('add', (addedPath: string, stats?: fs.Stats) => {
      this.handleFileAdd(addedPath, stats);
    });

    watcher.on('unlink', (deletedPath: string) => {
      this.handleFileUnlink(deletedPath);
    });

    watcher.on('error', (error: Error) => {
      this.emit('error', error);
    });

    // Wait for watcher to be ready
    await new Promise<void>((resolve, reject) => {
      watcher.on('ready', () => resolve());
      watcher.on('error', reject);
    });

    this.watchers.set(normalizedPath, watcher);
    this.watchedPaths.add(normalizedPath);
  }

  /**
   * Stop watching a specific file or directory
   * @param filePath Path to stop watching
   */
  async unwatch(filePath: string): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    const watcher = this.watchers.get(normalizedPath);

    if (watcher) {
      await watcher.close();
      this.watchers.delete(normalizedPath);
      this.watchedPaths.delete(normalizedPath);

      // Clear any pending debounce timer for this path
      const timer = this.debounceTimers.get(normalizedPath);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(normalizedPath);
      }
    }
  }

  /**
   * Stop watching all files and clean up resources
   */
  async dispose(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    const closePromises = Array.from(this.watchers.values()).map(watcher =>
      watcher.close()
    );
    await Promise.all(closePromises);

    this.watchers.clear();
    this.watchedPaths.clear();
    this.removeAllListeners();
  }

  /**
   * Check if currently watching any files
   */
  isWatching(): boolean {
    return this.watchers.size > 0;
  }

  /**
   * Get the number of currently watched files/directories
   */
  getWatchedCount(): number {
    return this.watchedPaths.size;
  }

  /**
   * Handle file change event with debouncing
   */
  private handleFileChange(filePath: string, stats?: fs.Stats): void {
    this.debounceEvent('change', filePath, stats);
  }

  /**
   * Handle file add event with debouncing
   */
  private handleFileAdd(filePath: string, stats?: fs.Stats): void {
    this.debounceEvent('add', filePath, stats);
  }

  /**
   * Handle file deletion event with debouncing
   */
  private handleFileUnlink(filePath: string): void {
    this.debounceEvent('unlink', filePath);
  }

  /**
   * Debounce event emission
   * Each file path has its own debounce timer
   */
  private debounceEvent(
    eventType: string,
    filePath: string,
    stats?: fs.Stats
  ): void {
    const normalizedPath = path.normalize(filePath);
    const timerKey = `${eventType}:${normalizedPath}`;

    // Clear existing timer for this file+event combination
    const existingTimer = this.debounceTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(timerKey);

      // If stats weren't provided and file still exists, get them
      let fileStats = stats;
      if (!fileStats && eventType !== 'unlink') {
        try {
          fileStats = await fsPromises.stat(normalizedPath);
        } catch (error) {
          // File may have been deleted, ignore error
        }
      }

      this.emit(eventType, normalizedPath, fileStats);
    }, this.debounceMs);

    this.debounceTimers.set(timerKey, timer);
  }
}
