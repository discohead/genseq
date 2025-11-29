/**
 * Techno Pattern Generators
 *
 * Genre-specific patterns for techno music production:
 * - TechnoKickBassPattern: 4-on-the-floor kick with interlocking bass
 * - TechnoHiHatPattern: Multi-layer hi-hat with swing and ghost notes
 * - TechnoChordPattern: Sparse syncopated chord stabs
 * - TechnoLeadPattern: Looping melodic phrases
 */

// Types
export type {
  TechnoPatternBaseConfig,
  TechnoKickBassConfig,
  TechnoHiHatConfig,
  TechnoChordConfig,
  TechnoLeadConfig,
  TechnoPatternConfig,
  HiHatLayerConfig,
  VelocityCurve,
  VelocityContour,
  RegenerateMode,
  ScaleName,
} from './types';

export { TECHNO_DEFAULTS, SUPPORTED_SCALES } from './types';

// Patterns
export { TechnoKickBassPattern, createTechnoKickBassPattern } from './TechnoKickBassPattern';
export { TechnoHiHatPattern, createTechnoHiHatPattern } from './TechnoHiHatPattern';
export { TechnoChordPattern, createTechnoChordPattern } from './TechnoChordPattern';
export { TechnoLeadPattern, createTechnoLeadPattern } from './TechnoLeadPattern';
