import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  clockJitter: number; // ms
  midiLatency: number; // ms
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  eventQueueSize: number;
  droppedEvents: number;
}

/**
 * T025: Performance monitoring with custom metrics
 *
 * Tracks system performance metrics
 * Reports violations of performance contracts
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.metrics = {
      clockJitter: 0,
      midiLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      eventQueueSize: 0,
      droppedEvents: 0
    };
  }

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.collectMetrics();
      this.emit('metrics', this.metrics);
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  recordClockJitter(jitterMs: number): void {
    this.metrics.clockJitter = jitterMs;

    if (jitterMs > 1.0) {
      this.emit('warning', {
        type: 'clockJitter',
        value: jitterMs,
        threshold: 1.0,
        message: `Clock jitter exceeded 1ms: ${jitterMs.toFixed(3)}ms`
      });
    }
  }

  recordMidiLatency(latencyMs: number): void {
    this.metrics.midiLatency = latencyMs;

    if (latencyMs > 5.0) {
      this.emit('warning', {
        type: 'midiLatency',
        value: latencyMs,
        threshold: 5.0,
        message: `MIDI latency exceeded 5ms: ${latencyMs.toFixed(3)}ms`
      });
    }
  }

  recordEventQueueSize(size: number): void {
    this.metrics.eventQueueSize = size;
  }

  recordDroppedEvent(): void {
    this.metrics.droppedEvents++;

    this.emit('warning', {
      type: 'droppedEvent',
      value: this.metrics.droppedEvents,
      message: `Event dropped (total: ${this.metrics.droppedEvents})`
    });
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  private collectMetrics(): void {
    // Collect system metrics
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

    const cpuUsage = process.cpuUsage();
    this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Approximate %
  }

  reset(): void {
    this.metrics = {
      clockJitter: 0,
      midiLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      eventQueueSize: 0,
      droppedEvents: 0
    };
  }
}
