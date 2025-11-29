# 003: Techno Pattern Generators - Data Model

## Entity Definitions

### TechnoKickBassPattern

Combined kick drum and bass line generator.

```typescript
interface TechnoKickBassConfig {
  // Common fields
  type: 'techno-kick-bass';
  enabled: boolean;
  length: 1 | 2 | 4;      // bars
  bus: string;

  // Kick configuration
  kick: {
    note: number;         // MIDI note (default: 36 = C1, standard kick)
    channel: number;      // 1-16
    velocity: number;     // 0-127 (default: 100)
    accentVelocity: number; // velocity on beat 1 (default: 127)
    enabled: boolean;
  };

  // Bass configuration
  bass: {
    notes: number[];      // 1-8 note sequence (default: [36])
    channel: number;      // 1-16
    velocity: number;     // 0-127 (default: 90)
    duration: number;     // beats (default: 0.25)
    syncopation: number;  // offset from kick in 16th notes (default: 1)
    octave: number;       // base octave (default: 2)
    enabled: boolean;
  };
}
```

**Validation Rules:**
- `kick.note`: 0-127
- `kick.channel`: 1-16
- `kick.velocity`: 0-127
- `bass.notes`: array of 1-8 MIDI notes, each 0-127
- `bass.syncopation`: 0-15 (16th notes)
- `bass.duration`: 0.0625-4.0 (1/64 to whole note)

**Defaults:**
```json
{
  "type": "techno-kick-bass",
  "enabled": true,
  "length": 1,
  "kick": {
    "note": 36,
    "channel": 10,
    "velocity": 100,
    "accentVelocity": 127,
    "enabled": true
  },
  "bass": {
    "notes": [36],
    "channel": 1,
    "velocity": 90,
    "duration": 0.25,
    "syncopation": 1,
    "octave": 2,
    "enabled": true
  }
}
```

---

### TechnoHiHatPattern

Multi-layer hi-hat pattern with closed, open, and ride.

```typescript
interface TechnoHiHatConfig {
  // Common fields
  type: 'techno-hihat';
  enabled: boolean;
  length: 1 | 2 | 4;
  bus: string;
  channel: number;        // 1-16 (default: 10 = drums)

  // Closed hi-hat
  closed: {
    note: number;         // MIDI note (default: 42)
    velocity: number;     // 0-127 (default: 80)
    density: number;      // 0-100% (default: 100)
    position: 'offbeat' | 'onbeat' | 'all-8th' | 'all-16th';
    enabled: boolean;
  };

  // Open hi-hat
  open: {
    note: number;         // MIDI note (default: 46)
    velocity: number;     // 0-127 (default: 90)
    pattern: number[];    // beat positions (1-indexed, e.g., [2, 4])
    enabled: boolean;
  };

  // Ride cymbal
  ride: {
    note: number;         // MIDI note (default: 51)
    velocity: number;     // 0-127 (default: 70)
    density: number;      // 0-100%
    enabled: boolean;
  };

  // Global modifiers
  swing: number;          // 0-100% (default: 0)
  ghostVelocity: number;  // velocity for ghost notes (default: 40)
  ghostProbability: number; // 0-100% chance of ghost (default: 0)
}
```

**Validation Rules:**
- All `note` fields: 0-127
- All `velocity` fields: 0-127
- `density`: 0-100
- `swing`: 0-100
- `open.pattern`: array of beat positions 1-16

**Defaults:**
```json
{
  "type": "techno-hihat",
  "enabled": true,
  "length": 1,
  "channel": 10,
  "closed": {
    "note": 42,
    "velocity": 80,
    "density": 100,
    "position": "offbeat",
    "enabled": true
  },
  "open": {
    "note": 46,
    "velocity": 90,
    "pattern": [],
    "enabled": false
  },
  "ride": {
    "note": 51,
    "velocity": 70,
    "density": 0,
    "enabled": false
  },
  "swing": 0,
  "ghostVelocity": 40,
  "ghostProbability": 0
}
```

---

### TechnoChordPattern

Sparse syncopated chord stab generator.

```typescript
interface TechnoChordConfig {
  // Common fields
  type: 'techno-chord';
  enabled: boolean;
  length: 1 | 2 | 4;
  bus: string;
  channel: number;

  // Chord voicing
  voicing: {
    notes: number;        // 2-4 notes per chord (default: 3)
    root: number;         // root note MIDI (default: 60 = C4)
    scale: string;        // scale name (default: 'minor')
    inversion: 0 | 1 | 2; // chord inversion (default: 0)
    spread: number;       // semitones between notes (default: 4)
  };

  // Rhythm
  rhythm: {
    positions: number[];  // 16th note positions within pattern (1-indexed)
    syncopation: number;  // offset from downbeat in ticks (default: 0)
    density: number;      // 0-100% probability each position triggers
  };

  // Expression
  velocity: number;       // 0-127 (default: 100)
  duration: number;       // beats (default: 0.5)
  velocityCurve: 'flat' | 'decay' | 'accent-first';
}
```

**Validation Rules:**
- `voicing.notes`: 1-4
- `voicing.root`: 0-127
- `voicing.scale`: one of built-in scales
- `voicing.spread`: 1-12 semitones
- `rhythm.positions`: array of 1-64 positions
- `rhythm.density`: 0-100

**Defaults:**
```json
{
  "type": "techno-chord",
  "enabled": true,
  "length": 4,
  "channel": 2,
  "voicing": {
    "notes": 3,
    "root": 60,
    "scale": "minor",
    "inversion": 0,
    "spread": 4
  },
  "rhythm": {
    "positions": [3, 11, 27],
    "syncopation": 0,
    "density": 100
  },
  "velocity": 100,
  "duration": 0.5,
  "velocityCurve": "flat"
}
```

---

### TechnoLeadPattern

Looping melodic phrase generator.

```typescript
interface TechnoLeadConfig {
  // Common fields
  type: 'techno-lead';
  enabled: boolean;
  length: 1 | 2 | 4;
  bus: string;
  channel: number;

  // Phrase definition
  phrase: {
    notes: number[];      // fixed note sequence OR
    length: number;       // 5-8 notes to generate (constrained per spec)
    scale: string;        // scale for quantization
    root: number;         // root note MIDI
    octaveRange: number;  // 1-2 octaves (default: 1)
    mode: 'fixed' | 'generative';
  };

  // Rhythm
  rhythm: {
    division: number;     // note division (8 = 8th, 16 = 16th)
    restProbability: number; // 0-100% chance of rest
    durationVariation: number; // 0-100% variation in note length
  };

  // Expression
  velocity: number;       // base velocity 0-127
  velocityContour: 'flat' | 'accent-first' | 'accent-last' | 'random';
  legato: boolean;        // overlap notes slightly

  // Regeneration
  regenerateOn: 'never' | 'cycle' | 'trigger';
}
```

**Validation Rules:**
- `phrase.notes`: if provided, array of 5-8 MIDI notes
- `phrase.length`: 5-8 (per spec AC4.1)
- `phrase.octaveRange`: 1-3
- `rhythm.division`: 4, 8, 16, or 32
- `rhythm.restProbability`: 0-100

**Defaults:**
```json
{
  "type": "techno-lead",
  "enabled": true,
  "length": 1,
  "channel": 3,
  "phrase": {
    "notes": [],
    "length": 6,
    "scale": "minor",
    "root": 60,
    "octaveRange": 1,
    "mode": "generative"
  },
  "rhythm": {
    "division": 16,
    "restProbability": 15,
    "durationVariation": 20
  },
  "velocity": 90,
  "velocityContour": "accent-first",
  "legato": false,
  "regenerateOn": "cycle"
}
```

---

## JSON Schemas

Schemas will be created at:
- `schemas/techno-kick-bass.schema.json`
- `schemas/techno-hihat.schema.json`
- `schemas/techno-chord.schema.json`
- `schemas/techno-lead.schema.json`

Each schema validates the corresponding config interface and provides:
- Required field enforcement
- Type validation
- Range validation
- Default value definitions
- Error messages with field paths

---

## Entity Relationships

```
TechnoPatternConfig (union type)
├── TechnoKickBassConfig
├── TechnoHiHatConfig
├── TechnoChordConfig
└── TechnoLeadConfig

All inherit from base Pattern interface:
- type: string
- enabled: boolean
- length: number
- bus: string

Integration points:
- PatternRegistry.register(type, factory)
- PatternFactory.create(config) → Pattern instance
- GenSeqEngine routes MidiEvent[] to buses
```

---

## Migration Notes

No migration required - these are new pattern types added to existing system.

New patterns register alongside existing types:
- euclidean (existing)
- probability (existing)
- phase (existing)
- techno-kick-bass (new)
- techno-hihat (new)
- techno-chord (new)
- techno-lead (new)
