# Live Performance Example

Comprehensive demonstration of MIDI controller mappings for gestural control during live performance. This example showcases bidirectional MIDI I/O, transformation functions, macro controls, and scene management.

## Overview

This project demonstrates:

- **Gestural MIDI Input Control**: Hardware controller (faders, knobs, pads) controlling pattern parameters in real-time
- **CC → Parameter Mappings**: Multiple transformation types (linear, exponential, logarithmic)
- **Note → Scene Trigger Mappings**: Pad-based scene switching with bar quantization
- **Macro Usage**: One-to-many control for affecting multiple patterns simultaneously
- **Performance Scenes**: Pre-configured pattern sets for different sections (intro, main, breakdown)
- **Transformation Features**: Smoothing, dead zones, curve shaping, and value scaling

## Hardware Requirements

### Recommended Controllers

- **MIDI Controller**: Any device with faders, knobs, and pads (e.g., Akai MPD218, Novation Launchkey, Arturia KeyLab)
- **Expression Pedal**: Optional, for foot-controlled velocity (CC11)
- **MIDI Output Device**: Hardware synthesizer or DAW with virtual MIDI input

### Minimum Controller Setup

- 3 CCs (faders/knobs) for CC1, CC11, CC74
- 3 Pads/Keys for notes 36, 37, 38 (C1, C#1, D1)

## MIDI Controller Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                  MIDI CONTROLLER MAPPINGS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FADERS/KNOBS:                                                   │
│  ┌─────┐   ┌─────┐   ┌─────┐                                    │
│  │ CC1 │   │ CC74│   │ CC11│                                     │
│  │ ▓▓▓ │   │ ▓▓▓ │   │ ▓▓▓ │                                     │
│  │ ▓▓▓ │   │ ▓▓▓ │   │ ▓▓▓ │                                     │
│  │ ▓▓▓ │   │ ▓▓▓ │   │ ▓▓▓ │                                     │
│  └─────┘   └─────┘   └─────┘                                    │
│   Mod      Filter    Express                                     │
│  Wheel     Knob      Pedal                                       │
│    │         │          │                                        │
│    ├─────────┼──────────┼─────────────────────────────────────  │
│    │         │          │                                        │
│    ▼         ▼          ▼                                        │
│  MASTER   KICK ROT   MASTER                                      │
│  DENSITY           VELOCITY                                      │
│  (Linear)  (Exp)    (Log)                                        │
│  w/50ms   w/20ms    w/30ms                                       │
│  smooth   smooth    smooth                                       │
│                     +5 dead                                      │
│                                                                  │
│  PADS:                                                           │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                          │
│  │ C1  │   │ C#1 │   │ D1  │   │     │                          │
│  │ 36  │   │ 37  │   │ 38  │   │     │                          │
│  └─────┘   └─────┘   └─────┘   └─────┘                          │
│  Intro     Main     Break    (unused)                            │
│  Scene     Scene    Scene                                        │
│    │         │         │                                         │
│    └─────────┴─────────┴─── Bar Quantized ───────────────────  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## MIDI Mapping Reference

### CC Mappings (Continuous Controllers)

| CC#  | Source         | Target              | Range    | Curve        | Smoothing | Dead Zone | Description                        |
|------|----------------|---------------------|----------|--------------|-----------|-----------|-------------------------------------|
| CC1  | Mod Wheel      | Master Density      | 0.0-1.0  | Linear       | 50ms      | None      | Controls pulse density of all patterns |
| CC74 | Filter Cutoff  | Kick Rotation       | 0-16     | Exponential  | 20ms      | None      | Sweeps kick pattern rotation parameter |
| CC11 | Expression     | Master Velocity     | 0.0-1.0  | Logarithmic  | 30ms      | 5 units   | Controls velocity of all patterns     |

### Note Mappings (Scene Triggers)

| Note | Note Name | Target         | Quantization | Description                           |
|------|-----------|----------------|--------------|---------------------------------------|
| 36   | C1        | Intro Scene    | Bar          | Minimal patterns (kick + hats)        |
| 37   | C#1       | Main Scene     | Bar          | Full patterns (all active)            |
| 38   | D1        | Breakdown Scene| Bar          | Sparse patterns (hats + bass)         |

## Transformation Types Explained

### Linear (CC1 → Master Density)

```
Input:  0 ────────────────────────────────────► 127
Output: 0.0                                      1.0
        └──────────────────────────────────────┘
                    1:1 linear scaling
```

- **Use Case**: Straightforward control where input maps directly to output
- **Smoothing**: 50ms prevents zipper noise from rapid fader movements
- **Target**: Master density macro affects all pattern pulse counts

### Exponential (CC74 → Kick Rotation)

```
Input:  0 ────────────────────────────────────► 127
Output: 0          ╱──────────────────────────► 16
        └─────────╱ exponential curve
             steep at high values
```

- **Use Case**: Provides finer control at low values, coarse at high values
- **Smoothing**: 20ms for smooth parameter sweeps
- **Target**: Kick pattern rotation (0-16 steps)

### Logarithmic (CC11 → Master Velocity)

```
Input:  0 ────────────────────────────────────► 127
Output: 0 ──────────────╲                        1.0
                         ╲__________________
                    steep at low values
```

- **Use Case**: Finer control at high values, coarse at low values
- **Smoothing**: 30ms for gradual expression changes
- **Dead Zone**: 5 units in center prevents unintentional micro-adjustments
- **Target**: Master velocity macro affects all pattern velocities

## Macro System

### Master Density Macro

**Purpose**: Control the rhythmic complexity of all patterns simultaneously

**Targets**:
- Kick: 1-4 pulses (scales with macro 0.0-1.0)
- Hats: 2-8 pulses
- Snare: 1-4 pulses
- Bass: 2-8 pulses

**Use Case**: Gradually build/reduce density during transitions

### Master Velocity Macro

**Purpose**: Control overall dynamics across all patterns

**Targets**:
- Kick: 60-127 velocity
- Hats: 40-110 velocity
- Snare: 70-127 velocity
- Bass: 50-120 velocity

**Use Case**: Expression pedal control for dynamic performance swells

## Scene Configurations

### Intro Scene (Pad 36 / C1)

**Active Patterns**: Kick, Hats

**Characteristics**:
- Sparse kick (2 pulses)
- Minimal hats (4 pulses)
- Low velocities (90, 70)
- Macro presets: Density 0.3, Velocity 0.6

**Musical Context**: Opening section, gradual build-up

---

### Main Scene (Pad 37 / C#1)

**Active Patterns**: Kick, Hats, Snare, Bass

**Characteristics**:
- Full kick (4 pulses)
- Dense hats (8 pulses)
- Standard snare (2 pulses)
- Active bass (5 pulses)
- High velocities (110, 85, 115, 95)
- Macro presets: Density 1.0, Velocity 0.9

**Musical Context**: Main section, full energy

---

### Breakdown Scene (Pad 38 / D1)

**Active Patterns**: Hats, Bass

**Characteristics**:
- Sparse hats (3 pulses, rotated)
- Minimal bass (2 pulses, rotated)
- Low velocities (65, 80)
- Macro presets: Density 0.4, Velocity 0.5

**Musical Context**: Breakdown/drop section, tension before return

---

## Performance Workflow

### Setup (One-Time)

1. **Configure MIDI Output**:
   ```bash
   # Edit routes/default.json and routes/synth.json
   # Change "device" field to your MIDI hardware:
   "device": "Your MIDI Device Name"
   ```

2. **Configure MIDI Input**:
   - Mappings default to `"device": "any"`
   - To lock to specific controller, edit mapping files:
     ```json
     "input": {
       "device": "Your Controller Name",
       "channel": 1
     }
     ```

3. **Build and Start**:
   ```bash
   pnpm build && pnpm start:live
   ```

### Live Performance Sequence

1. **Start in Intro Scene**:
   - Press pad 36 (C1) to load intro scene
   - Engine starts with kick + hats (sparse)

2. **Build Tension**:
   - Slowly move mod wheel (CC1) up → increases density
   - Move expression pedal (CC11) up → increases velocity
   - Adjust filter knob (CC74) to rotate kick pattern

3. **Drop to Main**:
   - Press pad 37 (C#1) to trigger main scene
   - Scene switches at next bar boundary
   - All patterns activate (kick, hats, snare, bass)

4. **Live Manipulation**:
   - Use mod wheel to vary density during main section
   - Expression pedal for dynamic swells
   - Filter knob to shift kick rhythm

5. **Breakdown**:
   - Press pad 38 (D1) to trigger breakdown scene
   - Only hats + bass continue (sparse, rotated)
   - Lower velocities and density

6. **Return to Main**:
   - Press pad 37 (C#1) again
   - Scene switches back at bar boundary

## Customization Guide

### For Different Controllers

#### Akai MPD218
```json
// mappings/mod-wheel-density.json
"input": {
  "device": "MPD218",
  "channel": 1,
  "type": "cc",
  "number": 1  // Knob K1
}
```

#### Novation Launchkey
```json
// mappings/filter-knob.json
"input": {
  "device": "Launchkey Mini",
  "channel": 1,
  "type": "cc",
  "number": 21  // Knob 1
}
```

#### Arturia KeyLab
```json
// mappings/expression-velocity.json
"input": {
  "device": "KeyLab Essential",
  "channel": 1,
  "type": "cc",
  "number": 11  // Expression pedal input
}
```

### Adding New Mappings

1. **Create mapping file** in `mappings/`:
   ```bash
   touch mappings/sustain-pedal.json
   ```

2. **Define mapping**:
   ```json
   {
     "id": "sustain-snare-velocity",
     "name": "Sustain → Snare Velocity",
     "enabled": true,
     "input": {
       "device": "any",
       "channel": 1,
       "type": "cc",
       "number": 64
     },
     "target": {
       "type": "parameter",
       "patternId": "snare",
       "parameter": "euclidean.velocity"
     },
     "transform": {
       "inputMin": 0,
       "inputMax": 127,
       "outputMin": 60,
       "outputMax": 127,
       "curve": "linear"
     }
   }
   ```

3. **Hot-reload**: Save file, engine detects and applies within 50ms

### Creating Custom Macros

1. **Create macro file** in `macros/`:
   ```bash
   touch macros/hats-automation.json
   ```

2. **Define targets**:
   ```json
   {
     "id": "hats-automation",
     "name": "Hats Variation",
     "defaultValue": 0.5,
     "targets": [
       {
         "patternId": "hats",
         "parameter": "euclidean.pulses",
         "scaling": { "min": 4, "max": 12 }
       },
       {
         "patternId": "hats",
         "parameter": "euclidean.rotation",
         "scaling": { "min": 0, "max": 8 }
       }
     ]
   }
   ```

3. **Map to controller**:
   ```json
   // mappings/knob-hats.json
   {
     "id": "knob-hats",
     "input": { "type": "cc", "number": 75 },
     "target": { "type": "macro", "macro": "hats-automation" }
   }
   ```

## Troubleshooting

### No MIDI Input Detected

1. List available MIDI devices:
   ```bash
   node -e "const midi = require('@julusian/midi'); const input = new midi.Input(); for(let i=0; i<input.getPortCount(); i++) console.log(i, input.getPortName(i));"
   ```

2. Update mapping files with exact device name

### Scene Not Switching

- **Quantization**: Scenes switch at bar boundaries, wait for next bar
- **Check logs**: Engine prints scene change events
- **Verify pad notes**: Ensure your controller sends notes 36-38

### Parameters Not Responding

1. **Check macro range**: Ensure `scaling.min` and `scaling.max` are valid for parameter
2. **Verify pattern parameter paths**: e.g., `"euclidean.velocity"` not `"velocity"`
3. **Enable debug logging**: Set `LOG_LEVEL=debug` environment variable

### Smoothing Too Aggressive

- **Reduce smooth time**: Lower `smooth` value in transform (default 50ms → 10ms)
- **Disable smoothing**: Omit `smooth` field entirely for immediate response

## Technical Details

### Transformation Pipeline

```
MIDI Input → Dead Zone Filter → Curve Function → Output Scaling → Smoothing → Target Parameter
             (optional)         (linear/exp/log) (min/max)       (time-based)
```

### Quantization Behavior

- **Bar Quantization**: Scene switches occur at next bar start (measure boundary)
- **Beat Quantization**: Scene switches occur at next beat (quarter note boundary)
- **None**: Scene switches immediately

### Performance Characteristics

- **Mapping Latency**: <1 clock tick from CC receive to parameter update
- **Scene Switch Latency**: <5ms from quantization point to pattern activation
- **Smoothing Buffer**: Linear interpolation over specified time window
- **Hot-Reload**: Mapping changes apply within 50ms without transport interruption

## Next Steps

1. **Add More Patterns**: Create additional patterns in `patterns/`
2. **Design Custom Scenes**: Combine patterns in `scenes/` for your setlist
3. **Expand Macros**: Create macros for specific parameter combinations
4. **Map Your Controller**: Customize `mappings/` for your hardware layout
5. **Script Extensions**: Add custom pattern logic in `scripts/` (see User Story 5)

## References

- **User Story 3**: [Gestural MIDI Input Control](../../specs/001-midi-sequencer-engine/spec.md#user-story-3)
- **Data Model**: [Mapping Entity](../../specs/001-midi-sequencer-engine/data-model.md#5-mapping)
- **JSON Schemas**: `../../schemas/mapping.schema.json`, `../../schemas/macro.schema.json`, `../../schemas/scene.schema.json`
