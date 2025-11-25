import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  MacroEntityValidator,
  MacroEntityLoader,
  type MacroEntity
} from '../../src/config/entities/MacroEntity';

/**
 * T058: MacroEntity Tests (RED PHASE - MUST FAIL)
 *
 * Tests for Macro entity validation and loading.
 * Macros enable one-to-many control: single input controls multiple pattern parameters.
 */

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genseq-macro-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// MacroEntityValidator Tests - Basic Macros
// ============================================================================

describe('MacroEntityValidator - Basic Macros', () => {
  describe('Valid Macro Configurations', () => {
    it('should validate minimal macro with single target', () => {
      const macro: MacroEntity = {
        id: 'density-all',
        targets: [
          {
            patternId: 'kick',
            parameter: 'density'
          }
        ]
      };

      const result = MacroEntityValidator.validate(macro);

      expect(result.id).toBe('density-all');
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0].patternId).toBe('kick');
      expect(result.targets[0].parameter).toBe('density');
    });

    it('should validate macro with multiple targets', () => {
      const macro: MacroEntity = {
        id: 'velocity-all',
        targets: [
          { patternId: 'kick', parameter: 'velocity' },
          { patternId: 'hats', parameter: 'velocity' },
          { patternId: 'snare', parameter: 'velocity' }
        ]
      };

      const result = MacroEntityValidator.validate(macro);
      expect(result.targets).toHaveLength(3);
      expect(result.targets.map(t => t.patternId)).toEqual(['kick', 'hats', 'snare']);
    });

    it('should validate macro with scaling per target', () => {
      const macro: MacroEntity = {
        id: 'density-scaled',
        targets: [
          {
            patternId: 'kick',
            parameter: 'density',
            scale: 1.0 // Full scaling
          },
          {
            patternId: 'hats',
            parameter: 'density',
            scale: 0.5 // Half scaling
          },
          {
            patternId: 'snare',
            parameter: 'density',
            scale: 0.25 // Quarter scaling
          }
        ]
      };

      const result = MacroEntityValidator.validate(macro);
      expect(result.targets[0].scale).toBe(1.0);
      expect(result.targets[1].scale).toBe(0.5);
      expect(result.targets[2].scale).toBe(0.25);
    });

    it('should provide default scale of 1.0 when not specified', () => {
      const macro: MacroEntity = {
        id: 'no-scale',
        targets: [
          { patternId: 'kick', parameter: 'density' }
        ]
      };

      const result = MacroEntityValidator.validate(macro);
      expect(result.targets[0].scale).toBe(1.0);
    });

    it('should validate macro with offset per target', () => {
      const macro: MacroEntity = {
        id: 'velocity-offset',
        targets: [
          {
            patternId: 'kick',
            parameter: 'velocity',
            offset: 0 // No offset
          },
          {
            patternId: 'hats',
            parameter: 'velocity',
            offset: -10 // 10 lower than input
          },
          {
            patternId: 'snare',
            parameter: 'velocity',
            offset: 10 // 10 higher than input
          }
        ]
      };

      const result = MacroEntityValidator.validate(macro);
      expect(result.targets[0].offset).toBe(0);
      expect(result.targets[1].offset).toBe(-10);
      expect(result.targets[2].offset).toBe(10);
    });

    it('should provide default offset of 0 when not specified', () => {
      const macro: MacroEntity = {
        id: 'no-offset',
        targets: [
          { patternId: 'kick', parameter: 'velocity' }
        ]
      };

      const result = MacroEntityValidator.validate(macro);
      expect(result.targets[0].offset).toBe(0);
    });

    it('should validate macro with both scale and offset', () => {
      const macro: MacroEntity = {
        id: 'complex-scaling',
        targets: [
          {
            patternId: 'bass',
            parameter: 'note',
            scale: 0.5, // Half the range
            offset: 24 // Plus 2 octaves
          }
        ]
      };

      const result = MacroEntityValidator.validate(macro);
      expect(result.targets[0].scale).toBe(0.5);
      expect(result.targets[0].offset).toBe(24);
    });
  });

  describe('Invalid Macro Configurations', () => {
    it('should reject macro without id', () => {
      const macro = {
        targets: [
          { patternId: 'kick', parameter: 'density' }
        ]
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/id.*required/i);
    });

    it('should reject macro without targets', () => {
      const macro = {
        id: 'no-targets'
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/targets.*required/i);
    });

    it('should reject macro with empty targets array', () => {
      const macro = {
        id: 'empty-targets',
        targets: []
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/targets.*empty|at least one/i);
    });

    it('should reject target without patternId', () => {
      const macro = {
        id: 'no-pattern',
        targets: [
          { parameter: 'density' } // Missing patternId
        ]
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/patternId.*required/i);
    });

    it('should reject target without parameter', () => {
      const macro = {
        id: 'no-parameter',
        targets: [
          { patternId: 'kick' } // Missing parameter
        ]
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/parameter.*required/i);
    });

    it('should reject negative scale', () => {
      const macro = {
        id: 'negative-scale',
        targets: [
          {
            patternId: 'kick',
            parameter: 'density',
            scale: -0.5 // Negative not allowed
          }
        ]
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/scale.*negative|positive/i);
    });

    it('should reject scale greater than 2.0', () => {
      const macro = {
        id: 'excessive-scale',
        targets: [
          {
            patternId: 'kick',
            parameter: 'density',
            scale: 3.0 // Too large
          }
        ]
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/scale.*0.*2/i);
    });

    it('should reject offset beyond reasonable MIDI range', () => {
      const macro = {
        id: 'huge-offset',
        targets: [
          {
            patternId: 'kick',
            parameter: 'note',
            offset: 200 // Beyond MIDI note range
          }
        ]
      };

      expect(() => MacroEntityValidator.validate(macro as any))
        .toThrow(/offset.*-127.*127/i);
    });
  });
});

// ============================================================================
// MacroEntityValidator Tests - Wildcard Pattern Matching
// ============================================================================

describe('MacroEntityValidator - Wildcard Patterns', () => {
  it('should validate macro with wildcard patternId', () => {
    const macro: MacroEntity = {
      id: 'all-density',
      targets: [
        {
          patternId: '*', // All patterns
          parameter: 'density'
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].patternId).toBe('*');
  });

  it('should validate macro with prefix wildcard', () => {
    const macro: MacroEntity = {
      id: 'drum-velocity',
      targets: [
        {
          patternId: 'drum-*', // All patterns starting with 'drum-'
          parameter: 'velocity'
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].patternId).toBe('drum-*');
  });

  it('should validate macro with suffix wildcard', () => {
    const macro: MacroEntity = {
      id: 'all-kicks',
      targets: [
        {
          patternId: '*-kick', // All patterns ending with '-kick'
          parameter: 'velocity'
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].patternId).toBe('*-kick');
  });

  it('should reject invalid wildcard patterns', () => {
    const macro = {
      id: 'invalid-wildcard',
      targets: [
        {
          patternId: 'kick-*-hats', // Multiple wildcards not supported
          parameter: 'density'
        }
      ]
    };

    expect(() => MacroEntityValidator.validate(macro as any))
      .toThrow(/wildcard.*single/i);
  });
});

// ============================================================================
// MacroEntityValidator Tests - Cross-Pattern Control
// ============================================================================

describe('MacroEntityValidator - Cross-Pattern Control', () => {
  it('should validate macro controlling different parameters across patterns', () => {
    const macro: MacroEntity = {
      id: 'master-control',
      targets: [
        {
          patternId: 'kick',
          parameter: 'velocity',
          scale: 1.0
        },
        {
          patternId: 'hats',
          parameter: 'density',
          scale: 0.8
        },
        {
          patternId: 'bass',
          parameter: 'note',
          offset: 12 // Transpose up one octave
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets).toHaveLength(3);
    expect(result.targets[0].parameter).toBe('velocity');
    expect(result.targets[1].parameter).toBe('density');
    expect(result.targets[2].parameter).toBe('note');
  });

  it('should validate macro with mixed specific and wildcard targets', () => {
    const macro: MacroEntity = {
      id: 'mixed-targets',
      targets: [
        {
          patternId: 'kick',
          parameter: 'velocity',
          scale: 1.0 // Full control for kick
        },
        {
          patternId: 'drum-*',
          parameter: 'velocity',
          scale: 0.7 // Less control for other drums
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets).toHaveLength(2);
    expect(result.targets[0].patternId).toBe('kick');
    expect(result.targets[1].patternId).toBe('drum-*');
  });
});

// ============================================================================
// MacroEntityValidator Tests - Parameter Clamping
// ============================================================================

describe('MacroEntityValidator - Parameter Clamping', () => {
  it('should validate macro with clamping enabled', () => {
    const macro: MacroEntity = {
      id: 'clamped-macro',
      targets: [
        {
          patternId: 'kick',
          parameter: 'velocity',
          clamp: {
            min: 60,
            max: 127
          }
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].clamp).toEqual({ min: 60, max: 127 });
  });

  it('should validate macro with only min clamp', () => {
    const macro: MacroEntity = {
      id: 'min-clamp',
      targets: [
        {
          patternId: 'kick',
          parameter: 'density',
          clamp: {
            min: 0.2
          }
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].clamp?.min).toBe(0.2);
    expect(result.targets[0].clamp?.max).toBeUndefined();
  });

  it('should validate macro with only max clamp', () => {
    const macro: MacroEntity = {
      id: 'max-clamp',
      targets: [
        {
          patternId: 'hats',
          parameter: 'density',
          clamp: {
            max: 0.8
          }
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].clamp?.max).toBe(0.8);
    expect(result.targets[0].clamp?.min).toBeUndefined();
  });

  it('should reject clamp with min > max', () => {
    const macro = {
      id: 'invalid-clamp',
      targets: [
        {
          patternId: 'kick',
          parameter: 'velocity',
          clamp: {
            min: 100,
            max: 50 // min > max
          }
        }
      ]
    };

    expect(() => MacroEntityValidator.validate(macro as any))
      .toThrow(/clamp.*min.*max/i);
  });
});

// ============================================================================
// MacroEntityLoader Tests
// ============================================================================

describe('MacroEntityLoader', () => {
  it('should load macro from JSON file', () => {
    const macroPath = path.join(tempDir, 'density-all.json');
    const macroData = {
      id: 'density-all',
      targets: [
        { patternId: 'kick', parameter: 'density' },
        { patternId: 'hats', parameter: 'density' }
      ]
    };

    fs.writeFileSync(macroPath, JSON.stringify(macroData, null, 2));

    const result = MacroEntityLoader.load(macroPath);
    expect(result.id).toBe('density-all');
    expect(result.targets).toHaveLength(2);
  });

  it('should load macro from YAML file', () => {
    const macroPath = path.join(tempDir, 'velocity-scaled.yaml');
    const macroData = `
id: velocity-scaled
targets:
  - patternId: kick
    parameter: velocity
    scale: 1.0
  - patternId: hats
    parameter: velocity
    scale: 0.8
  - patternId: snare
    parameter: velocity
    scale: 0.6
`;

    fs.writeFileSync(macroPath, macroData);

    const result = MacroEntityLoader.load(macroPath);
    expect(result.id).toBe('velocity-scaled');
    expect(result.targets[0].scale).toBe(1.0);
    expect(result.targets[1].scale).toBe(0.8);
    expect(result.targets[2].scale).toBe(0.6);
  });

  it('should throw error for non-existent file', () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.json');

    expect(() => MacroEntityLoader.load(nonExistentPath))
      .toThrow(/not found|ENOENT/i);
  });

  it('should throw error for invalid JSON', () => {
    const macroPath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(macroPath, '{ invalid json }');

    expect(() => MacroEntityLoader.load(macroPath))
      .toThrow(/JSON|parse/i);
  });

  it('should throw error for macro that fails validation', () => {
    const macroPath = path.join(tempDir, 'invalid-macro.json');
    const invalidMacro = {
      id: 'invalid',
      targets: [] // Empty targets not allowed
    };

    fs.writeFileSync(macroPath, JSON.stringify(invalidMacro));

    expect(() => MacroEntityLoader.load(macroPath))
      .toThrow(/targets.*empty|at least one/i);
  });
});

// ============================================================================
// MacroExpander Integration Tests (T066)
// ============================================================================

describe('MacroExpander - Pattern Matching', () => {
  it('should expand wildcard "*" to all loaded patterns', () => {
    // This test will be implemented in MacroExpander.test.ts
    // Here we just verify the entity structure supports it
    const macro: MacroEntity = {
      id: 'all-density',
      targets: [{ patternId: '*', parameter: 'density' }]
    };

    expect(() => MacroEntityValidator.validate(macro)).not.toThrow();
  });

  it('should expand prefix wildcard "drum-*" to matching patterns', () => {
    const macro: MacroEntity = {
      id: 'drum-velocity',
      targets: [{ patternId: 'drum-*', parameter: 'velocity' }]
    };

    expect(() => MacroEntityValidator.validate(macro)).not.toThrow();
  });

  it('should expand suffix wildcard "*-kick" to matching patterns', () => {
    const macro: MacroEntity = {
      id: 'all-kicks',
      targets: [{ patternId: '*-kick', parameter: 'velocity' }]
    };

    expect(() => MacroEntityValidator.validate(macro)).not.toThrow();
  });
});

// ============================================================================
// Macro Execution Order Tests
// ============================================================================

describe('MacroEntityValidator - Execution Order', () => {
  it('should preserve target order for deterministic execution', () => {
    const macro: MacroEntity = {
      id: 'ordered-macro',
      targets: [
        { patternId: 'first', parameter: 'density' },
        { patternId: 'second', parameter: 'density' },
        { patternId: 'third', parameter: 'density' }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].patternId).toBe('first');
    expect(result.targets[1].patternId).toBe('second');
    expect(result.targets[2].patternId).toBe('third');
  });

  it('should support priority field for explicit ordering', () => {
    const macro: MacroEntity = {
      id: 'priority-macro',
      targets: [
        {
          patternId: 'kick',
          parameter: 'velocity',
          priority: 1 // Highest priority
        },
        {
          patternId: 'hats',
          parameter: 'velocity',
          priority: 2
        },
        {
          patternId: 'snare',
          parameter: 'velocity',
          priority: 3 // Lowest priority
        }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].priority).toBe(1);
    expect(result.targets[1].priority).toBe(2);
    expect(result.targets[2].priority).toBe(3);
  });

  it('should provide default priority of 0 when not specified', () => {
    const macro: MacroEntity = {
      id: 'no-priority',
      targets: [
        { patternId: 'kick', parameter: 'density' }
      ]
    };

    const result = MacroEntityValidator.validate(macro);
    expect(result.targets[0].priority).toBe(0);
  });
});
