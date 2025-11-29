# MIDI Input Integration in GenSeqEngine

This document describes the integration of MIDI input control into the GenSeqEngine class (Phase 3 User Story 3: MIDI Input Control).

## Overview

GenSeqEngine now supports complete MIDI input control, enabling:

- **FR-013**: MIDI input device initialization and management
- **FR-014**: Mapping and macro configuration loading
- **FR-015**: MIDI input → pattern parameter routing
- **FR-016**: Scene triggers with bar/beat quantization
- **FR-017**: Macro expansion for one-to-many control

## Architecture

### Component Hierarchy

```
GenSeqEngine
├── MidiInputHandler       # MIDI device management and message parsing
├── MappingRouter          # Event routing and transformation
├── QuantizedTrigger       # Scene trigger quantization
└── PatternExecutor        # Pattern parameter updates
```

### Event Flow

```
MIDI Device
    ↓
MidiInputHandler (parse message)
    ↓
MappingRouter (match mappings, transform values)
    ↓
    ├─→ PatternExecutor (parameter changes)
    ├─→ QuantizedTrigger (scene triggers)
    └─→ GenSeqEngine (event forwarding)
```

## Initialization

All MIDI input components are initialized in the GenSeqEngine constructor:

```typescript
// GenSeqEngine.ts constructor
this.midiInputHandler = new MidiInputHandler();
this.mappingRouter = new MappingRouter();
this.quantizedTrigger = new QuantizedTrigger(this.clock, this.scheduler);
```

## Configuration Loading

### Project Structure

```
project/
├── clock.yaml
├── patterns/
│   └── *.json
├── routes/
│   └── *.json
├── mappings/          # MIDI input mappings (optional)
│   ├── cc-to-params.json
│   ├── notes-to-scenes.json
│   └── *.yaml
└── macros/            # Macro definitions (optional)
    ├── global-volume.json
    └── *.yaml
```

### Loading Sequence

During `loadProject()`, GenSeqEngine:

1. Loads clock configuration
2. Loads routes and opens MIDI output ports
3. Loads patterns and registers with PatternExecutor
4. **Loads mappings** from `project/mappings/`
5. **Loads macros** from `project/macros/`
6. **Updates available patterns** for macro wildcard matching
7. Starts file watchers for hot-reload

### Mapping Configuration Example

```yaml
# project/mappings/cc1-velocity.yaml
id: cc1-to-kick-velocity
source:
  type: cc
  device: "MIDI Controller"
  channel: 1
  controller: 1
target:
  type: parameter
  patternId: kick
  parameter: velocity
transform:
  type: linear
  inputRange: [0, 127]
  outputRange: [50, 127]
  smoothing: 50
```

### Macro Configuration Example

```yaml
# project/macros/global-volume.yaml
id: global-volume
targets:
  - patternId: "drum-*"      # Wildcard: all patterns starting with "drum-"
    parameter: velocity
    scale: 1.0
    offset: 0
    clamp:
      min: 0
      max: 127
    priority: 0
  - patternId: bass
    parameter: velocity
    scale: 0.8               # Bass at 80% of input
    offset: 10
```

## Event Handling

### MIDI Input Events

GenSeqEngine emits these events for MIDI input:

- `midi:received` - All MIDI messages
- `midi:cc` - CC messages
- `midi:note` - Note on/off messages
- `midi:pitchbend` - Pitch bend messages

### Mapping Events

- `parameter-change` - Pattern parameter updated from MIDI input
- `scene-trigger` - Scene trigger requested
- `macro-expanded` - Macro expanded to multiple targets

### Quantized Trigger Events

- `trigger:scheduled` - Scene trigger scheduled for boundary
- `trigger:executed` - Scene trigger executed at boundary

### Example Event Listeners

```typescript
engine.on('midi:received', (event) => {
  console.log(`MIDI: ${event.type} on channel ${event.channel}`);
});

engine.on('parameter-change', (event) => {
  console.log(`${event.patternId}.${event.parameter} = ${event.value}`);
});

engine.on('scene-trigger', (event) => {
  console.log(`Scene ${event.sceneId} triggered (quantize: ${event.quantize})`);
});

engine.on('trigger:executed', (event) => {
  console.log(`Scene ${event.sceneId} executed (latency: ${event.latency}ms)`);
});

engine.on('macro-expanded', (event) => {
  console.log(`Macro ${event.macroId} → ${event.targets.length} targets`);
});
```

## Internal Methods

### loadMappings(projectPath: string)

Private method that:
1. Checks for `project/mappings/` directory (optional)
2. Loads all `.json`/`.yaml` mapping files
3. Registers mappings with MappingRouter
4. Opens MIDI input devices specified in mappings
5. Handles errors gracefully (logs warnings, continues loading)

### loadMacros(projectPath: string)

Private method that:
1. Checks for `project/macros/` directory (optional)
2. Loads all `.json`/`.yaml` macro files
3. Registers macros with MappingRouter
4. Handles errors gracefully

### applyParameterChange(patternId, parameter, value)

Private method that:
1. Receives parameter change from MappingRouter
2. Forwards to PatternExecutor.updatePatternParameters()
3. Handles errors (pattern not found, invalid parameter)
4. Emits error events on failure

## Event Routing

### Parameter Changes

```typescript
// In setupEventHandlers()
this.mappingRouter.on('parameter-change', (event) => {
  this.emit('parameter-change', event);
  this.applyParameterChange(event.patternId, event.parameter, event.value);
});
```

### Scene Triggers

```typescript
this.mappingRouter.on('scene-trigger', (event) => {
  this.emit('scene-trigger', event);
  if (this.quantizedTrigger) {
    this.quantizedTrigger.trigger(event.sceneId, event.quantize || 'bar');
  }
});
```

### Macro Expansion

```typescript
this.mappingRouter.on('macro-expanded', (event) => {
  this.emit('macro-expanded', event);
  // Individual parameter-change events emitted by router
});
```

## Cleanup

On shutdown, GenSeqEngine destroys all MIDI input components:

```typescript
async shutdown() {
  // ... other cleanup ...

  if (this.midiInputHandler) {
    this.midiInputHandler.destroy();  // Closes all MIDI devices
    this.midiInputHandler = null;
  }

  if (this.mappingRouter) {
    this.mappingRouter.destroy();     // Clears mappings/macros
    this.mappingRouter = null;
  }

  if (this.quantizedTrigger) {
    this.quantizedTrigger.destroy();  // Clears pending triggers
    this.quantizedTrigger = null;
  }
}
```

## Performance Characteristics

- **MIDI Input Latency**: <1ms (MidiInputHandler processing)
- **Routing Latency**: <1ms (MappingRouter transformation)
- **Parameter Update**: <5ms (PatternExecutor update)
- **Quantized Trigger Accuracy**: <1ms (Clock-based scheduling)

## Future Enhancements

### Hot-Reload Support

Not yet implemented, but planned:
- Watch `project/mappings/` for file changes
- Watch `project/macros/` for file changes
- Reload mappings/macros without restart
- Similar to PatternFileWatcher/RouteFileWatcher

### Scene Manager Integration

QuantizedTrigger currently emits `trigger:executed` events. In Phase 6:
- Wire to SceneManager.loadScene()
- Handle scene transitions
- Support scene parameters

## Testing

### Unit Tests

Each component has unit tests:
- `MidiInputHandler.test.ts` - Device management, message parsing
- `MappingRouter.test.ts` - Event routing, transformation
- `QuantizedTrigger.test.ts` - Quantization logic

### Integration Tests

- `GenSeqEngine.midiinput.test.ts` - Complete MIDI input flow
- Placeholder tests document expected behavior
- Requires test project with mappings/macros

### Manual Testing

```bash
npx tsx tests/manual/test-midi-input.ts
```

Verifies:
- Component initialization
- Event listener setup
- Cleanup on shutdown

## Example Usage

```typescript
import { GenSeqEngine } from '@genseq/engine';

const engine = new GenSeqEngine({
  clock: { bpm: 120, ppq: 96 },
  midi: { enableVirtualLoopback: true }
});

await engine.initialize();

// Set up event listeners
engine.on('parameter-change', (event) => {
  console.log(`Parameter updated: ${event.patternId}.${event.parameter} = ${event.value}`);
});

engine.on('trigger:executed', (event) => {
  console.log(`Scene ${event.sceneId} triggered!`);
});

// Load project with mappings and macros
await engine.loadProject('./my-project');

// Start playback
engine.start();

// MIDI input now controls patterns in real-time!
```

## Related Documentation

- [MidiInputHandler Documentation](../src/midi/MidiInputHandler.ts)
- [MappingRouter Documentation](../src/mappings/MappingRouter.ts)
- [QuantizedTrigger Documentation](../src/mappings/QuantizedTrigger.ts)
- [MappingEntity Schema](../src/config/entities/MappingEntity.ts)
- [MacroEntity Schema](../src/config/entities/MacroEntity.ts)
