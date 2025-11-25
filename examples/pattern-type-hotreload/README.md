# Pattern Type Hot-Reload Demo

## Purpose

This example demonstrates **live pattern type changes** during playback. The GenSeq engine supports swapping pattern types (euclidean, probability, phase) at bar boundaries without stopping the transport.

## Setup

1. Ensure MIDI loopback is available:
   - **macOS**: IAC Driver Bus 1 (Audio MIDI Setup > MIDI Studio)
   - **Linux**: Use `aconnect` to create virtual MIDI ports
   - **Windows**: Use loopMIDI or similar virtual MIDI driver

2. Start the engine:
   ```bash
   cd /Users/jaredmcfarland/Developer/genseq/examples/pattern-type-hotreload
   genseq start .
   ```

3. Monitor MIDI output with a DAW, synth, or MIDI monitor application.

## How to Test Pattern Type Changes

While the engine is running, edit `patterns/demo.json` to change the pattern type. The engine will:
1. Detect the file change within 50ms
2. Validate the new configuration against JSON schema
3. Queue the type change for the next bar boundary
4. Swap pattern types atomically (no dropped notes)

## Pattern Type Examples

### Euclidean Rhythm (Default)

Generates rhythmic patterns using the Bjorklund algorithm. Creates evenly-distributed pulses.

```json
{
  "id": "demo",
  "type": "euclidean",
  "bus": "main",
  "enabled": true,
  "euclidean": {
    "steps": 16,
    "pulses": 5,
    "rotation": 0,
    "note": 60,
    "velocity": 100,
    "duration": 0.25
  }
}
```

**Parameters:**
- `steps`: Total steps in pattern (1-64)
- `pulses`: Number of active pulses (0-64, must be ≤ steps)
- `rotation`: Rotate pattern by N steps (0-steps)
- `note`: MIDI note number (0-127, default: 60)
- `velocity`: MIDI velocity (1-127, default: 100)
- `duration`: Note duration in beats (0.01-16, default: 0.25)

**Try these variations:**
- `[16, 4]` - Four-on-the-floor kick
- `[16, 5]` - Classic 5-against-16 rhythm
- `[8, 3]` - Tresillo pattern
- `[12, 7]` - Dense polyrhythm

---

### Probability Pattern

Generates random triggers based on probability per step. Each step has an independent chance to fire.

```json
{
  "id": "demo",
  "type": "probability",
  "bus": "main",
  "enabled": true,
  "probability": {
    "steps": 16,
    "probability": 0.5,
    "note": 64,
    "velocity": 90
  }
}
```

**Parameters:**
- `steps`: Total steps in pattern (1-64)
- `probability`: Trigger probability per step (0.0-1.0, 0 = never, 1 = always)
- `note`: MIDI note number (0-127)
- `velocity`: MIDI velocity (1-127)

**Try these variations:**
- `probability: 0.25` - Sparse, sparse hi-hats
- `probability: 0.5` - 50/50 trigger chance
- `probability: 0.75` - Dense rhythm with occasional gaps
- `probability: 1.0` - Trigger every step (equivalent to euclidean [steps, steps])

---

### Phase Pattern

Generates phase-offset patterns for polyrhythmic effects. Creates cycling phase relationships.

```json
{
  "id": "demo",
  "type": "phase",
  "bus": "main",
  "enabled": true,
  "phase": {
    "length": 16,
    "offset": 0.25
  }
}
```

**Parameters:**
- `length`: Pattern cycle length in steps (1-128)
- `offset`: Phase offset (0.0-1.0, represents position in cycle)

**Try these variations:**
- `offset: 0.0` - Start at phase zero (downbeat)
- `offset: 0.25` - Quarter cycle offset
- `offset: 0.5` - Half cycle offset (inverted phase)
- `offset: 0.75` - Three-quarter offset

---

## Common Pattern Type Transitions

### Euclidean → Probability

**Use case**: Transition from structured rhythm to randomized variation.

1. Start with euclidean `[16, 4]` (four-on-the-floor)
2. Change to `probability: 0.5` (50% trigger chance)
3. Result: Random kick hits, retains 16-step structure

**Edit `patterns/demo.json`:**
```json
{
  "id": "demo",
  "type": "probability",
  "bus": "main",
  "enabled": true,
  "probability": {
    "steps": 16,
    "probability": 0.5,
    "note": 60,
    "velocity": 100
  }
}
```

---

### Euclidean → Phase

**Use case**: Shift from rhythmic groove to phase-based polyrhythm.

1. Start with euclidean `[16, 5]`
2. Change to `phase: {length: 16, offset: 0.33}`
3. Result: Phase-shifted pattern for polyrhythmic texture

**Edit `patterns/demo.json`:**
```json
{
  "id": "demo",
  "type": "phase",
  "bus": "main",
  "enabled": true,
  "phase": {
    "length": 16,
    "offset": 0.33
  }
}
```

---

### Probability → Euclidean

**Use case**: Lock random pattern into structured euclidean rhythm.

1. Start with `probability: 0.4`
2. Change to euclidean `[16, 6]`
3. Result: Random hits become deterministic euclidean pattern

---

### Probability → Phase

**Use case**: Replace randomness with phase-based modulation.

1. Start with `probability: 0.6`
2. Change to `phase: {length: 12, offset: 0.5}`
3. Result: Deterministic phase pattern replaces probability

---

### Phase → Euclidean

**Use case**: Replace phase modulation with euclidean groove.

1. Start with `phase: {length: 16, offset: 0.25}`
2. Change to euclidean `[16, 7]`
3. Result: Phase pattern becomes rhythmic euclidean

---

### Phase → Probability

**Use case**: Shift from deterministic phase to random triggers.

1. Start with `phase: {length: 16, offset: 0.5}`
2. Change to `probability: 0.45`
3. Result: Structured phase becomes randomized

---

## Expected Behavior

**During Type Swap:**
- Engine detects file change within **<50ms**
- Schema validation confirms new type is valid
- Type change queued for **next bar boundary**
- Current bar completes with old pattern type
- New bar starts with new pattern type
- **No MIDI interruption** (note-offs sent correctly)
- Transport continues without restart

**Validation Failures:**
- Invalid JSON → Change rejected, engine continues with last valid config
- Schema violation → Error logged, previous config retained
- Missing required fields → Change rejected with error

**Performance Guarantees:**
- Hot-reload latency: <50ms file detection
- Type swap latency: Aligned to bar boundaries (no dropped events)
- MIDI output: <5ms latency maintained across type changes

---

## Troubleshooting

**No MIDI output after type change:**
- Check that `bus: "main"` matches route in `routes/main.json`
- Verify IAC Driver Bus 1 is enabled in Audio MIDI Setup
- Confirm pattern `enabled: true`

**Type change ignored:**
- Check console for validation errors
- Ensure JSON is valid (use JSON linter)
- Verify all required fields for new pattern type are present

**Timing issues after swap:**
- Type changes occur at bar boundaries (expected behavior)
- If timing drifts, check CPU usage (<25% single core required)
- Verify clock jitter is <1ms (see performance monitoring)

---

## Next Steps

- **Multiple patterns**: Add `patterns/demo2.json` to test concurrent type changes
- **Complex transitions**: Chain multiple type swaps (euclidean → probability → phase)
- **Performance testing**: Swap types rapidly to test validation and queueing
- **Custom scripts**: Add `type: "script"` patterns for JavaScript-based generation

For more examples, see:
- `/examples/hot-reload-demo/` - BPM and route hot-reload
- `/examples/basic-euclidean/` - Simple euclidean patterns
- `/examples/custom-scripts/` - JavaScript pattern generation
