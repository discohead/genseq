/**
 * T022: PatternContext and MidiEvent type definitions
 *
 * Core types for pattern generation and MIDI events
 */

export interface PatternContext {
  params: Record<string, any>;
  position: {
    bar: number;
    beat: number;
    tick: number;
  };
  ppq: number;
  helpers: PatternHelpers;
}

export interface PatternHelpers {
  euclidean: (steps: number, pulses: number) => boolean[];
  probability: (chance: number) => boolean;
  scale: (note: number, scaleName: string) => number;
  quantize: (value: number, step: number) => number;
}

export interface MidiEvent {
  tick: number;
  type: 'noteOn' | 'noteOff' | 'cc' | 'program';
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  channel?: number;
}

export interface Pattern {
  id: string;
  name: string;
  type: 'euclidean' | 'probability' | 'phase' | 'script';
  enabled: boolean;
  length: number; // bars
  division: number; // note division
  bus: string;
  note?: number;
  channel?: number;
  parameters: PatternParameters;
  scriptPath?: string;
  scriptParams?: Record<string, any>;
}

export interface PatternParameters {
  // Euclidean
  steps?: number;
  pulses?: number;
  rotation?: number;

  // Probability
  probability?: number;
  density?: number;

  // Phase
  phaseOffset?: number;
  phaseRate?: number;

  // Common
  velocity?: number | number[];
  gateLength?: number;
  humanize?: number;
}

export type PatternGeneratorFn = (context: PatternContext) => MidiEvent[];
