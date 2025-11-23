/**
 * GenSeq CLI API Contract
 * Command-line interface for GenSeq engine
 */

import { Command } from 'commander';
import { GenSeqEngine, EngineOptions, ValidationError } from './genseq-engine.api';

// ============================================================================
// CLI Commands
// ============================================================================

export interface CliCommands {
  // Project commands
  init: (path?: string) => Promise<void>;
  validate: (projectPath: string) => Promise<ValidationError[]>;

  // Engine commands
  start: (projectPath: string, options?: StartOptions) => Promise<void>;
  daemon: (projectPath: string, options?: DaemonOptions) => Promise<void>;

  // Control commands (when daemon is running)
  play: () => Promise<void>;
  stop: () => Promise<void>;
  scene: (sceneId: string) => Promise<void>;
  status: () => Promise<void>;

  // MIDI commands
  devices: () => Promise<void>;
  monitor: (options?: MonitorOptions) => Promise<void>;

  // Development commands
  test: (projectPath: string) => Promise<void>;
  benchmark: (projectPath: string) => Promise<void>;
  debug: (projectPath: string, options?: DebugOptions) => Promise<void>;
}

// ============================================================================
// Command Options
// ============================================================================

export interface StartOptions {
  scene?: string;        // Initial scene to load
  bpm?: number;         // Override project BPM
  output?: string;      // MIDI output device
  input?: string;       // MIDI input device
  noHotReload?: boolean; // Disable hot-reload
  verbose?: boolean;    // Verbose logging
}

export interface DaemonOptions extends StartOptions {
  port?: number;        // IPC port for control commands
  logFile?: string;     // Log output to file
  pidFile?: string;     // PID file location
}

export interface MonitorOptions {
  device?: string;      // Specific device to monitor
  direction?: 'in' | 'out' | 'both';
  format?: 'hex' | 'decimal' | 'pretty';
}

export interface DebugOptions {
  breakpoints?: boolean; // Enable debugger breakpoints
  inspector?: boolean;   // Enable Chrome DevTools
  port?: number;        // Inspector port
  timing?: boolean;     // Show timing information
  memory?: boolean;     // Show memory usage
}

// ============================================================================
// CLI Application
// ============================================================================

export class GenSeqCLI {
  constructor();

  private program: Command;
  private engine?: GenSeqEngine;

  // Setup
  setupCommands(): void;
  setupOptions(): void;

  // Execution
  run(argv?: string[]): Promise<void>;

  // Helpers
  private createEngine(projectPath: string, options?: any): GenSeqEngine;
  private handleError(error: Error): void;
  private formatOutput(data: any, format?: string): string;
}

// ============================================================================
// Project Initialization
// ============================================================================

export class ProjectInitializer {
  constructor();

  // Create new project
  create(projectPath: string, options?: ProjectOptions): Promise<void>;

  // Templates
  applyTemplate(projectPath: string, template: string): Promise<void>;
  listTemplates(): string[];

  // Validation
  validateStructure(projectPath: string): Promise<boolean>;
}

export interface ProjectOptions {
  name?: string;
  author?: string;
  template?: string;
  bpm?: number;
  ppq?: number;
}

// ============================================================================
// Daemon Manager
// ============================================================================

export class DaemonManager {
  constructor(options: DaemonOptions);

  // Lifecycle
  start(projectPath: string): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;

  // Status
  isRunning(): boolean;
  getPid(): number | undefined;
  getStatus(): DaemonStatus;

  // IPC
  sendCommand(command: string, args?: any[]): Promise<any>;
  onCommand(command: string, handler: Function): void;
}

export interface DaemonStatus {
  pid: number;
  uptime: number;
  project: string;
  engine: {
    playing: boolean;
    scene?: string;
    patterns: number;
    cpu: number;
    memory: number;
  };
}

// ============================================================================
// MIDI Monitor
// ============================================================================

export class MidiMonitor {
  constructor(options?: MonitorOptions);

  // Monitoring
  start(): void;
  stop(): void;

  // Filtering
  filterDevice(device: string): void;
  filterChannel(channel: number): void;
  filterMessageType(type: string): void;

  // Output
  onMessage(handler: (message: MidiMessage) => void): void;
  format(message: MidiMessage): string;
}

export interface MidiMessage {
  timestamp: number;
  device: string;
  direction: 'in' | 'out';
  data: number[];
  channel?: number;
  type?: string;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
}

// ============================================================================
// Performance Tester
// ============================================================================

export class PerformanceTester {
  constructor(projectPath: string);

  // Tests
  runAllTests(): Promise<TestResults>;
  testClockPrecision(): Promise<TimingResult>;
  testMidiLatency(): Promise<LatencyResult>;
  testHotReload(): Promise<ReloadResult>;
  testMemoryUsage(): Promise<MemoryResult>;
  testCpuUsage(): Promise<CpuResult>;

  // Benchmarks
  benchmark(duration: number): Promise<BenchmarkResults>;
}

export interface TestResults {
  passed: boolean;
  tests: Array<{
    name: string;
    passed: boolean;
    value: number;
    threshold: number;
    unit: string;
  }>;
}

export interface TimingResult {
  averageJitter: number;
  maxJitter: number;
  p99Jitter: number;
}

export interface LatencyResult {
  averageLatency: number;
  maxLatency: number;
  p95Latency: number;
}

export interface ReloadResult {
  averageTime: number;
  maxTime: number;
  filesPerSecond: number;
}

export interface MemoryResult {
  initial: number;
  after100Patterns: number;
  leak: boolean;
  gcPressure: number;
}

export interface CpuResult {
  idle: number;
  at50Patterns: number;
  at100Patterns: number;
  maxBeforeThrottle: number;
}

export interface BenchmarkResults {
  duration: number;
  eventsProcessed: number;
  averageThroughput: number;
  peakThroughput: number;
  drops: number;
  timing: TimingResult;
  latency: LatencyResult;
  memory: MemoryResult;
  cpu: CpuResult;
}

// ============================================================================
// Configuration Manager
// ============================================================================

export class ConfigManager {
  constructor();

  // Global config
  getGlobalConfig(): GlobalConfig;
  setGlobalConfig(config: Partial<GlobalConfig>): void;

  // Project config
  getProjectConfig(projectPath: string): ProjectConfig;
  setProjectConfig(projectPath: string, config: Partial<ProjectConfig>): void;

  // Defaults
  resetToDefaults(): void;
}

export interface GlobalConfig {
  defaultTemplate: string;
  defaultBpm: number;
  defaultPpq: number;
  midiDebug: boolean;
  telemetry: boolean;
}

export interface ProjectConfig {
  lastScene?: string;
  lastBpm?: number;
  favorites?: string[];
  recentFiles?: string[];
}

// ============================================================================
// Output Formatters
// ============================================================================

export class OutputFormatter {
  constructor(options?: FormatterOptions);

  // Tables
  table(data: any[], columns?: string[]): string;

  // Trees
  tree(data: any, options?: TreeOptions): string;

  // Progress
  progressBar(current: number, total: number, width?: number): string;

  // Status
  status(status: any): string;

  // Errors
  error(error: Error | ValidationError): string;

  // JSON
  json(data: any, pretty?: boolean): string;
}

export interface FormatterOptions {
  colors?: boolean;
  unicode?: boolean;
  compact?: boolean;
}

export interface TreeOptions {
  showRoot?: boolean;
  maxDepth?: number;
  sortKeys?: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createCLI(): GenSeqCLI;
export function createProjectInitializer(): ProjectInitializer;
export function createDaemonManager(options: DaemonOptions): DaemonManager;
export function createMidiMonitor(options?: MonitorOptions): MidiMonitor;
export function createPerformanceTester(projectPath: string): PerformanceTester;
export function createConfigManager(): ConfigManager;
export function createOutputFormatter(options?: FormatterOptions): OutputFormatter;

// ============================================================================
// Main Entry Point
// ============================================================================

export function main(argv?: string[]): Promise<void>;