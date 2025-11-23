/**
 * GenSeq Patterns API Contract
 * Standard pattern library for algorithmic generation
 */

// ============================================================================
// Core Pattern Types
// ============================================================================

export interface PatternContext {
  position: {
    bar: number;
    beat: number;
    tick: number;
  };
  ppq: number;
  division: number;  // Note division (4 = quarter, 8 = eighth)
  length: number;    // Pattern length in bars
}

export interface MidiEvent {
  tick: number;      // Absolute tick when event should fire
  type: 'noteOn' | 'noteOff' | 'cc';
  note?: number;     // 0-127
  velocity?: number; // 0-127
  controller?: number;
  value?: number;
  channel?: number;  // 1-16
}

export interface PatternGenerator {
  id: string;
  name: string;

  // Generate events for current tick
  tick(context: PatternContext): MidiEvent[];

  // Update parameters (for hot-reload)
  setParameter(name: string, value: any): void;
  getParameter(name: string): any;
  getParameters(): Record<string, any>;

  // State management
  reset(): void;
  getState(): any;
}

// ============================================================================
// Euclidean Pattern
// ============================================================================

export interface EuclideanParameters {
  steps: number;       // Total steps in pattern (1-64)
  pulses: number;      // Number of active pulses (0-steps)
  rotation: number;    // Rotate pattern by N steps
  velocity: number | number[];  // Fixed or per-step velocities
  gateLength: number;  // Note length in ticks
  humanize?: number;   // Timing variance in ms
}

export class EuclideanPattern implements PatternGenerator {
  constructor(params: EuclideanParameters);

  id: string;
  name: string;

  tick(context: PatternContext): MidiEvent[];
  setParameter(name: keyof EuclideanParameters, value: any): void;
  getParameter(name: keyof EuclideanParameters): any;
  getParameters(): EuclideanParameters;
  reset(): void;
  getState(): { currentStep: number; pattern: boolean[] };

  // Euclidean-specific methods
  getPattern(): boolean[];
  rotatePattern(amount: number): void;
}

// ============================================================================
// Probability Pattern
// ============================================================================

export interface ProbabilityParameters {
  probability: number;  // 0-100% chance per step
  density: number;      // Overall density scaling 0-1
  velocity: number | number[];
  gateLength: number;
  seed?: number;        // For reproducible randomness
  humanize?: number;
}

export class ProbabilityPattern implements PatternGenerator {
  constructor(params: ProbabilityParameters);

  id: string;
  name: string;

  tick(context: PatternContext): MidiEvent[];
  setParameter(name: keyof ProbabilityParameters, value: any): void;
  getParameter(name: keyof ProbabilityParameters): any;
  getParameters(): ProbabilityParameters;
  reset(): void;
  getState(): { seed: number; lastTrigger: number };

  // Probability-specific methods
  setSeed(seed: number): void;
  getDensityAdjustedProbability(): number;
}

// ============================================================================
// Phase Pattern
// ============================================================================

export interface PhaseParameters {
  basePattern: boolean[];  // Base rhythm pattern
  phaseOffset: number;     // Initial offset in ticks
  phaseRate: number;       // Multiplication factor (0.5 = half speed, 2 = double)
  velocity: number | number[];
  gateLength: number;
  humanize?: number;
}

export class PhasePattern implements PatternGenerator {
  constructor(params: PhaseParameters);

  id: string;
  name: string;

  tick(context: PatternContext): MidiEvent[];
  setParameter(name: keyof PhaseParameters, value: any): void;
  getParameter(name: keyof PhaseParameters): any;
  getParameters(): PhaseParameters;
  reset(): void;
  getState(): { currentPhase: number; basePosition: number };

  // Phase-specific methods
  getCurrentPhase(): number;
  setPhaseOffset(offset: number): void;
  setPhaseRate(rate: number): void;
}

// ============================================================================
// Custom Script Pattern
// ============================================================================

export interface ScriptPatternParameters {
  scriptPath: string;
  scriptParams: Record<string, any>;
  velocity: number;
  gateLength: number;
}

export interface ScriptModule {
  create(context: PatternContext, params: any): {
    tick: (context: PatternContext) => MidiEvent[];
    reset?: () => void;
    getState?: () => any;
  };
}

export class ScriptPattern implements PatternGenerator {
  constructor(params: ScriptPatternParameters, sandbox: ScriptSandbox);

  id: string;
  name: string;

  tick(context: PatternContext): MidiEvent[];
  setParameter(name: string, value: any): void;
  getParameter(name: string): any;
  getParameters(): Record<string, any>;
  reset(): void;
  getState(): any;

  // Script-specific methods
  reloadScript(): Promise<void>;
  validateScript(): Promise<boolean>;
  getScriptErrors(): Error[];
}

// ============================================================================
// Pattern Registry
// ============================================================================

export class PatternRegistry {
  constructor();

  // Registration
  register(type: string, factory: PatternFactory): void;
  unregister(type: string): boolean;
  getTypes(): string[];
  hasType(type: string): boolean;

  // Creation
  create(type: string, params: any): PatternGenerator;
  createFromConfig(config: PatternConfig): PatternGenerator;

  // Validation
  validateParameters(type: string, params: any): ValidationResult;
  getParameterSchema(type: string): any; // JSON Schema
}

export interface PatternFactory {
  type: string;
  create(params: any): PatternGenerator;
  validateParams(params: any): ValidationResult;
  getDefaultParams(): any;
  getParamSchema(): any; // JSON Schema
}

export interface PatternConfig {
  id: string;
  type: string;
  parameters: any;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

// ============================================================================
// Script Sandbox
// ============================================================================

export class ScriptSandbox {
  constructor(options?: SandboxOptions);

  // Script execution
  loadScript(path: string): Promise<ScriptModule>;
  executeScript(script: ScriptModule, method: string, args: any[]): any;

  // Resource management
  setMemoryLimit(mb: number): void;
  setTimeLimit(ms: number): void;
  getMemoryUsage(): number;
  getExecutionTime(): number;

  // Security
  validateScript(path: string): Promise<ValidationResult>;
  getWhitelistedGlobals(): string[];
}

export interface SandboxOptions {
  memoryLimitMB?: number;  // Default: 10
  timeLimitMs?: number;    // Default: 5
  globals?: Record<string, any>;
}

// ============================================================================
// Pattern Utilities
// ============================================================================

export class PatternHelpers {
  // Rhythm generation
  static euclidean(steps: number, pulses: number): boolean[];
  static bjorklund(steps: number, pulses: number): boolean[];

  // Probability
  static probability(chance: number, seed?: number): boolean;
  static weightedRandom(weights: number[], seed?: number): number;

  // Musical scales
  static scaleNote(root: number, scale: string, degree: number): number;
  static getScale(name: string): number[];

  // Velocity curves
  static velocityCurve(start: number, end: number, steps: number, curve: 'linear' | 'exponential' | 'logarithmic'): number[];
  static humanizeVelocity(velocity: number, amount: number): number;

  // Timing
  static humanizeTiming(tick: number, amountMs: number, ppq: number): number;
  static swingTiming(tick: number, amount: number, ppq: number): number;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createPatternRegistry(): PatternRegistry;
export function createEuclideanPattern(params: EuclideanParameters): EuclideanPattern;
export function createProbabilityPattern(params: ProbabilityParameters): ProbabilityPattern;
export function createPhasePattern(params: PhaseParameters): PhasePattern;
export function createScriptPattern(params: ScriptPatternParameters, sandbox: ScriptSandbox): ScriptPattern;
export function createScriptSandbox(options?: SandboxOptions): ScriptSandbox;

// ============================================================================
// Default Export
// ============================================================================

export default {
  EuclideanPattern,
  ProbabilityPattern,
  PhasePattern,
  ScriptPattern,
  PatternRegistry,
  PatternHelpers,
  ScriptSandbox,
  createPatternRegistry,
  createEuclideanPattern,
  createProbabilityPattern,
  createPhasePattern,
  createScriptPattern,
  createScriptSandbox
};