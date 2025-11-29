# Mappings System

This directory contains the MIDI input mapping and macro expansion system for GenSeq.

## Components

### MacroExpander

Expands single macro input values to multiple pattern parameters with transformation, clamping, and priority-based execution.

**Features:**
- **Wildcard Pattern Matching**: Supports `*`, `prefix-*`, and `*-suffix` patterns
- **Value Transformation**: Apply scale and offset transformations: `(value * scale) + offset`
- **Clamping**: Optional min/max value constraints
- **Priority-Based Execution**: Control execution order with priority values (ascending)
- **Event Emission**: Emits `parameter-change` events for each expanded target

**Example Usage:**

```typescript
import { MacroExpander } from '@genseq/engine';
import { PatternRegistry } from '@genseq/patterns';

// Create expander and set pattern registry
const expander = new MacroExpander();
const registry = new PatternRegistry();
expander.setPatternRegistry(registry);

// Register a macro configuration
const macro = {
  id: 'master-volume',
  targets: [
    {
      patternId: 'drum-*',      // Matches all patterns starting with "drum-"
      parameter: 'velocity',
      scale: 1.2,               // Boost by 20%
      offset: 10,               // Add 10
      clamp: { min: 60, max: 127 },
      priority: 1               // Execute first
    },
    {
      patternId: 'bass-*',      // Matches all patterns starting with "bass-"
      parameter: 'velocity',
      scale: 0.9,               // Reduce by 10%
      priority: 2               // Execute second
    }
  ]
};

expander.registerMacro(macro);

// Listen for parameter changes
expander.on('parameter-change', (event) => {
  console.log(`${event.patternId}.${event.parameter} = ${event.value}`);
});

// Expand macro value to all targets
const result = expander.expand('master-volume', 80);
// Result contains all expanded targets with transformed values
```

**Wildcard Pattern Matching:**

- `*` - Matches all active patterns
- `drum-*` - Matches patterns starting with "drum-" (e.g., drum-kick, drum-snare)
- `*-kick` - Matches patterns ending with "-kick" (e.g., drum-kick, acoustic-kick)

**Value Transformation:**

Each target can specify:
- `scale` (0-2.0): Multiply input value
- `offset` (-127 to +127): Add to scaled value
- `clamp.min` / `clamp.max`: Constrain final value

Formula: `finalValue = clamp((inputValue * scale) + offset)`

**Priority-Based Execution:**

Targets are executed in ascending priority order:
- Priority `-1` executes before priority `0`
- Priority `0` (default) executes before priority `1`
- Useful for layered control or dependency ordering

**Performance Characteristics:**

- <5ms total expansion latency for 50+ targets
- Efficient wildcard matching using string operations
- Real-time pattern registry updates

**Integration:**

MacroExpander integrates with:
- `MacroEntity` - Configuration and validation
- `PatternRegistry` - Pattern ID resolution
- `MappingRouter` - Macro target invocation (planned)

### InputTransformer

Transforms MIDI input values with various curve types (linear, exponential, logarithmic) and applies dead zones, smoothing, and quantization.

See `InputTransformer.ts` for details.

## Testing

**Unit Tests:** `tests/unit/MacroExpander.test.ts`
- Wildcard pattern matching (*, prefix-*, *-suffix)
- Value transformation (scale, offset, clamp)
- Priority-based execution ordering
- Event emission
- Error handling

**Integration Tests:** `tests/integration/macroExpansion.test.ts`
- MacroEntity validation integration
- PatternRegistry dynamic updates
- Real-world scenarios (master volume, section mixing, multi-parameter control)
- Performance characteristics (<5ms for 100+ patterns)

Run tests:
```bash
pnpm test MacroExpander.test.ts
pnpm test macroExpansion.test.ts
```

## Architecture

```
MacroExpander
├── registerMacro(macro)          Register macro configuration
├── expand(macroId, value)        Expand value to all targets
├── setPatternRegistry(registry)  Set pattern registry for wildcard resolution
└── Events:
    └── parameter-change          Emitted for each expanded target
```

## Related Files

- `/src/config/entities/MacroEntity.ts` - Macro configuration and validation
- `/src/config/entities/MappingEntity.ts` - Mapping configuration (includes macro targets)
- `/src/mappings/InputTransformer.ts` - MIDI input value transformation
- `/tests/unit/MacroExpander.test.ts` - Unit tests
- `/tests/integration/macroExpansion.test.ts` - Integration tests
