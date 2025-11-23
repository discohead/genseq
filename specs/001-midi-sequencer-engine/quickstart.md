# GenSeq Quickstart Guide

Get up and running with GenSeq MIDI Sequencer in 5 minutes!

## Prerequisites

- **Node.js 18+** installed ([download](https://nodejs.org/))
- **VS Code** installed ([download](https://code.visualstudio.com/))
- **MIDI hardware or virtual MIDI** device connected
- **Git** (optional, for version control)

## Installation

### 1. Install GenSeq globally

```bash
npm install -g genseq-cli
```

### 2. Install VS Code Extension

1. Open VS Code
2. Go to Extensions (⌘⇧X / Ctrl+Shift+X)
3. Search for "GenSeq"
4. Click Install

## Create Your First Project

### 1. Initialize a new project

```bash
# Create and initialize project directory
genseq init my-first-project
cd my-first-project
```

This creates the following structure:
```
my-first-project/
├── project.yaml       # Project configuration
├── clock.yaml         # Timing settings
├── patterns/          # Pattern definitions
│   └── kick.json     # Example kick pattern
├── routes/           # MIDI routing
│   └── default.json  # Default routing config
├── scenes/           # Scene presets
│   └── main.json     # Main scene
└── mappings/         # MIDI input mappings
```

### 2. Open in VS Code

```bash
code .
```

The GenSeq extension automatically activates when it detects a GenSeq project.

## Your First Pattern

### 1. Create a simple Euclidean rhythm

Create `patterns/hats.json`:

```json
{
  "id": "hats",
  "name": "Hi-Hats",
  "type": "euclidean",
  "enabled": true,
  "length": 1,
  "division": 16,
  "bus": "drums",
  "note": 42,
  "parameters": {
    "steps": 16,
    "pulses": 8,
    "rotation": 0,
    "velocity": 80,
    "gateLength": 10
  }
}
```

### 2. Configure MIDI routing

Edit `routes/default.json`:

```json
{
  "routes": [
    {
      "id": "drums-out",
      "bus": "drums",
      "device": "YOUR_MIDI_DEVICE_NAME",
      "channel": 10
    }
  ]
}
```

Replace `YOUR_MIDI_DEVICE_NAME` with your actual MIDI device. To see available devices:

```bash
genseq devices
```

### 3. Add pattern to scene

Edit `scenes/main.json`:

```json
{
  "id": "main",
  "name": "Main Scene",
  "activePatterns": ["kick", "hats"],
  "patternOverrides": {},
  "macros": {}
}
```

## Start the Engine

### In VS Code

1. Open Command Palette (⌘⇧P / Ctrl+Shift+P)
2. Type "GenSeq: Start Engine"
3. Press Enter

Status bar shows: `▶ Playing | 120 BPM | Scene: main`

### From Terminal

```bash
genseq start .
```

You should now hear your patterns playing through your MIDI device!

## Live Editing

### Change pattern parameters

1. Open `patterns/hats.json`
2. Change `"rotation": 0` to `"rotation": 2`
3. Save the file (⌘S / Ctrl+S)

The pattern updates immediately without stopping playback!

### Adjust tempo

Edit `clock.yaml`:

```yaml
bpm: 130  # Changed from 120
ppq: 960
swing: 0
```

Save to hear the tempo change instantly.

## MIDI Input Control

### Map a MIDI controller

Create `mappings/controller.json`:

```json
{
  "id": "controller",
  "mappings": [
    {
      "id": "density-control",
      "name": "Hat Density",
      "enabled": true,
      "input": {
        "device": "YOUR_CONTROLLER_NAME",
        "channel": 1,
        "type": "cc",
        "number": 1
      },
      "target": {
        "type": "parameter",
        "patternId": "hats",
        "parameter": "pulses"
      },
      "transform": {
        "inputMin": 0,
        "inputMax": 127,
        "outputMin": 0,
        "outputMax": 16,
        "curve": "linear"
      }
    }
  ]
}
```

Now moving CC1 on your controller changes the hi-hat pattern density in real-time!

## Scene Management

### Create an intro scene

Create `scenes/intro.json`:

```json
{
  "id": "intro",
  "name": "Intro",
  "activePatterns": ["kick"],
  "patternOverrides": {
    "kick": {
      "velocity": 60
    }
  }
}
```

### Switch scenes

**In VS Code:**
1. Command Palette → "GenSeq: Load Scene"
2. Select "intro"

**From Terminal:**
```bash
genseq scene intro
```

## Custom Patterns

### Create a probability-based pattern

Create `patterns/snare.json`:

```json
{
  "id": "snare",
  "type": "probability",
  "enabled": true,
  "length": 1,
  "division": 8,
  "bus": "drums",
  "note": 38,
  "parameters": {
    "probability": 30,
    "density": 0.8,
    "velocity": [60, 80, 100],
    "gateLength": 15
  }
}
```

### Use a custom script

Create `scripts/phaser.js`:

```javascript
exports.create = (context, params) => {
  let phase = 0;

  return {
    tick: (context) => {
      phase += params.rate || 1;
      const trigger = (phase % params.cycle) < params.width;

      if (trigger) {
        return [{
          tick: context.position.tick,
          type: 'noteOn',
          note: params.note || 60,
          velocity: params.velocity || 100
        }];
      }

      return [];
    }
  };
};
```

Reference it in `patterns/phaser.json`:

```json
{
  "id": "phaser",
  "type": "script",
  "scriptPath": "scripts/phaser.js",
  "scriptParams": {
    "rate": 1.5,
    "cycle": 32,
    "width": 4,
    "note": 48,
    "velocity": 90
  }
}
```

## VS Code Features

### Tree Views

- **Pattern Explorer**: View and toggle patterns
- **Scene Manager**: Switch between scenes
- **Device Monitor**: See connected MIDI devices
- **Mapping Editor**: Configure MIDI mappings

Access via Activity Bar → GenSeq icon

### Visualizations

1. Command Palette → "GenSeq: Show Pattern Visualizer"
2. See patterns animated in real-time
3. Phase relationships and polyrhythms visible

### Diagnostics

- **Red squiggles** appear on JSON/YAML errors
- **Hover** over errors for descriptions
- **Quick fixes** available for common issues

## Performance Testing

Verify your system meets performance requirements:

```bash
genseq test .
```

Output:
```
✓ Clock jitter: 0.3ms (< 1ms)
✓ MIDI latency: 2.1ms (< 5ms)
✓ Hot-reload: 18ms (< 50ms)
✓ Memory usage: 42MB (< 200MB)
✓ CPU usage: 8% (< 25%)

All performance tests passed!
```

## Tips & Tricks

### 1. Use Git branches for different sets
```bash
git checkout -b live-set-1
# Modify patterns and scenes
git commit -am "Live set for tonight's show"
```

### 2. Keyboard shortcuts in VS Code
- `⌘K ⌘P` / `Ctrl+K Ctrl+P`: Toggle pattern on/off
- `⌘K ⌘S` / `Ctrl+K Ctrl+S`: Switch scene
- `⌘K ⌘M` / `Ctrl+K Ctrl+M`: Show MIDI monitor

### 3. Debug timing issues
```bash
genseq start . --verbose --timing
```

### 4. Run headless for installations
```bash
genseq daemon . --log-file genseq.log
```

### 5. Quick pattern mute/unmute
Double-click patterns in the Pattern Explorer to toggle them.

## Common Issues

### No sound output
1. Check MIDI device is connected: `genseq devices`
2. Verify routing in `routes/default.json`
3. Ensure MIDI channel matches your device

### Timing feels off
1. Close other CPU-intensive applications
2. Increase process priority (if on Linux/Mac)
3. Check performance: `genseq benchmark .`

### Hot-reload not working
1. Check file watcher limits on Linux
2. Ensure no syntax errors in files
3. Look for errors in Output → GenSeq

## Next Steps

- Explore [example projects](https://github.com/genseq/examples)
- Read the [Pattern Library Guide](patterns-guide.md)
- Learn about [Advanced Mappings](mappings-guide.md)
- Join our [Discord community](https://discord.gg/genseq)

## Quick Reference

### CLI Commands
```bash
genseq init <project>     # Create new project
genseq start <project>    # Start engine
genseq stop              # Stop engine
genseq scene <id>        # Load scene
genseq devices           # List MIDI devices
genseq test <project>    # Test performance
```

### File Types
- `.yaml` / `.json` - Configuration files
- `.js` - Script modules
- `patterns/*.json` - Pattern definitions
- `scenes/*.json` - Scene presets
- `mappings/*.json` - MIDI mappings
- `routes/*.json` - Bus routing

### Performance Targets
- Clock jitter: < 1ms
- MIDI latency: < 5ms
- Hot-reload: < 50ms
- Memory: < 200MB (100 patterns)
- CPU: < 25% (50 patterns @ 120 BPM)

Happy sequencing! 🎵