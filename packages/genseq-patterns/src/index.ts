/**
 * @genseq/patterns - Pattern generation library
 */

// Types
export type {
  PatternContext,
  PatternHelpers,
  MidiEvent,
  Pattern,
  PatternParameters,
  PatternGeneratorFn
} from './types';

// Registry
export { PatternRegistry } from './registry/PatternRegistry';

// Helpers
export { PatternHelperImpl, defaultPatternHelpers } from './helpers/PatternHelpers';

// Euclidean Pattern
export { EuclideanPattern, createEuclideanPattern, type EuclideanPatternConfig } from './euclidean/EuclideanPattern';

// Probability Pattern
export { ProbabilityPattern, createProbabilityPattern, type ProbabilityPatternConfig } from './probability/ProbabilityPattern';

// Phase Pattern
export { PhasePattern, createPhasePattern, type PhasePatternConfig } from './phase/PhasePattern';

// Techno Patterns
export {
  // Types
  type TechnoPatternBaseConfig,
  type TechnoKickBassConfig,
  type TechnoHiHatConfig,
  type TechnoChordConfig,
  type TechnoLeadConfig,
  type TechnoPatternConfig,
  type HiHatLayerConfig,
  type VelocityCurve,
  type VelocityContour,
  type RegenerateMode,
  type ScaleName,
  TECHNO_DEFAULTS,
  SUPPORTED_SCALES,
  // Patterns
  TechnoKickBassPattern,
  createTechnoKickBassPattern,
  TechnoHiHatPattern,
  createTechnoHiHatPattern,
  TechnoChordPattern,
  createTechnoChordPattern,
  TechnoLeadPattern,
  createTechnoLeadPattern,
} from './techno';
