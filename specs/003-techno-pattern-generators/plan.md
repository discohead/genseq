# 003: Techno Pattern Generators - Implementation Plan

## Constitution Compliance Check

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Library-First | ✅ | Patterns added to @genseq/patterns library |
| II. Test-First | ✅ | Tests written before implementation |
| III. Performance Contract | ✅ | <0.1ms tick execution verified |
| IV. Schema-Driven | ✅ | JSON schemas for each pattern type |
| V. File-Driven | ✅ | Patterns configured via JSON/YAML |
| VI. VS Code UI | N/A | No UI changes in this feature |
| VII. Script Safety | N/A | No script execution |
| VIII. Bidirectional MIDI | ✅ | CC mapping to pattern params |

---

## Architecture

### Component Placement

```
packages/genseq-patterns/src/
├── techno/
│   ├── TechnoKickBassPattern.ts    # US1
│   ├── TechnoHiHatPattern.ts       # US2
│   ├── TechnoChordPattern.ts       # US3
│   ├── TechnoLeadPattern.ts        # US4
│   ├── types.ts                    # Shared techno types
│   └── index.ts                    # Barrel export
├── index.ts                        # Add techno exports
└── types.ts                        # Extend Pattern union

schemas/
├── techno-kick-bass.schema.json
├── techno-hihat.schema.json
├── techno-chord.schema.json
└── techno-lead.schema.json

packages/genseq-patterns/tests/
└── techno/
    ├── TechnoKickBassPattern.test.ts
    ├── TechnoHiHatPattern.test.ts
    ├── TechnoChordPattern.test.ts
    └── TechnoLeadPattern.test.ts
```

### Class Structure

Each pattern follows existing EuclideanPattern architecture:

```typescript
class TechnoXxxPattern {
  constructor(config: TechnoXxxConfig)

  // Core lifecycle
  tick(context: PatternContext): MidiEvent[]
  updateConfig(config: Partial<TechnoXxxConfig>): void
  reset(): void
  destroy(): void

  // Pattern-specific
  private generatePattern(): void
  private calculateStep(context: PatternContext): number
}

// Factory function for consistency
function createTechnoXxxPattern(config): PatternGeneratorFn
```

---

## Technology Decisions

### Rhythm Generation

**Kick/Bass Syncopation:**
- Kick: Fixed quarter note grid (steps 0, 4, 8, 12 in 16th notes)
- Bass: Offset by `syncopation` parameter from kick positions
- Use euclidean helper for consistent distribution

**Hi-Hat Positions:**
- Offbeat: Steps 2, 6, 10, 14 (16th notes)
- All-8th: Steps 0, 2, 4, 6, 8, 10, 12, 14
- All-16th: All 16 steps
- Swing applied as tick offset to even steps

**Chord Stab Timing:**
- Positions specified in 16th notes (1-64 for 4 bars)
- Syncopation adds tick offset to each position
- Density probability checked per position

**Lead Phrase:**
- Notes played on division grid (8th or 16th)
- Rest probability checked each step
- Phrase loops independently of bar length

### Scale Quantization

Reuse existing `PatternHelpers.scale()`:
- All melodic content (bass, chord, lead) quantized
- Root note determines key center
- Scale determines available pitches

### Velocity Handling

```typescript
// Accent patterns
'flat': velocity
'accent-first': [velocity + 20, velocity, velocity, ...]
'decay': [velocity, velocity - 10, velocity - 20, ...]
'random': velocity ± random(0, humanize)
```

---

## Integration Points

### PatternRegistry Integration

```typescript
// In PatternRegistry.ts
import { createTechnoKickBassPattern } from './techno';
import { createTechnoHiHatPattern } from './techno';
import { createTechnoChordPattern } from './techno';
import { createTechnoLeadPattern } from './techno';

// Register factories
registry.register('techno-kick-bass', createTechnoKickBassPattern);
registry.register('techno-hihat', createTechnoHiHatPattern);
registry.register('techno-chord', createTechnoChordPattern);
registry.register('techno-lead', createTechnoLeadPattern);
```

### Schema Validation

Schemas added to existing validation pipeline:
- ConfigLoader validates against schema before instantiation
- SchemaValidator resolves schema by pattern type
- Errors include file path and line number

### Hot-Reload Support

All patterns support config updates:
- `updateConfig()` applies changes
- Pattern regenerates on structural changes
- Phase maintained when possible

---

## Phased Implementation

### Phase 1: Infrastructure (Day 1)
- Create directory structure
- Define shared types
- Create JSON schemas
- Write test skeletons

### Phase 2: Kick/Bass Pattern (Day 1-2)
- Tests first (TDD)
- Core kick generation
- Bass syncopation logic
- Velocity accents
- Integration tests

### Phase 3: Hi-Hat Pattern (Day 2)
- Tests first
- Closed hi-hat positions
- Open hi-hat triggers
- Swing implementation
- Ghost note probability

### Phase 4: Chord Pattern (Day 3)
- Tests first
- Chord voicing generation
- Scale quantization
- Inversion logic
- Sparse rhythm

### Phase 5: Lead Pattern (Day 3-4)
- Tests first
- Phrase generation
- Rest probability
- Velocity contours
- Regeneration modes

### Phase 6: Integration (Day 4)
- PatternRegistry integration
- Example project update
- End-to-end testing
- Performance benchmarks

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Timing drift in multi-pattern | Medium | High | Share clock reference, test with 4 patterns |
| Memory leak on hot-reload | Low | High | Add destroy() cleanup, memory profiling |
| Scale quantization edge cases | Low | Medium | Comprehensive scale tests |
| MIDI channel conflicts | Medium | Low | Document channel recommendations |

---

## Testing Strategy

### Unit Tests
- Each pattern class tested in isolation
- Mock PatternContext for deterministic tests
- Test all edge cases from spec

### Integration Tests
- 4 patterns running simultaneously
- Hot-reload parameter changes
- Pattern type switching

### Performance Tests
- tick() execution time (<0.1ms)
- Memory usage (<1KB per pattern)
- 50 pattern stress test

### Manual Tests
- Route to hardware synths
- Verify musical output
- Test with live-performance example

---

## Complexity Tracking

| Addition | Justification |
|----------|---------------|
| 4 new pattern types | Core feature request |
| 4 new JSON schemas | Constitution IV compliance |
| ~2000 LOC | Necessary for feature completeness |

No constitution violations. All additions follow existing patterns.

---

## Success Criteria

1. ✅ All 4 pattern types generate valid MIDI output
2. ✅ All acceptance criteria from spec.md verified
3. ✅ >90% test coverage
4. ✅ Performance contracts met
5. ✅ live-performance example updated
6. ✅ Hot-reload works for all parameters
7. ✅ MIDI CC mapping functional
