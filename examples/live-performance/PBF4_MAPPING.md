# Intech Studio PBF4 Controller Mapping

This document describes how the live-performance example maps to the Intech Studio PBF4 controller.

## Controller Layout

The PBF4 has 4 channel strips, each with:
- **Knob** (potentiometer) → CC 1
- **Fader** → CC 2
- **Button** → CC 3

```
Channel 1          Channel 2          Channel 3          Channel 4
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│   [Knob]   │     │   [Knob]   │     │   [Knob]   │     │   [Knob]   │
│    CC 1    │     │    CC 1    │     │    CC 1    │     │    CC 1    │
├────────────┤     ├────────────┤     ├────────────┤     ├────────────┤
│  [Fader]   │     │  [Fader]   │     │  [Fader]   │     │  [Fader]   │
│    CC 2    │     │    CC 2    │     │    CC 2    │     │    CC 2    │
├────────────┤     ├────────────┤     ├────────────┤     ├────────────┤
│  [Button]  │     │  [Button]  │     │  [Button]  │     │  [Button]  │
│    CC 3    │     │    CC 3    │     │    CC 3    │     │    CC 3    │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
```

## Mapping Assignment

| Control | Ch 1 (Global) | Ch 2 (Kick) | Ch 3 | Ch 4 |
|---------|---------------|-------------|------|------|
| **Knob** | Master Density | Kick Rotation | — | — |
| **Fader** | Master Velocity | — | — | — |
| **Button** | Intro Scene | Main Scene | Breakdown Scene | — |

## Detailed Mappings

### Channel 1 - Global Controls

| Control | Target | Curve | File |
|---------|--------|-------|------|
| Knob (CC1) | `master-density` macro | Linear, 50ms smooth | `mod-wheel-density.json` |
| Fader (CC2) | `master-velocity` macro | Logarithmic, 30ms smooth | `expression-velocity.json` |
| Button (CC3) | `intro` scene | Quantized to bar | `scene-pads.json` |

### Channel 2 - Kick Pattern

| Control | Target | Curve | File |
|---------|--------|-------|------|
| Knob (CC1) | `kick` pattern rotation (0-16) | Exponential, 20ms smooth | `filter-knob.json` |
| Fader (CC2) | — | — | — |
| Button (CC3) | `main` scene | Quantized to bar | `scene-pads-main.json` |

### Channel 3 - Scene Trigger

| Control | Target | Curve | File |
|---------|--------|-------|------|
| Knob (CC1) | — | — | — |
| Fader (CC2) | — | — | — |
| Button (CC3) | `breakdown` scene | Quantized to bar | `scene-pads-breakdown.json` |

### Channel 4 - Available

All controls on Channel 4 are currently unmapped and available for expansion.

## Performance Workflow

1. **Start**: Press Ch1 Button → Intro scene
2. **Build**: Use Ch1 Knob to increase density, Ch1 Fader for velocity dynamics
3. **Drop**: Press Ch2 Button → Main scene, use Ch2 Knob to vary kick rotation
4. **Breakdown**: Press Ch3 Button → Breakdown scene
5. **Return**: Press Ch2 Button → Back to Main

## Expansion Ideas

Available controls for future mappings:

- **Ch2 Fader**: Kick velocity or probability
- **Ch3 Knob**: Hi-hat density or pattern length
- **Ch3 Fader**: Snare probability
- **Ch4 Knob**: Bass note range
- **Ch4 Fader**: Bass velocity
- **Ch4 Button**: Mute/unmute bass or trigger fill
