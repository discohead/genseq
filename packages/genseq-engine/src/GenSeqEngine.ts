import { EventEmitter } from 'events';
import { Clock, type ClockConfig } from './clock/Clock';
import { Scheduler } from './scheduler/Scheduler';
import { MidiIO, type MidiIOConfig } from './midi/MidiIO';
import { PatternExecutor } from './patterns/PatternExecutor';
import { BusRouter } from './midi/BusRouter';
import { MidiOutputHandler } from './midi/MidiOutputHandler';
import { TransportController, TransportState } from './transport/TransportController';
import { PerformanceMonitor } from './monitoring/PerformanceMonitor';
import { ClockEntityLoader } from './config/entities/ClockEntity';
import { PatternEntityLoader, type PatternEntity } from './config/entities/PatternEntity';
import { RouteEntityLoader, type RouteEntity } from './config/entities/RouteEntity';
import { EuclideanPattern, type PatternContext } from '@genseq/patterns';

/**
 * T033: GenSeqEngine - main class integrating all components
 * T035: Event emitter for transport events (start, stop, position)
 *
 * Responsibilities:
 * - Initialize and coordinate all subsystems
 * - Load configuration from project directory
 * - Provide unified API for engine control
 * - Emit transport and pattern events
 * - Monitor performance metrics
 */

export interface GenSeqEngineConfig {
  clock?: ClockConfig;
  midi?: MidiIOConfig;
  projectPath?: string;
}

export interface EngineStatus {
  transportState: TransportState;
  bpm: number;
  position: {
    bar: number;
    beat: number;
    tick: number;
  };
  activePatterns: number;
  performance: {
    clockJitter: number;
    midiLatency: number;
    memoryUsage: number;
  };
}

export class GenSeqEngine extends EventEmitter {
  // Core components
  private clock: Clock;
  private scheduler: Scheduler;
  private midiIO: MidiIO;
  private patternExecutor: PatternExecutor;
  private busRouter: BusRouter;
  private midiOutputHandler: MidiOutputHandler;
  private transport: TransportController;
  private performanceMonitor: PerformanceMonitor;

  // State
  private initialized: boolean = false;

  constructor(config: GenSeqEngineConfig = {}) {
    super();

    // Initialize core components
    this.clock = new Clock(config.clock || { bpm: 120, ppq: 96 });
    this.scheduler = new Scheduler({ clock: this.clock });
    this.midiIO = new MidiIO(config.midi || { enableVirtualLoopback: true });
    this.busRouter = new BusRouter({ midiIO: this.midiIO });
    this.midiOutputHandler = new MidiOutputHandler({ busRouter: this.busRouter });
    this.patternExecutor = new PatternExecutor({
      clock: this.clock,
      scheduler: this.scheduler
    });
    this.transport = new TransportController({
      clock: this.clock,
      scheduler: this.scheduler
    });
    this.performanceMonitor = new PerformanceMonitor();

    this.setupEventHandlers();
  }

  /**
   * Set up event forwarding between components
   */
  private setupEventHandlers(): void {
    // Forward transport events (T035)
    this.transport.on('start', (data) => {
      this.emit('transport:start', data);
    });

    this.transport.on('stop', (data) => {
      this.emit('transport:stop', data);
    });

    this.transport.on('pause', (data) => {
      this.emit('transport:pause', data);
    });

    this.transport.on('continue', (data) => {
      this.emit('transport:continue', data);
    });

    this.transport.on('bpmChanged', (data) => {
      this.emit('transport:bpmChanged', data);
    });

    this.transport.on('tapTempo', (data) => {
      this.emit('transport:tapTempo', data);
    });

    // Forward position updates
    this.clock.on('tick', () => {
      this.emit('transport:position', this.clock.getPosition());
    });

    // Pattern events to MIDI output
    this.patternExecutor.on('event', async (event) => {
      await this.midiOutputHandler.handleEvent(event);
    });

    // Forward pattern lifecycle events
    this.patternExecutor.on('patternAdded', (id) => {
      this.emit('pattern:added', id);
    });

    this.patternExecutor.on('patternRemoved', (id) => {
      this.emit('pattern:removed', id);
    });

    this.patternExecutor.on('patternEnabled', (id) => {
      this.emit('pattern:enabled', id);
    });

    this.patternExecutor.on('patternDisabled', (id) => {
      this.emit('pattern:disabled', id);
    });

    // Forward MIDI events
    this.midiOutputHandler.on('noteOn', (data) => {
      this.emit('midi:noteOn', data);
    });

    this.midiOutputHandler.on('noteOff', (data) => {
      this.emit('midi:noteOff', data);
    });

    // Performance monitoring
    this.performanceMonitor.on('warning', (warning) => {
      this.emit('performance:warning', warning);
    });

    this.performanceMonitor.on('metrics', (metrics) => {
      this.emit('performance:metrics', metrics);
    });

    // Error handling
    this.patternExecutor.on('error', (error) => {
      this.emit('error', { source: 'patternExecutor', ...error });
    });

    this.busRouter.on('error', (error) => {
      this.emit('error', { source: 'busRouter', ...error });
    });

    this.midiOutputHandler.on('error', (error) => {
      this.emit('error', { source: 'midiOutputHandler', ...error });
    });
  }

  /**
   * Initialize engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize MIDI I/O
    await this.midiIO.initialize();

    // Start performance monitoring
    this.performanceMonitor.start();

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Load project configuration
   */
  async loadProject(projectPath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    try {
      // Load clock configuration
      const clockPath = `${projectPath}/clock.yaml`;
      const clockEntity = ClockEntityLoader.loadFromFile(clockPath);
      this.clock.setBpm(clockEntity.bpm);

      // Load routes
      const routesPath = `${projectPath}/routes`;
      const routes = RouteEntityLoader.loadFromDirectory(routesPath);
      for (const route of routes) {
        this.busRouter.addRoute(route);

        // Open MIDI output port for this route
        if (route.enabled) {
          try {
            await this.midiIO.openOutputPort(route.device);
          } catch (error) {
            console.warn(`Failed to open MIDI port "${route.device}":`, error);
          }
        }
      }

      // Load patterns
      const patternsPath = `${projectPath}/patterns`;
      const patterns = PatternEntityLoader.loadFromDirectory(patternsPath);

      for (const pattern of patterns) {
        // Create pattern generator based on type
        if (pattern.type === 'euclidean') {
          const euclideanPattern = new EuclideanPattern({
            steps: pattern.parameters.steps || 16,
            pulses: pattern.parameters.pulses || 4,
            rotation: pattern.parameters.rotation || 0,
            note: pattern.note || 60,
            velocity: pattern.parameters.velocity || 100,
            duration: pattern.parameters.gateLength || 0.25
          });

          this.patternExecutor.addPattern(pattern, (context: PatternContext) =>
            euclideanPattern.tick(context)
          );
        }
      }

      this.emit('project:loaded', { projectPath, patterns: patterns.length, routes: routes.length });
    } catch (error) {
      this.emit('error', { source: 'loadProject', error });
      throw error;
    }
  }

  /**
   * Start playback
   */
  start(): void {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    this.patternExecutor.start();
    this.transport.start();
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.transport.stop();
    this.patternExecutor.stop();

    // Send note-offs for all active notes
    this.midiOutputHandler.panic();
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.transport.pause();
  }

  /**
   * Continue playback
   */
  continue(): void {
    this.transport.continue();
  }

  /**
   * Toggle playback
   */
  toggle(): void {
    this.transport.toggle();
  }

  /**
   * Set BPM
   */
  setBpm(bpm: number): void {
    this.transport.setBpm(bpm);
  }

  /**
   * Get current BPM
   */
  getBpm(): number {
    return this.transport.getBpm();
  }

  /**
   * Tap tempo
   */
  tapTempo(): void {
    this.transport.tapTempo();
  }

  /**
   * Get engine status
   */
  getStatus(): EngineStatus {
    const metrics = this.performanceMonitor.getMetrics();

    return {
      transportState: this.transport.getState(),
      bpm: this.transport.getBpm(),
      position: this.transport.getPosition(),
      activePatterns: this.patternExecutor.getActivePatternCount(),
      performance: {
        clockJitter: metrics.clockJitter,
        midiLatency: metrics.midiLatency,
        memoryUsage: metrics.memoryUsage
      }
    };
  }

  /**
   * Add pattern dynamically
   */
  addPattern(pattern: PatternEntity, generator: any): void {
    this.patternExecutor.addPattern(pattern, generator);
  }

  /**
   * Remove pattern
   */
  removePattern(id: string): void {
    this.patternExecutor.removePattern(id);
  }

  /**
   * Enable pattern
   */
  enablePattern(id: string): void {
    this.patternExecutor.enablePattern(id);
  }

  /**
   * Disable pattern
   */
  disablePattern(id: string): void {
    this.patternExecutor.disablePattern(id);
  }

  /**
   * Add route dynamically
   */
  addRoute(route: RouteEntity): void {
    this.busRouter.addRoute(route);
  }

  /**
   * Get available MIDI output ports
   */
  async getMidiOutputPorts(): Promise<any[]> {
    return this.midiIO.getOutputPorts();
  }

  /**
   * Shutdown engine
   */
  async shutdown(): Promise<void> {
    this.stop();
    this.performanceMonitor.stop();
    await this.midiIO.close();

    this.initialized = false;
    this.emit('shutdown');
  }
}
