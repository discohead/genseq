# 003: Techno Pattern Generators - Requirements Checklist

## User Story Verification

### US1: Kick/Bass Pattern
- [ ] AC1.1: Kick triggers on quarter notes
- [ ] AC1.2: Bass syncopated between kicks
- [ ] AC1.3: Separate MIDI channels
- [ ] AC1.4: 1-8 note bass sequences
- [ ] AC1.5: Configurable syncopation
- [ ] AC1.6: Beat 1 accent velocity
- [ ] AC1.7: 1-4 bar length
- [ ] AC1.8: Hot-reload maintains phase
- [ ] EC1.1: Bass sequence loops
- [ ] EC1.2: Zero syncopation warning
- [ ] EC1.3: Zero velocity creates gaps

### US2: Hi-Hat Pattern
- [ ] AC2.1: Closed offbeat 8ths default
- [ ] AC2.2: Open hi-hat configurable
- [ ] AC2.3: Ride cymbal layer
- [ ] AC2.4: Distinct MIDI notes
- [ ] AC2.5: Density parameter
- [ ] AC2.6: Swing amount
- [ ] AC2.7: Ghost notes
- [ ] AC2.8: Layer enable/disable
- [ ] EC2.1: 0% density = silence
- [ ] EC2.2: 100% density = all steps
- [ ] EC2.3: Extreme swing = triplet
- [ ] EC2.4: Open overrides closed

### US3: Chord Pattern
- [ ] AC3.1: 2-4 note voicings
- [ ] AC3.2: Configurable positions
- [ ] AC3.3: Stab density
- [ ] AC3.4: Chord inversions
- [ ] AC3.5: Note spread
- [ ] AC3.6: Velocity curve
- [ ] AC3.7: Scale quantization
- [ ] AC3.8: Syncopation offset
- [ ] EC3.1: Single note fallback
- [ ] EC3.2: Wide spread clamped
- [ ] EC3.3: No stabs = empty

### US4: Lead Pattern
- [ ] AC4.1: 5-8 note phrases
- [ ] AC4.2: Scale quantization
- [ ] AC4.3: Independent phrase length
- [ ] AC4.4: Octave range
- [ ] AC4.5: Duration variation
- [ ] AC4.6: Rest probability
- [ ] AC4.7: Phrase regeneration
- [ ] AC4.8: Velocity contours
- [ ] EC4.1: Single note phrase
- [ ] EC4.2: 100% rest = silence
- [ ] EC4.3: Scale note reuse

---

## Functional Requirements

- [ ] FR1.1: Four pattern types registered
- [ ] FR1.2: JSON Schema per type
- [ ] FR1.3: PatternRegistry integration
- [ ] FR1.4: Factory pattern

- [ ] FR2: Config schema complete
- [ ] FR3.1: MidiEvent[] output
- [ ] FR3.2: Note range 0-127
- [ ] FR3.3: Velocity range 0-127
- [ ] FR3.4: Channel routing

- [ ] FR4.1: Hot-reload <50ms
- [ ] FR4.2: Bar boundary changes
- [ ] FR4.3: CC mapping
- [ ] FR4.4: Macro support

- [ ] FR5.1: PatternHelpers.scale() used
- [ ] FR5.2: All 11 scales supported
- [ ] FR5.3: Root note config
- [ ] FR5.4: Global key override

---

## Non-Functional Requirements

- [ ] NFR1.1: tick() <0.1ms
- [ ] NFR1.2: Memory <1KB/pattern
- [ ] NFR1.3: Config update <1ms

- [ ] NFR2.1: >90% test coverage
- [ ] NFR2.2: Follows EuclideanPattern structure
- [ ] NFR2.3: TypeScript strict

- [ ] NFR3.1: Transport compatible
- [ ] NFR3.2: Bus routing compatible
- [ ] NFR3.3: MIDI output compatible

---

## Constitution Compliance

- [ ] I. Library-First: In @genseq/patterns
- [ ] II. Test-First: Red/Green phases
- [ ] III. Performance: Benchmarks pass
- [ ] IV. Schema-Driven: All schemas valid
- [ ] V. File-Driven: JSON/YAML configs
- [ ] VIII. Bidirectional: CC mappable

---

## Sign-off

| Reviewer | Date | Approved |
|----------|------|----------|
| | | [ ] |
