# Techno Pattern Generators Example

This example demonstrates all 4 techno pattern generators with full Intech Studio PBF4 controller integration.

## Pattern Generators

| Pattern | Description | MIDI Channel |
|---------|-------------|--------------|
| **kick-bass** | 4-on-the-floor kick with syncopated bass line | Kick: 10, Bass: 1 |
| **hihat** | Multi-layer hi-hat with swing and ghost notes | 10 |
| **chord** | Sparse syncopated chord stabs with scale quantization | 2 |
| **lead** | Looping melodic phrases with velocity contours | 3 |

## Running the Example

```bash
# From the genseq root directory
node examples/techno-patterns/start.mjs

# With debug logging
DEBUG=true node examples/techno-patterns/start.mjs
```

## Controller Mapping (Intech Studio PBF4 "Grid")

```
Channel 1          Channel 2          Channel 3          Channel 4
GLOBAL             KICK/BASS          HI-HAT             MELODIC
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│   [Knob]   │     │   [Knob]   │     │   [Knob]   │     │   [Knob]   │
│  Density   │     │ Syncopation│     │   Swing    │     │Chord Dens. │
├────────────┤     ├────────────┤     ├────────────┤     ├────────────┤
│  [Fader]   │     │  [Fader]   │     │  [Fader]   │     │  [Fader]   │
│  Velocity  │     │ Kick Vel.  │     │Ghost Prob. │     │ Lead Vel.  │
├────────────┤     ├────────────┤     ├────────────┤     ├────────────┤
│  [Button]  │     │  [Button]  │     │  [Button]  │     │  [Button]  │
│   Intro    │     │    Main    │     │ Breakdown  │     │ Regenerate │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
```

### Detailed Mapping

| Control | Channel | CC | Target | Range |
|---------|---------|-----|--------|-------|
| **Ch1 Knob** | 1 | 1 | Master Density macro | 0-100% |
| **Ch1 Fader** | 1 | 2 | Master Velocity macro | 40-127 |
| **Ch1 Button** | 1 | 3 | Intro Scene | trigger |
| **Ch2 Knob** | 2 | 1 | Bass syncopation | 0-15 steps |
| **Ch2 Fader** | 2 | 2 | Kick velocity | 60-127 |
| **Ch2 Button** | 2 | 3 | Main Scene | trigger |
| **Ch3 Knob** | 3 | 1 | Hi-hat swing | 0-50% |
| **Ch3 Fader** | 3 | 2 | Ghost probability | 0-100% |
| **Ch3 Button** | 3 | 3 | Breakdown Scene | trigger |
| **Ch4 Knob** | 4 | 1 | Chord density | 0-100% |
| **Ch4 Fader** | 4 | 2 | Lead velocity | 50-127 |
| **Ch4 Button** | 4 | 3 | Regenerate lead | trigger |

## Scenes

| Scene | Description | Active Patterns |
|-------|-------------|-----------------|
| **intro** | Minimal - kick only | kick-bass |
| **main** | Full groove | kick-bass, hihat, chord, lead |
| **breakdown** | Atmospheric | hihat, chord, lead |
| **regenerate-lead** | Triggers new phrase | (no change) |

## Performance Workflow

1. **Start**: Press Ch1 Button → Intro scene (minimal kick)
2. **Build**: Gradually increase Ch1 Knob (density) and Ch1 Fader (velocity)
3. **Drop**: Press Ch2 Button → Main scene (full groove)
4. **Vary**:
   - Ch2 Knob: Shift bass syncopation
   - Ch3 Knob: Add swing to hi-hats
   - Ch3 Fader: Increase ghost notes
5. **Breakdown**: Press Ch3 Button → Breakdown scene (no kick)
6. **Refresh**: Press Ch4 Button → Regenerate lead phrase
7. **Return**: Press Ch2 Button → Back to Main

## Macros

### master-density
Controls overall pattern activity:
- Hi-hat ghost probability (0-50%)
- Chord density (30-100%)
- Lead rest probability (50-0%, inverted)

### master-velocity
Controls overall dynamics:
- Kick velocity (60-127)
- Bass velocity (50-110)
- Hi-hat velocity (40-100)
- Chord velocity (50-110)
- Lead velocity (60-120)

## Directory Structure

```
techno-patterns/
├── genseq.config.json    # Project configuration
├── clock.yaml            # Clock settings (128 BPM)
├── start.mjs             # Start script
├── patterns/
│   ├── kick-bass.json    # Kick + bass pattern
│   ├── hihat.json        # Hi-hat pattern
│   ├── chord.json        # Chord stab pattern
│   └── lead.json         # Lead melody pattern
├── routes/
│   ├── drums.json        # Drums bus → IAC Driver
│   └── synths.json       # Synths bus → IAC Driver
├── mappings/
│   ├── ch1-*.json        # Channel 1 mappings
│   ├── ch2-*.json        # Channel 2 mappings
│   ├── ch3-*.json        # Channel 3 mappings
│   └── ch4-*.json        # Channel 4 mappings
├── macros/
│   ├── master-density.json
│   └── master-velocity.json
└── scenes/
    ├── intro.json
    ├── main.json
    ├── breakdown.json
    └── regenerate-lead.json
```

## MIDI Output

Default output is to `IAC Driver Bus 1`. Change the `device` field in route files to target different MIDI devices.

| Bus | Channels | Instruments |
|-----|----------|-------------|
| drums | 10, 1 | Kick (36), Hi-hat (42, 46, 51), Bass |
| synths | 2, 3 | Chords, Lead |
