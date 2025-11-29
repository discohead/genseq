# 003: Techno Pattern Generators Specification

## Overview

Add four genre-specific pattern generators optimized for techno music production. These patterns encapsulate conventional techno rhythmic and melodic conventions, enabling rapid creation of authentic techno tracks through configuration rather than manual programming.

## User Scenarios

### US1: Kick/Bass Pattern Generation (P1 - Critical)

**As a** techno producer
**I want** a combined kick/bass pattern generator
**So that** I can create the foundational 4-on-the-floor kick with interlocking bass lines

**Acceptance Criteria:**
- AC1.1: Kick drum triggers on every quarter note (beats 1, 2, 3, 4)
- AC1.2: Bass notes trigger on syncopated positions between kicks
- AC1.3: Kick and bass use separate MIDI channels/notes for routing flexibility
- AC1.4: Bass patterns support configurable note sequences (1-8 notes)
- AC1.5: Bass syncopation is controllable (offset from kick in ticks)
- AC1.6: Velocity patterns support accent on beat 1 kick
- AC1.7: Pattern length is 1-4 bars configurable
- AC1.8: Hot-reload maintains phase when parameters change

**Edge Cases:**
- EC1.1: Bass note sequence shorter than pattern length loops correctly
- EC1.2: Bass syncopation at 0 creates unison with kick (valid but warned)
- EC1.3: Velocity of 0 for kick/bass creates intentional gaps

### US2: Hi-Hat Pattern Generation (P1 - Critical)

**As a** techno producer
**I want** a hi-hat pattern generator with closed/open/ride layers
**So that** I can create driving hi-hat patterns with energy builds

**Acceptance Criteria:**
- AC2.1: Closed hi-hat defaults to off-beat 8th notes (between kicks)
- AC2.2: Open hi-hat triggers configurable for energy/accent
- AC2.3: Ride cymbal layer for high-energy sections
- AC2.4: Each hi-hat type uses distinct MIDI note
- AC2.5: Density parameter controls note frequency (0-100%)
- AC2.6: Shuffle/swing amount configurable (0-100%)
- AC2.7: Ghost notes with reduced velocity for humanization
- AC2.8: Layer enable/disable without stopping transport

**Edge Cases:**
- EC2.1: Density at 0% produces silence
- EC2.2: Density at 100% fills every available step
- EC2.3: Swing at extreme values (>75%) may create triplet feel
- EC2.4: Overlapping open and closed hi-hat handled (open wins)

### US3: Chord Stab Pattern Generation (P2 - High)

**As a** techno producer
**I want** a chord stab pattern generator
**So that** I can create sparse, syncopated chord hits

**Acceptance Criteria:**
- AC3.1: Generates 2-4 note chord voicings
- AC3.2: Chord triggers on configurable sparse positions (defines WHERE stabs can occur)
- AC3.3: Stab density parameter 0-100% (probability each position triggers)
- AC3.4: Chord inversion control (root, 1st, 2nd)
- AC3.5: Note spread parameter for tight vs wide voicing
- AC3.6: Velocity curve for attack shaping (flat, decay, accent-first)
- AC3.7: Root note follows configurable scale
- AC3.8: Syncopation offset from downbeat configurable

**Edge Cases:**
- EC3.1: Single note chord degrades gracefully to monophonic
- EC3.2: Chord spans > 2 octaves clamped with warning
- EC3.3: All stabs disabled produces valid empty pattern

### US4: Lead Synth Pattern Generation (P2 - High)

**As a** techno producer
**I want** a loopy lead riff generator
**So that** I can create hypnotic 5-8 note melodic phrases

**Acceptance Criteria:**
- AC4.1: Generates looping phrases of 5-8 notes
- AC4.2: Notes quantized to configurable scale
- AC4.3: Phrase length independent of pattern length
- AC4.4: Octave range configurable (typically 1-2 octaves)
- AC4.5: Note duration variation (staccato to legato)
- AC4.6: Rest probability for rhythmic interest
- AC4.7: Phrase regeneration on demand or at cycle
- AC4.8: Velocity contour options (flat, accent-first, random)

**Edge Cases:**
- EC4.1: Phrase length of 1 creates single repeated note
- EC4.2: Rest probability at 100% produces silence
- EC4.3: Scale with < phrase length notes reuses notes

## Functional Requirements

### FR1: Pattern Type Registration

- FR1.1: Register four new pattern types: `techno-kick-bass`, `techno-hihat`, `techno-chord`, `techno-lead`
- FR1.2: Each type has JSON Schema for validation
- FR1.3: Types integrate with existing PatternRegistry
- FR1.4: Factory pattern creates instances from config

### FR2: Configuration Schema

Each pattern type requires these common fields:
```yaml
type: techno-kick-bass | techno-hihat | techno-chord | techno-lead
enabled: boolean
length: 1-4  # bars
bus: string  # output routing
channel: 1-16
```

Type-specific parameters defined in data-model.md.

### FR3: MIDI Output

- FR3.1: All patterns output MidiEvent[] per tick
- FR3.2: Note values 0-127 (MIDI standard)
- FR3.3: Velocity values 0-127
- FR3.4: Channel routing per pattern

### FR4: Real-Time Control

- FR4.1: All parameters hot-reloadable (<50ms)
- FR4.2: Parameter changes apply at next bar boundary
- FR4.3: MIDI CC mappable to pattern parameters
- FR4.4: Macro support for cross-pattern control

### FR5: Scale/Key Support

- FR5.1: Use existing PatternHelpers.scale() for quantization
- FR5.2: Support all 11 built-in scales
- FR5.3: Root note configurable per pattern
- FR5.4: Global key override from project config

## Non-Functional Requirements

### NFR1: Performance

- NFR1.1: Pattern tick() executes in <0.1ms
- NFR1.2: Memory per pattern instance <1KB
- NFR1.3: Hot-reload parameter update <1ms

### NFR2: Code Quality

- NFR2.1: Test coverage >90% for pattern logic
- NFR2.2: All patterns follow existing EuclideanPattern structure
- NFR2.3: TypeScript strict mode compliance

### NFR3: Compatibility

- NFR3.1: Works with existing transport system
- NFR3.2: Works with existing bus routing
- NFR3.3: Works with existing MIDI output

## Out of Scope

- Audio synthesis (external responsibility)
- Pattern visualization in VS Code (future feature)
- Generative AI for pattern creation
- Pattern presets/library management

## Dependencies

- @genseq/patterns library
- Existing PatternHelpers
- Existing PatternRegistry
- JSON Schema validation (ajv)

## Success Metrics

- All four pattern types generate valid MIDI
- Hot-reload works for all parameters
- Performance contracts met (<0.1ms tick)
- 90%+ test coverage achieved
- Integration with live-performance example
