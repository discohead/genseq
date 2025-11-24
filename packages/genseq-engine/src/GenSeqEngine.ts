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
import { HotReloadCoordinator } from './config/HotReloadCoordinator';
import { PatternFileWatcher } from './hotreload/PatternFileWatcher';
import { RouteFileWatcher } from './hotreload/RouteFileWatcher';
import { ClockFileWatcher } from './hotreload/ClockFileWatcher';
import * as path from 'path';

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
  clock?: ClockConfig | Clock;
  midi?: MidiIOConfig;
  projectPath?: string;
  enableHotReload?: boolean;
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
  private hotReloadCoordinator?: HotReloadCoordinator;
  private patternFileWatcher: PatternFileWatcher | null = null;
  private routeFileWatcher: RouteFileWatcher | null = null;
  private clockFileWatcher: ClockFileWatcher | null = null;

  // State
  private initialized: boolean = false;
  private activeConfig: any = null;
  private initialRoutes: Map<string, string> = new Map(); // routeId -> device mapping for hot-reload tracking

  constructor(config: GenSeqEngineConfig = {}) {
    super();

    // Initialize core components
    // Accept either a Clock instance or ClockConfig
    if (config.clock instanceof Clock) {
      this.clock = config.clock;
    } else {
      this.clock = new Clock(config.clock || { bpm: 120, ppq: 96 });
    }

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

    // Initialize HotReloadCoordinator if enabled
    if (config.enableHotReload !== false) {
      this.hotReloadCoordinator = new HotReloadCoordinator({
        engine: this,
        clock: this.clock,
        swapAtBarBoundary: true
      });
    }

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

    // Forward pattern regeneration events (T056)
    this.patternExecutor.on('patternRegenerated', (data) => {
      this.emit('pattern:regenerated', data);
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

    // Hot-reload event forwarding (T053)
    if (this.hotReloadCoordinator) {
      this.hotReloadCoordinator.on('configSwapped', (event: any) => {
        this.emit('config:reloaded', {
          timestamp: Date.now(),
          latencyMs: event.latency,
          filesChanged: event.filesChanged || []
        });
      });

      this.hotReloadCoordinator.on('validationFailed', (event: any) => {
        this.emit('config:error', {
          timestamp: Date.now(),
          error: event.error?.message || 'Configuration validation failed',
          details: event.error
        });
      });

      this.hotReloadCoordinator.on('error', (error: Error) => {
        this.emit('error', { source: 'hotReloadCoordinator', error });
      });
    }
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

      // Store initial route devices for hot-reload tracking
      this.initialRoutes = new Map(routes.map(r => [r.id, r.device]));

      // Load patterns
      const patternsPath = `${projectPath}/patterns`;
      const patterns = PatternEntityLoader.loadFromDirectory(patternsPath);

      for (const pattern of patterns) {
        this.loadPattern(pattern);
      }

      // Start watching pattern directory for hot-reload (T056)
      if (this.hotReloadCoordinator) {
        this.patternFileWatcher = new PatternFileWatcher({
          clock: this.clock,
          patternsPath,
          swapAtBarBoundary: true
        });

        // Forward lifecycle events
        this.patternFileWatcher.on('configChanging', (event: any) => {
          this.emit('config:changing', event);
        });

        this.patternFileWatcher.on('swapScheduled', (event: any) => {
          this.emit('config:swapScheduled', event);
        });

        this.patternFileWatcher.on('swapExecuting', () => {
          this.emit('config:swapExecuting');
        });

        this.patternFileWatcher.on('configSwapped', (event: any) => {
          this.emit('config:reloaded', {
            timestamp: Date.now(),
            latencyMs: event.latency,
            filesChanged: []
          });
        });

        // Handle pattern updates
        this.patternFileWatcher.on('patternUpdated', (event: any) => {
          this.reloadPattern(event.id, event.pattern);
        });

        // Forward errors
        this.patternFileWatcher.on('error', (error: Error) => {
          this.emit('config:error', {
            timestamp: Date.now(),
            error: error.message,
            details: error
          });
        });

        await this.patternFileWatcher.start();
      }

      // Start watching routes directory for hot-reload
      if (this.hotReloadCoordinator) {
        const routesPath = `${projectPath}/routes`;
        this.routeFileWatcher = new RouteFileWatcher({
          clock: this.clock,
          routesPath,
          swapAtBarBoundary: true
        });

        // Register initial routes for device tracking
        for (const [routeId, device] of this.initialRoutes.entries()) {
          this.routeFileWatcher.registerRoute(routeId, device);
        }

        // Forward lifecycle events
        this.routeFileWatcher.on('config:swapScheduled', (event: any) => {
          this.emit('config:swapScheduled', event);
        });

        this.routeFileWatcher.on('config:swapExecuting', () => {
          this.emit('config:swapExecuting');
        });

        this.routeFileWatcher.on('config:reloaded', (event: any) => {
          this.emit('config:reloaded', event);
        });

        // Handle device reconnection
        this.routeFileWatcher.on('deviceReconnectNeeded', async (event: any) => {
          await this.handleDeviceReconnection(event.routeId, event.oldDevice, event.newDevice);
        });

        // Handle route updates
        this.routeFileWatcher.on('routeUpdated', (event: any) => {
          this.reloadRoute(event.id, event.route);
        });

        // Forward errors
        this.routeFileWatcher.on('config:error', (error: any) => {
          this.emit('config:error', {
            timestamp: Date.now(),
            error: error.error?.message || error.message,
            details: error.details
          });
        });

        await this.routeFileWatcher.start();
      }

      // Start watching clock file for hot-reload
      if (this.hotReloadCoordinator) {
        const clockPath = `${projectPath}/clock.yaml`;
        this.clockFileWatcher = new ClockFileWatcher({
          clock: this.clock,
          clockFilePath: clockPath,
          swapAtBarBoundary: true
        });

        // Forward lifecycle events
        this.clockFileWatcher.on('config:swapScheduled', (event: any) => {
          this.emit('config:swapScheduled', event);
        });

        this.clockFileWatcher.on('config:swapExecuting', () => {
          this.emit('config:swapExecuting');
        });

        this.clockFileWatcher.on('config:reloaded', (event: any) => {
          this.emit('config:reloaded', event);
        });

        // Forward errors
        this.clockFileWatcher.on('config:error', (error: any) => {
          this.emit('config:error', {
            timestamp: Date.now(),
            error: error.error?.message || error.message,
            details: error.details
          });
        });

        await this.clockFileWatcher.start();
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
   * Load pattern from entity (creates appropriate generator)
   */
  private loadPattern(pattern: PatternEntity): void {
    if (pattern.type === 'euclidean') {
      const euclideanPattern = new EuclideanPattern({
        steps: pattern.parameters.steps || 16,
        pulses: pattern.parameters.pulses || 4,
        rotation: pattern.parameters.rotation || 0,
        note: pattern.note || 60,
        velocity: pattern.parameters.velocity || 100,
        duration: pattern.parameters.gateLength || 0.25
      });

      this.patternExecutor.addPattern(
        pattern,
        (context: PatternContext) => euclideanPattern.tick(context),
        euclideanPattern // Pass instance for hot-reload
      );
    }
  }

  /**
   * Reload pattern with updated parameters (T056)
   */
  private reloadPattern(id: string, patternEntity: PatternEntity): void {
    try {
      // Translate parameters to EuclideanPatternConfig format if needed
      const translatedParams: Record<string, any> = { ...patternEntity.parameters };

      // Map gateLength → duration for EuclideanPattern
      if (patternEntity.type === 'euclidean' && translatedParams.gateLength !== undefined) {
        translatedParams.duration = translatedParams.gateLength;
      }

      // Map entity-level fields (note, channel, enabled, bus) and velocity from entity level if present
      if (patternEntity.note !== undefined) {
        translatedParams.note = patternEntity.note;
      }
      if (patternEntity.channel !== undefined) {
        translatedParams.channel = patternEntity.channel;
      }
      if (patternEntity.enabled !== undefined) {
        translatedParams.enabled = patternEntity.enabled;
      }
      if (patternEntity.bus !== undefined) {
        translatedParams.bus = patternEntity.bus;
      }
      if (patternEntity.parameters.velocity !== undefined) {
        translatedParams.velocity = patternEntity.parameters.velocity;
      }

      // Update pattern parameters
      this.patternExecutor.updatePatternParameters(id, translatedParams);

      // Emit pattern update event
      this.emit('pattern:updated', {
        id,
        parameters: patternEntity.parameters
      });

      // Pattern regeneration will happen at cycle boundary automatically
    } catch (error) {
      this.emit('error', { source: 'reloadPattern', error, patternId: id });
    }
  }

  /**
   * Handle device reconnection for route hot-reload
   * Closes old MIDI port and opens new one
   */
  private async handleDeviceReconnection(routeId: string, oldDevice: string, newDevice: string): Promise<void> {
    try {
      // Verify new device is available
      const availablePorts = await this.midiIO.getOutputPorts();
      const newDeviceExists = availablePorts.some(port => port.name === newDevice || port.id === newDevice);

      if (!newDeviceExists) {
        // New device not available - emit warning and keep old device
        this.emit('config:error', {
          timestamp: Date.now(),
          error: `Device "${newDevice}" not available`,
          details: {
            routeId,
            oldDevice,
            newDevice,
            availablePorts: availablePorts.map(p => p.name)
          }
        });
        return;
      }

      // Close old MIDI port
      try {
        await this.midiIO.closeOutputPort(oldDevice);
      } catch (error) {
        // Old port may already be closed - not critical
        console.warn(`Failed to close old MIDI port "${oldDevice}":`, error);
      }

      // Open new MIDI port
      await this.midiIO.openOutputPort(newDevice);

      // Update tracking
      this.initialRoutes.set(routeId, newDevice);

      // Emit success event
      this.emit('device:reconnected', {
        routeId,
        oldDevice,
        newDevice,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('error', {
        source: 'handleDeviceReconnection',
        error,
        routeId,
        oldDevice,
        newDevice
      });
    }
  }

  /**
   * Reload route with updated configuration
   * Hot-reload support for route files (including device changes)
   */
  private reloadRoute(id: string, routeEntity: RouteEntity): void {
    try {
      // Update route in BusRouter
      this.busRouter.updateRoute(id, routeEntity);

      // Emit route update event
      this.emit('route:updated', {
        id,
        route: routeEntity
      });

      // Note: Device reconnection is handled separately via deviceReconnectNeeded event
      // This method updates routing parameters (channel, transforms)
    } catch (error) {
      this.emit('error', { source: 'reloadRoute', error, routeId: id });
    }
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
   * Get active configuration
   */
  getActiveConfig(): any {
    return this.activeConfig;
  }

  /**
   * Set active configuration
   */
  setActiveConfig(config: any): void {
    this.activeConfig = config;
  }

  /**
   * Check if engine is playing
   */
  isPlaying(): boolean {
    return this.transport.getState() === TransportState.PLAYING;
  }

  /**
   * Shutdown engine
   */
  async shutdown(): Promise<void> {
    this.stop();
    this.performanceMonitor.stop();

    // Dispose pattern file watcher (T056)
    if (this.patternFileWatcher) {
      await this.patternFileWatcher.dispose();
      this.patternFileWatcher = null;
    }

    // Dispose route file watcher
    if (this.routeFileWatcher) {
      await this.routeFileWatcher.dispose();
      this.routeFileWatcher = null;
    }

    // Dispose clock file watcher
    if (this.clockFileWatcher) {
      await this.clockFileWatcher.dispose();
      this.clockFileWatcher = null;
    }

    // Dispose hot-reload coordinator
    if (this.hotReloadCoordinator) {
      await this.hotReloadCoordinator.dispose();
    }

    await this.midiIO.close();

    this.initialized = false;
    this.emit('shutdown');
  }
}
