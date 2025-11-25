import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  MappingEntityValidator,
  MappingEntityLoader,
  type MappingEntity
} from '../../src/config/entities/MappingEntity';

/**
 * T057: MappingEntity Tests (RED PHASE - MUST FAIL)
 *
 * Tests for MIDI input mapping validation and loading.
 * Maps MIDI input (CC, notes, pitch bend) to pattern parameters or macros.
 */

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genseq-mapping-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// MappingEntityValidator Tests - CC to Parameter
// ============================================================================

describe('MappingEntityValidator - CC Mappings', () => {
  describe('Valid CC to Parameter Mappings', () => {
    it('should validate minimal CC to parameter mapping', () => {
      const mapping: MappingEntity = {
        id: 'cc1-to-density',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      };

      const result = MappingEntityValidator.validate(mapping);

      expect(result.id).toBe('cc1-to-density');
      expect(result.source.type).toBe('cc');
      expect(result.source.controller).toBe(1);
      expect(result.target.patternId).toBe('kick');
      expect(result.transform.type).toBe('linear');
    });

    it('should validate CC mapping with device filtering', () => {
      const mapping: MappingEntity = {
        id: 'filtered-cc',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7,
          device: 'Launchpad Pro'
        },
        target: {
          type: 'parameter',
          patternId: 'hats',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [60, 127]
        }
      };

      const result = MappingEntityValidator.validate(mapping);
      expect(result.source.device).toBe('Launchpad Pro');
    });

    it('should validate CC mapping with smoothing', () => {
      const mapping: MappingEntity = {
        id: 'smoothed-cc',
        source: {
          type: 'cc',
          channel: 1,
          controller: 74
        },
        target: {
          type: 'parameter',
          patternId: 'bass',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0],
          smoothing: 30 // 30ms window
        }
      };

      const result = MappingEntityValidator.validate(mapping);
      expect(result.transform.smoothing).toBe(30);
    });

    it('should validate CC mapping with exponential curve', () => {
      const mapping: MappingEntity = {
        id: 'exp-curve',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0],
          curve: 2.0 // Exponential curve factor
        }
      };

      const result = MappingEntityValidator.validate(mapping);
      expect(result.transform.type).toBe('exponential');
      expect(result.transform.curve).toBe(2.0);
    });

    it('should validate CC mapping with dead zone', () => {
      const mapping: MappingEntity = {
        id: 'deadzone-cc',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0],
          deadZone: 5 // Ignore values 0-5
        }
      };

      const result = MappingEntityValidator.validate(mapping);
      expect(result.transform.deadZone).toBe(5);
    });
  });

  describe('Invalid CC Mappings', () => {
    it('should reject CC mapping without controller number', () => {
      const mapping = {
        id: 'invalid-cc',
        source: {
          type: 'cc',
          channel: 1
          // Missing controller
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      };

      expect(() => MappingEntityValidator.validate(mapping as any))
        .toThrow(/controller.*required/i);
    });

    it('should reject CC mapping with invalid controller range', () => {
      const mapping = {
        id: 'invalid-controller',
        source: {
          type: 'cc',
          channel: 1,
          controller: 128 // Out of range (0-127)
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      };

      expect(() => MappingEntityValidator.validate(mapping as any))
        .toThrow(/controller.*0.*127/i);
    });

    it('should reject CC mapping with invalid channel', () => {
      const mapping = {
        id: 'invalid-channel',
        source: {
          type: 'cc',
          channel: 17, // Out of range (1-16)
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      };

      expect(() => MappingEntityValidator.validate(mapping as any))
        .toThrow(/channel.*1.*16/i);
    });

    it('should reject mapping without target pattern', () => {
      const mapping = {
        id: 'no-target',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          // Missing patternId
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      };

      expect(() => MappingEntityValidator.validate(mapping as any))
        .toThrow(/patternId.*required/i);
    });

    it('should reject mapping without transform', () => {
      const mapping = {
        id: 'no-transform',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        }
        // Missing transform
      };

      expect(() => MappingEntityValidator.validate(mapping as any))
        .toThrow(/transform.*required/i);
    });

    it('should reject exponential transform without curve', () => {
      const mapping = {
        id: 'exp-no-curve',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
          // Missing curve
        }
      };

      expect(() => MappingEntityValidator.validate(mapping as any))
        .toThrow(/curve.*required.*exponential/i);
    });
  });
});

// ============================================================================
// MappingEntityValidator Tests - CC to Macro
// ============================================================================

describe('MappingEntityValidator - CC to Macro', () => {
  it('should validate CC to macro mapping', () => {
    const mapping: MappingEntity = {
      id: 'cc1-to-macro',
      source: {
        type: 'cc',
        channel: 1,
        controller: 1
      },
      target: {
        type: 'macro',
        macroId: 'density-all'
      },
      transform: {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
      }
    };

    const result = MappingEntityValidator.validate(mapping);
    expect(result.target.type).toBe('macro');
    expect(result.target.macroId).toBe('density-all');
  });

  it('should reject macro mapping without macroId', () => {
    const mapping = {
      id: 'no-macro-id',
      source: {
        type: 'cc',
        channel: 1,
        controller: 1
      },
      target: {
        type: 'macro'
        // Missing macroId
      },
      transform: {
        type: 'linear',
        inputRange: [0, 127],
        outputRange: [0.0, 1.0]
      }
    };

    expect(() => MappingEntityValidator.validate(mapping as any))
      .toThrow(/macroId.*required/i);
  });
});

// ============================================================================
// MappingEntityValidator Tests - Note to Scene Trigger
// ============================================================================

describe('MappingEntityValidator - Note to Scene', () => {
  it('should validate note to scene trigger mapping', () => {
    const mapping: MappingEntity = {
      id: 'pad36-to-main',
      source: {
        type: 'note',
        channel: 10,
        note: 36 // Kick drum pad
      },
      target: {
        type: 'scene',
        sceneId: 'main'
      },
      quantize: 'bar' // Trigger on next bar boundary
    };

    const result = MappingEntityValidator.validate(mapping);
    expect(result.source.type).toBe('note');
    expect(result.source.note).toBe(36);
    expect(result.target.type).toBe('scene');
    expect(result.target.sceneId).toBe('main');
    expect(result.quantize).toBe('bar');
  });

  it('should validate note trigger with beat quantization', () => {
    const mapping: MappingEntity = {
      id: 'pad37-to-breakdown',
      source: {
        type: 'note',
        channel: 10,
        note: 37
      },
      target: {
        type: 'scene',
        sceneId: 'breakdown'
      },
      quantize: 'beat'
    };

    const result = MappingEntityValidator.validate(mapping);
    expect(result.quantize).toBe('beat');
  });

  it('should validate note trigger without quantization (immediate)', () => {
    const mapping: MappingEntity = {
      id: 'pad38-immediate',
      source: {
        type: 'note',
        channel: 10,
        note: 38
      },
      target: {
        type: 'scene',
        sceneId: 'outro'
      }
      // No quantize = immediate trigger
    };

    const result = MappingEntityValidator.validate(mapping);
    expect(result.quantize).toBeUndefined();
  });

  it('should reject note mapping without note number', () => {
    const mapping = {
      id: 'no-note',
      source: {
        type: 'note',
        channel: 10
        // Missing note
      },
      target: {
        type: 'scene',
        sceneId: 'main'
      }
    };

    expect(() => MappingEntityValidator.validate(mapping as any))
      .toThrow(/note.*required/i);
  });

  it('should reject scene mapping without sceneId', () => {
    const mapping = {
      id: 'no-scene',
      source: {
        type: 'note',
        channel: 10,
        note: 36
      },
      target: {
        type: 'scene'
        // Missing sceneId
      }
    };

    expect(() => MappingEntityValidator.validate(mapping as any))
      .toThrow(/sceneId.*required/i);
  });

  it('should reject invalid quantize value', () => {
    const mapping = {
      id: 'invalid-quantize',
      source: {
        type: 'note',
        channel: 10,
        note: 36
      },
      target: {
        type: 'scene',
        sceneId: 'main'
      },
      quantize: 'invalid' // Not 'bar' or 'beat'
    };

    expect(() => MappingEntityValidator.validate(mapping as any))
      .toThrow(/quantize.*bar.*beat/i);
  });
});

// ============================================================================
// MappingEntityValidator Tests - Pitch Bend
// ============================================================================

describe('MappingEntityValidator - Pitch Bend', () => {
  it('should validate pitch bend to parameter mapping', () => {
    const mapping: MappingEntity = {
      id: 'pitchbend-to-note',
      source: {
        type: 'pitchbend',
        channel: 1
      },
      target: {
        type: 'parameter',
        patternId: 'bass',
        parameter: 'note'
      },
      transform: {
        type: 'linear',
        inputRange: [-8192, 8191], // Pitch bend range
        outputRange: [48, 72] // C3 to C5
      }
    };

    const result = MappingEntityValidator.validate(mapping);
    expect(result.source.type).toBe('pitchbend');
    expect(result.transform.inputRange).toEqual([-8192, 8191]);
  });

  it('should reject pitch bend with invalid input range', () => {
    const mapping = {
      id: 'bad-pitchbend',
      source: {
        type: 'pitchbend',
        channel: 1
      },
      target: {
        type: 'parameter',
        patternId: 'bass',
        parameter: 'note'
      },
      transform: {
        type: 'linear',
        inputRange: [0, 127], // Wrong range for pitch bend
        outputRange: [48, 72]
      }
    };

    expect(() => MappingEntityValidator.validate(mapping as any))
      .toThrow(/pitchbend.*-8192.*8191/i);
  });
});

// ============================================================================
// MappingEntityLoader Tests
// ============================================================================

describe('MappingEntityLoader', () => {
  it('should load mapping from JSON file', () => {
    const mappingPath = path.join(tempDir, 'cc1-density.json');
    const mappingData = {
      id: 'cc1-to-density',
      source: { type: 'cc', channel: 1, controller: 1 },
      target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
      transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
    };

    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));

    const result = MappingEntityLoader.load(mappingPath);
    expect(result.id).toBe('cc1-to-density');
    expect(result.source.type).toBe('cc');
  });

  it('should load mapping from YAML file', () => {
    const mappingPath = path.join(tempDir, 'pad36-scene.yaml');
    const mappingData = `
id: pad36-to-main
source:
  type: note
  channel: 10
  note: 36
target:
  type: scene
  sceneId: main
quantize: bar
`;

    fs.writeFileSync(mappingPath, mappingData);

    const result = MappingEntityLoader.load(mappingPath);
    expect(result.id).toBe('pad36-to-main');
    expect(result.quantize).toBe('bar');
  });

  it('should throw error for non-existent file', () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.json');

    expect(() => MappingEntityLoader.load(nonExistentPath))
      .toThrow(/not found|ENOENT/i);
  });

  it('should throw error for invalid JSON', () => {
    const mappingPath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(mappingPath, '{ invalid json }');

    expect(() => MappingEntityLoader.load(mappingPath))
      .toThrow(/JSON|parse/i);
  });

  it('should throw error for mapping that fails validation', () => {
    const mappingPath = path.join(tempDir, 'invalid-mapping.json');
    const invalidMapping = {
      id: 'invalid',
      source: { type: 'cc', channel: 1 }, // Missing controller
      target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
      transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
    };

    fs.writeFileSync(mappingPath, JSON.stringify(invalidMapping));

    expect(() => MappingEntityLoader.load(mappingPath))
      .toThrow(/controller.*required/i);
  });
});

// ============================================================================
// Circular Dependency Detection Tests (T067)
// ============================================================================

describe('MappingEntityValidator - Circular Dependencies', () => {
  it('should detect circular dependency: macro → parameter → same macro', () => {
    // This requires more complex validation at the config loader level
    // For now, test the entity structure that would cause this
    const mapping1: MappingEntity = {
      id: 'cc1-to-macro',
      source: { type: 'cc', channel: 1, controller: 1 },
      target: { type: 'macro', macroId: 'density-all' },
      transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
    };

    const mapping2: MappingEntity = {
      id: 'param-to-macro',
      source: { type: 'parameter', patternId: 'kick', parameter: 'density' },
      target: { type: 'macro', macroId: 'density-all' },
      transform: { type: 'linear', inputRange: [0.0, 1.0], outputRange: [0.0, 1.0] }
    };

    // Both mappings are individually valid
    expect(() => MappingEntityValidator.validate(mapping1)).not.toThrow();
    expect(() => MappingEntityValidator.validate(mapping2)).not.toThrow();

    // But together they create a circular dependency
    // This will be tested in ConfigLoader / SchemaValidator tests
  });
});
