/**
 * T002: Techno Pattern Type Definitions
 *
 * TypeScript interfaces for all four techno pattern configurations.
 * Follows data-model.md specifications.
 */

import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';

// Re-export for convenience
export type { PatternContext, MidiEvent, PatternGeneratorFn };

/**
 * Base configuration shared by all techno patterns
 */
export interface TechnoPatternBaseConfig {
  /** Pattern is active */
  enabled: boolean;
  /** Pattern length in bars (1, 2, or 4) */
  length: 1 | 2 | 4;
  /** Output bus for routing */
  bus: string;
}

/**
 * TechnoKickBassPattern - Combined kick drum and bass line generator (US1)
 *
 * Creates foundational 4-on-the-floor kick with interlocking bass lines.
 * Kick triggers on quarter notes, bass syncopates between kicks.
 */
export interface TechnoKickBassConfig extends TechnoPatternBaseConfig {
  type: 'techno-kick-bass';

  /** Kick drum configuration */
  kick: {
    /** MIDI note number (default: 36 = C1, standard kick) */
    note: number;
    /** MIDI channel 1-16 (default: 10 = drums) */
    channel: number;
    /** Base velocity 0-127 (default: 100) */
    velocity: number;
    /** Velocity on beat 1 for accent (default: 127) */
    accentVelocity: number;
    /** Enable/disable kick */
    enabled: boolean;
  };

  /** Bass line configuration */
  bass: {
    /** Note sequence, 1-8 MIDI notes (default: [36]) */
    notes: number[];
    /** MIDI channel 1-16 (default: 1) */
    channel: number;
    /** Base velocity 0-127 (default: 90) */
    velocity: number;
    /** Note duration in beats (default: 0.25) */
    duration: number;
    /** Offset from kick in 16th notes, 0-15 (default: 1) */
    syncopation: number;
    /** Base octave for bass notes (default: 2) */
    octave: number;
    /** Enable/disable bass */
    enabled: boolean;
  };
}

/**
 * Hi-hat layer configuration
 */
export interface HiHatLayerConfig {
  /** MIDI note number */
  note: number;
  /** Velocity 0-127 */
  velocity: number;
  /** Enable/disable this layer */
  enabled: boolean;
}

/**
 * TechnoHiHatPattern - Multi-layer hi-hat generator (US2)
 *
 * Creates driving hi-hat patterns with closed, open, and ride layers.
 * Supports swing, ghost notes, and density control.
 */
export interface TechnoHiHatConfig extends TechnoPatternBaseConfig {
  type: 'techno-hihat';

  /** MIDI channel for all hi-hat sounds (default: 10 = drums) */
  channel: number;

  /** Closed hi-hat layer */
  closed: HiHatLayerConfig & {
    /** Density percentage 0-100 (default: 100) */
    density: number;
    /** Position mode (default: 'offbeat') */
    position: 'offbeat' | 'onbeat' | 'all-8th' | 'all-16th';
  };

  /** Open hi-hat layer */
  open: HiHatLayerConfig & {
    /** Beat positions for open hi-hat, 1-indexed (e.g., [2, 4]) */
    pattern: number[];
  };

  /** Ride cymbal layer */
  ride: HiHatLayerConfig & {
    /** Density percentage 0-100 */
    density: number;
  };

  /** Swing amount 0-100% (default: 0) */
  swing: number;
  /** Velocity for ghost notes (default: 40) */
  ghostVelocity: number;
  /** Probability of ghost notes 0-100% (default: 0) */
  ghostProbability: number;
}

/**
 * Velocity curve types for expression
 */
export type VelocityCurve = 'flat' | 'decay' | 'accent-first';

/**
 * TechnoChordPattern - Sparse syncopated chord stab generator (US3)
 *
 * Creates chord voicings with scale quantization and sparse rhythmic placement.
 */
export interface TechnoChordConfig extends TechnoPatternBaseConfig {
  type: 'techno-chord';

  /** MIDI channel (default: 2) */
  channel: number;

  /** Chord voicing configuration */
  voicing: {
    /** Number of notes per chord, 2-4 (default: 3) */
    notes: number;
    /** Root note MIDI number (default: 60 = C4) */
    root: number;
    /** Scale name for quantization (default: 'minor') */
    scale: string;
    /** Chord inversion 0-2 (default: 0) */
    inversion: 0 | 1 | 2;
    /** Semitones between notes (default: 4) */
    spread: number;
  };

  /** Rhythm configuration */
  rhythm: {
    /** 16th note positions within pattern, 1-indexed (e.g., [3, 11, 27]) */
    positions: number[];
    /** Offset from downbeat in ticks (default: 0) */
    syncopation: number;
    /** Probability each position triggers, 0-100 (default: 100) */
    density: number;
  };

  /** Base velocity 0-127 (default: 100) */
  velocity: number;
  /** Note duration in beats (default: 0.5) */
  duration: number;
  /** Velocity curve for attack shaping (default: 'flat') */
  velocityCurve: VelocityCurve;
}

/**
 * Velocity contour types for lead patterns
 */
export type VelocityContour = 'flat' | 'accent-first' | 'accent-last' | 'random';

/**
 * Phrase regeneration modes
 */
export type RegenerateMode = 'never' | 'cycle' | 'trigger';

/**
 * TechnoLeadPattern - Looping melodic phrase generator (US4)
 *
 * Creates hypnotic 5-8 note melodic phrases with scale quantization.
 */
export interface TechnoLeadConfig extends TechnoPatternBaseConfig {
  type: 'techno-lead';

  /** MIDI channel (default: 3) */
  channel: number;

  /** Phrase definition */
  phrase: {
    /** Fixed note sequence (used when mode is 'fixed') */
    notes: number[];
    /** Number of notes to generate, 5-8 (used when mode is 'generative') */
    length: number;
    /** Scale name for quantization (default: 'minor') */
    scale: string;
    /** Root note MIDI number (default: 60) */
    root: number;
    /** Octave range 1-3 (default: 1) */
    octaveRange: number;
    /** Phrase mode (default: 'generative') */
    mode: 'fixed' | 'generative';
  };

  /** Rhythm configuration */
  rhythm: {
    /** Note division: 4=quarter, 8=8th, 16=16th, 32=32nd (default: 16) */
    division: 4 | 8 | 16 | 32;
    /** Probability of rest 0-100 (default: 15) */
    restProbability: number;
    /** Duration variation percentage 0-100 (default: 20) */
    durationVariation: number;
  };

  /** Base velocity 0-127 (default: 90) */
  velocity: number;
  /** Velocity contour for phrase (default: 'accent-first') */
  velocityContour: VelocityContour;
  /** Overlap notes slightly (default: false) */
  legato: boolean;
  /** When to regenerate phrase (default: 'cycle') */
  regenerateOn: RegenerateMode;
}

/**
 * Union type for all techno pattern configs
 */
export type TechnoPatternConfig =
  | TechnoKickBassConfig
  | TechnoHiHatConfig
  | TechnoChordConfig
  | TechnoLeadConfig;

/**
 * Default configurations for each pattern type
 */
export const TECHNO_DEFAULTS = {
  kickBass: {
    type: 'techno-kick-bass' as const,
    enabled: true,
    length: 1 as const,
    bus: 'main',
    kick: {
      note: 36,
      channel: 10,
      velocity: 100,
      accentVelocity: 127,
      enabled: true,
    },
    bass: {
      notes: [36],
      channel: 1,
      velocity: 90,
      duration: 0.25,
      syncopation: 1,
      octave: 2,
      enabled: true,
    },
  } satisfies TechnoKickBassConfig,

  hiHat: {
    type: 'techno-hihat' as const,
    enabled: true,
    length: 1 as const,
    bus: 'main',
    channel: 10,
    closed: {
      note: 42,
      velocity: 80,
      density: 100,
      position: 'offbeat' as const,
      enabled: true,
    },
    open: {
      note: 46,
      velocity: 90,
      pattern: [],
      enabled: false,
    },
    ride: {
      note: 51,
      velocity: 70,
      density: 0,
      enabled: false,
    },
    swing: 0,
    ghostVelocity: 40,
    ghostProbability: 0,
  } satisfies TechnoHiHatConfig,

  chord: {
    type: 'techno-chord' as const,
    enabled: true,
    length: 4 as const,
    bus: 'main',
    channel: 2,
    voicing: {
      notes: 3,
      root: 60,
      scale: 'minor',
      inversion: 0 as const,
      spread: 4,
    },
    rhythm: {
      positions: [3, 11, 27],
      syncopation: 0,
      density: 100,
    },
    velocity: 100,
    duration: 0.5,
    velocityCurve: 'flat' as const,
  } satisfies TechnoChordConfig,

  lead: {
    type: 'techno-lead' as const,
    enabled: true,
    length: 1 as const,
    bus: 'main',
    channel: 3,
    phrase: {
      notes: [],
      length: 6,
      scale: 'minor',
      root: 60,
      octaveRange: 1,
      mode: 'generative' as const,
    },
    rhythm: {
      division: 16 as const,
      restProbability: 15,
      durationVariation: 20,
    },
    velocity: 90,
    velocityContour: 'accent-first' as const,
    legato: false,
    regenerateOn: 'cycle' as const,
  } satisfies TechnoLeadConfig,
} as const;

/**
 * Supported scale names (from PatternHelpers)
 */
export const SUPPORTED_SCALES = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
  'chromatic',
  'pentatonic',
  'blues',
] as const;

export type ScaleName = (typeof SUPPORTED_SCALES)[number];
