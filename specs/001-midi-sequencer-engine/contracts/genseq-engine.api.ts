/**
 * GenSeq Engine API Contract
 * Core library for MIDI sequencing engine
 */

import { EventEmitter } from 'events';

// ============================================================================
// Core Types
// ============================================================================

export interface Position {
  bar: number;    // 1-based
  beat: number;   // 1-based
  tick: number;   // 0-based
}

export interface ClockConfig {
  bpm: number;
  ppq: number;
  swing?: number;
}

export interface EngineOptions {
  projectPath: string;
  midiDebug?: boolean;
  performanceTracking?: boolean;
  maxPatterns?: number;
  maxCpuPercent?: number;
}

export interface EngineStatus {
  playing: boolean;
  position: Position;
  bpm: number;
  currentScene?: string;
  activePatterns: string[];
  cpuUsage: number;
  memoryUsage: number;
}

export interface ValidationError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface MidiDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  connected: boolean;
}

// ============================================================================
// Main Engine API
// ============================================================================

export class GenSeqEngine extends EventEmitter {
  constructor(options: EngineOptions);

  // Transport Control
  start(): Promise<void>;
  stop(): Promise<void>;
  continue(): Promise<void>;
  setPosition(position: Position): void;

  // Scene Management
  loadScene(sceneId: string): Promise<void>;
  queueScene(sceneId: string, quantization?: 'bar' | 'beat'): void;
  getCurrentScene(): string | undefined;

  // Pattern Control
  enablePattern(patternId: string): void;
  disablePattern(patternId: string): void;
  setPatternParameter(patternId: string, param: string, value: any): void;
  getActivePatterns(): string[];

  // Configuration
  reloadConfiguration(): Promise<ValidationError[]>;
  validateConfiguration(): Promise<ValidationError[]>;
  getConfiguration(): any; // Returns current config object

  // MIDI Devices
  getMidiDevices(): MidiDevice[];
  refreshMidiDevices(): Promise<void>;

  // Status & Monitoring
  getStatus(): EngineStatus;
  getPerformanceMetrics(): PerformanceMetrics;

  // Lifecycle
  shutdown(): Promise<void>;
}

// ============================================================================
// Events
// ============================================================================

export interface EngineEvents {
  // Transport
  'transport:start': () => void;
  'transport:stop': () => void;
  'transport:position': (position: Position) => void;

  // Scenes
  'scene:loaded': (sceneId: string) => void;
  'scene:queued': (sceneId: string, when: 'bar' | 'beat') => void;

  // Patterns
  'pattern:enabled': (patternId: string) => void;
  'pattern:disabled': (patternId: string) => void;
  'pattern:updated': (patternId: string, param: string, value: any) => void;

  // Configuration
  'config:reloaded': (errors: ValidationError[]) => void;
  'config:error': (error: ValidationError) => void;

  // MIDI
  'midi:connected': (device: MidiDevice) => void;
  'midi:disconnected': (device: MidiDevice) => void;
  'midi:sent': (device: string, message: number[]) => void;
  'midi:received': (device: string, message: number[]) => void;

  // Performance
  'performance:warning': (metric: string, value: number, threshold: number) => void;

  // Errors
  'error': (error: Error) => void;
}

// ============================================================================
// Clock API (Sub-module)
// ============================================================================

export class Clock {
  constructor(config: ClockConfig);

  start(): void;
  stop(): void;
  continue(): void;

  setTempo(bpm: number): void;
  getTempo(): number;

  getPosition(): Position;
  setPosition(position: Position): void;

  // For internal use by scheduler
  scheduleCallback(callback: (tick: number) => void): void;
  unscheduleCallback(callback: (tick: number) => void): void;

  on(event: 'tick', listener: (tick: number) => void): this;
  on(event: 'bar', listener: (bar: number) => void): this;
  on(event: 'beat', listener: (beat: number) => void): this;
}

// ============================================================================
// Scheduler API (Sub-module)
// ============================================================================

export interface ScheduledEvent {
  tick: number;
  callback: () => void;
  id?: string;
}

export class Scheduler {
  constructor(clock: Clock);

  // Event scheduling
  schedule(tick: number, callback: () => void): string;
  scheduleRelative(ticksFromNow: number, callback: () => void): string;
  cancel(eventId: string): boolean;
  cancelAll(): void;

  // Quantization
  quantizeToBar(tick: number): number;
  quantizeToBeat(tick: number): number;
  getNextBar(): number;
  getNextBeat(): number;

  // Internal processing
  processTick(tick: number): void;
}

// ============================================================================
// MIDI I/O API (Sub-module)
// ============================================================================

export class MidiIO {
  constructor();

  // Device Management
  listInputs(): MidiDevice[];
  listOutputs(): MidiDevice[];
  openInput(deviceId: string): void;
  openOutput(deviceId: string): void;
  closeInput(deviceId: string): void;
  closeOutput(deviceId: string): void;

  // Message Handling
  send(deviceId: string, message: number[]): void;
  sendNoteOn(deviceId: string, channel: number, note: number, velocity: number): void;
  sendNoteOff(deviceId: string, channel: number, note: number, velocity?: number): void;
  sendCC(deviceId: string, channel: number, controller: number, value: number): void;

  // Input handling
  on(event: 'message', listener: (device: string, message: number[]) => void): this;
  on(event: 'connected', listener: (device: MidiDevice) => void): this;
  on(event: 'disconnected', listener: (device: MidiDevice) => void): this;
}

// ============================================================================
// Performance Metrics
// ============================================================================

export interface PerformanceMetrics {
  clockJitter: {
    current: number;
    average: number;
    max: number;
    p99: number;
  };
  midiLatency: {
    current: number;
    average: number;
    max: number;
    p95: number;
  };
  cpuUsage: {
    current: number;
    average: number;
    peak: number;
  };
  memoryUsage: {
    current: number;
    peak: number;
    heapUsed: number;
    heapTotal: number;
  };
  patterns: {
    active: number;
    total: number;
    eventsPerTick: number;
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createEngine(options: EngineOptions): GenSeqEngine;
export function validateProject(projectPath: string): Promise<ValidationError[]>;
export function loadProject(projectPath: string): Promise<any>;