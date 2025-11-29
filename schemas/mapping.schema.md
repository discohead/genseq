# MIDI Input Mapping Schema

JSON Schema for validating MIDI input mapping configuration files.

## Overview

The mapping schema validates configuration files that map MIDI input (CC, notes, pitchbend) to pattern parameters, macros, or scene triggers with optional value transformations.

## Schema Location

`/schemas/mapping.schema.json`

## Functional Requirements

Implements **FR-014** from spec.md:
- Input mappings support transformation functions including scaling (value ranges), curves (linear/exponential/logarithmic), smoothing (time-based averaging), dead zones, and quantization

## Structure

### Required Fields

```json
{
  "id": "unique-mapping-id",
  "source": { ... },
  "target": { ... }
}
```

### Source Types

**CC (Control Change)**
```json
{
  "type": "cc",
  "device": "MIDI Device Name",
  "channel": 1,          // 1-16
  "controller": 1        // 0-127 (required for CC)
}
```

**Note**
```json
{
  "type": "note",
  "device": "MIDI Device Name",
  "channel": 1,          // 1-16
  "note": 60             // 0-127 (required for note)
}
```

**Pitchbend**
```json
{
  "type": "pitchbend",
  "device": "MIDI Device Name",
  "channel": 1           // 1-16
}
```

### Target Types

**Parameter** - Control a specific pattern parameter
```json
{
  "type": "parameter",
  "patternId": "kick",
  "parameter": "velocity"
}
```

**Macro** - Control a macro that affects multiple parameters
```json
{
  "type": "macro",
  "macroId": "filter-cutoff"
}
```

**Scene** - Trigger a scene change
```json
{
  "type": "scene",
  "sceneId": "verse"
}
```

### Transform (Optional)

Value transformation with scaling, curves, smoothing, dead zones, and quantization.

**Linear Transform**
```json
{
  "type": "linear",
  "inputRange": [0, 127],
  "outputRange": [50, 127],
  "smoothing": 10,        // ms (optional, default: 0)
  "deadZone": 2,          // optional
  "deadZoneEnd": 2,       // optional
  "quantize": 8           // discrete steps (optional)
}
```

**Exponential Transform**
```json
{
  "type": "exponential",
  "curve": 2.5,           // REQUIRED for exponential, must be > 0
  "inputRange": [0, 127],
  "outputRange": [100, 10000],
  "smoothing": 20
}
```

**Logarithmic Transform**
```json
{
  "type": "logarithmic",
  "curve": 0.5,           // REQUIRED for logarithmic, must be > 0
  "inputRange": [0, 16383],
  "outputRange": [0.5, 4.0],
  "smoothing": 50,
  "deadZone": 10,
  "deadZoneEnd": 10
}
```

### Timing Quantization (Optional)

```json
{
  "quantize": "immediate"  // "bar" | "beat" | "immediate" (default)
}
```

Controls when parameter/scene changes take effect:
- `immediate`: Changes apply instantly
- `beat`: Changes apply on next beat boundary
- `bar`: Changes apply on next bar boundary

## Complete Examples

### CC to Parameter with Linear Scaling

```json
{
  "id": "mod-wheel-to-velocity",
  "enabled": true,
  "source": {
    "type": "cc",
    "device": "Launchpad Pro",
    "channel": 1,
    "controller": 1
  },
  "target": {
    "type": "parameter",
    "patternId": "kick",
    "parameter": "velocity"
  },
  "transform": {
    "type": "linear",
    "inputRange": [0, 127],
    "outputRange": [50, 127],
    "smoothing": 10
  },
  "quantize": "immediate"
}
```

### Note to Scene Trigger

```json
{
  "id": "note-trigger-scene",
  "enabled": true,
  "source": {
    "type": "note",
    "device": "Keyboard",
    "channel": 16,
    "note": 60
  },
  "target": {
    "type": "scene",
    "sceneId": "verse"
  },
  "quantize": "bar"
}
```

### Pitchbend to Parameter with Logarithmic Curve

```json
{
  "id": "pitchbend-to-rate",
  "enabled": true,
  "source": {
    "type": "pitchbend",
    "device": "Arturia KeyStep",
    "channel": 1
  },
  "target": {
    "type": "parameter",
    "patternId": "arp",
    "parameter": "rate"
  },
  "transform": {
    "type": "logarithmic",
    "curve": 0.5,
    "inputRange": [0, 16383],
    "outputRange": [0.25, 4.0],
    "smoothing": 50
  },
  "quantize": "beat"
}
```

### CC to Macro with Exponential Curve and Dead Zones

```json
{
  "id": "knob-to-filter-macro",
  "enabled": true,
  "source": {
    "type": "cc",
    "device": "MPD32",
    "channel": 10,
    "controller": 71
  },
  "target": {
    "type": "macro",
    "macroId": "filter-cutoff"
  },
  "transform": {
    "type": "exponential",
    "curve": 2.0,
    "inputRange": [0, 127],
    "outputRange": [100, 10000],
    "smoothing": 20,
    "deadZone": 2,
    "deadZoneEnd": 2
  }
}
```

### Fader to Parameter with Quantization

```json
{
  "id": "fader-to-octave",
  "enabled": true,
  "source": {
    "type": "cc",
    "device": "Faderfox",
    "channel": 1,
    "controller": 7
  },
  "target": {
    "type": "parameter",
    "patternId": "bass",
    "parameter": "octave"
  },
  "transform": {
    "type": "linear",
    "inputRange": [0, 127],
    "outputRange": [1, 5],
    "quantize": 5,
    "deadZone": 5,
    "deadZoneEnd": 5
  },
  "quantize": "immediate"
}
```

## Validation Rules

### Conditional Requirements

- **CC sources** require `controller` field (0-127)
- **Note sources** require `note` field (0-127)
- **Pitchbend sources** do not require additional fields
- **Parameter targets** require `patternId` and `parameter` fields
- **Macro targets** require `macroId` field
- **Scene targets** require `sceneId` field
- **Exponential/logarithmic transforms** require `curve` field (> 0)

### Value Ranges

- `channel`: 1-16 (MIDI channels)
- `controller`: 0-127 (CC numbers)
- `note`: 0-127 (MIDI note numbers)
- `curve`: > 0 (exponential/logarithmic exponent)
- `smoothing`: >= 0 (milliseconds)
- `deadZone`: >= 0
- `deadZoneEnd`: >= 0
- `transform.quantize`: >= 1 (discrete steps)
- `inputRange`: exactly 2 numbers [min, max]
- `outputRange`: exactly 2 numbers [min, max]

### Pattern Matching

- `id`, `patternId`, `macroId`, `sceneId`: `^[a-zA-Z0-9_-]+$`

## Invalid Examples

### Missing Required Controller for CC

```json
// INVALID - CC source without controller
{
  "id": "invalid",
  "source": {
    "type": "cc",
    "device": "Device",
    "channel": 1
    // Missing: "controller": 1
  },
  "target": {
    "type": "parameter",
    "patternId": "pat",
    "parameter": "velocity"
  }
}
```

### Exponential Without Curve

```json
// INVALID - Exponential transform requires curve
{
  "id": "invalid",
  "source": {
    "type": "cc",
    "device": "Device",
    "channel": 1,
    "controller": 1
  },
  "target": {
    "type": "parameter",
    "patternId": "pat",
    "parameter": "velocity"
  },
  "transform": {
    "type": "exponential",
    "inputRange": [0, 127],
    "outputRange": [0, 1]
    // Missing: "curve": 2.0
  }
}
```

### Parameter Target Missing Fields

```json
// INVALID - Parameter target requires patternId and parameter
{
  "id": "invalid",
  "source": {
    "type": "cc",
    "device": "Device",
    "channel": 1,
    "controller": 1
  },
  "target": {
    "type": "parameter",
    "parameter": "velocity"
    // Missing: "patternId": "kick"
  }
}
```

## Testing

Comprehensive test coverage in:
- `/packages/genseq-engine/tests/unit/schema-validation-mapping.test.ts` - 30 test cases
- `/packages/genseq-engine/tests/unit/schema-validation-mapping-examples.test.ts` - Example file validation

Run tests:
```bash
cd packages/genseq-engine
pnpm vitest tests/unit/schema-validation-mapping --run
```

## Usage in Code

```typescript
import Ajv from 'ajv';
import * as fs from 'fs';

const ajv = new Ajv();
const schema = JSON.parse(fs.readFileSync('schemas/mapping.schema.json', 'utf-8'));
const validate = ajv.compile(schema);

const mapping = {
  id: 'my-mapping',
  source: { type: 'cc', device: 'Device', channel: 1, controller: 1 },
  target: { type: 'parameter', patternId: 'kick', parameter: 'velocity' }
};

if (validate(mapping)) {
  console.log('Valid mapping configuration');
} else {
  console.error('Validation errors:', validate.errors);
}
```

## See Also

- `/examples/basic-sequencer/mappings/example-mappings.json` - Complete example file
- FR-014 in `/specs/001-midi-sequencer-engine/spec.md` - Functional requirements
- `/schemas/pattern.schema.json` - Pattern configuration schema
- `/schemas/route.schema.json` - MIDI routing schema
- `/schemas/scene.schema.json` - Scene configuration schema
