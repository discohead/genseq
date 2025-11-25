/**
 * T027: TypeSwapEvent type definitions
 *
 * Events emitted during pattern type hot-reload lifecycle:
 * - typeChangeDetected: File watcher detects type change in pattern file
 * - typeSwapScheduled: Pattern executor queues type swap for next cycle boundary
 * - typeSwapComplete: Type swap successfully completed
 * - typeSwapFailed: Type swap failed (validation or creation error)
 */

/**
 * Event emitted when type change is detected in pattern file
 */
export interface TypeChangeDetectedEvent {
  patternId: string;
  fromType: string;
  toType: string;
  filePath: string;
}

/**
 * Event emitted when type swap is scheduled for next cycle boundary
 */
export interface TypeSwapScheduledEvent {
  patternId: string;
  fromType: string;
  toType: string;
  scheduledAt: number; // performance.now() timestamp
}

/**
 * Event emitted when type swap completes successfully
 */
export interface TypeSwapCompleteEvent {
  patternId: string;
  fromType: string;
  toType: string;
  completedAt: number; // performance.now() timestamp
  latency: number; // Swap execution time in ms
}

/**
 * Event emitted when type swap fails
 */
export interface TypeSwapFailedEvent {
  patternId: string;
  fromType: string;
  toType?: string;
  error: Error;
  failedAt: number; // performance.now() timestamp
}
