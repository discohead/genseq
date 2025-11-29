/**
 * Schema Validation Tests: mapping.schema.json
 * Tests FR-014 MIDI input mapping validation requirements
 */

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';

const ajv = new Ajv();
const schemaPath = path.join(__dirname, '../../../../schemas/mapping.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const validate = ajv.compile(schema);

describe('mapping.schema.json validation', () => {
  describe('Valid configurations', () => {
    it('validates CC to parameter mapping with linear transform', () => {
      const config = {
        id: 'cc-to-velocity',
        enabled: true,
        source: {
          type: 'cc',
          device: 'Launchpad Pro',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [50, 127]
        },
        quantize: 'immediate'
      };
      expect(validate(config)).toBe(true);
    });

    it('validates note to macro mapping with exponential transform', () => {
      const config = {
        id: 'note-to-macro',
        source: {
          type: 'note',
          device: 'Keyboard',
          channel: 1,
          note: 60
        },
        target: {
          type: 'macro',
          macroId: 'filter-cutoff'
        },
        transform: {
          type: 'exponential',
          curve: 2.5,
          inputRange: [0, 127],
          outputRange: [100, 10000],
          smoothing: 50
        }
      };
      expect(validate(config)).toBe(true);
    });

    it('validates pitchbend to parameter with logarithmic transform', () => {
      const config = {
        id: 'pb-to-rate',
        source: {
          type: 'pitchbend',
          device: 'Arturia KeyStep',
          channel: 1
        },
        target: {
          type: 'parameter',
          patternId: 'arp',
          parameter: 'rate'
        },
        transform: {
          type: 'logarithmic',
          curve: 0.5,
          inputRange: [0, 16383],
          outputRange: [0.5, 4.0],
          smoothing: 100,
          deadZone: 10,
          deadZoneEnd: 10
        },
        quantize: 'beat'
      };
      expect(validate(config)).toBe(true);
    });

    it('validates CC to scene mapping without transform', () => {
      const config = {
        id: 'cc-scene-trigger',
        source: {
          type: 'cc',
          device: 'MPD32',
          channel: 10,
          controller: 64
        },
        target: {
          type: 'scene',
          sceneId: 'verse'
        },
        quantize: 'bar'
      };
      expect(validate(config)).toBe(true);
    });

    it('validates transform with quantize and dead zones', () => {
      const config = {
        id: 'cc-quantized',
        source: {
          type: 'cc',
          device: 'Faderfox',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'parameter',
          patternId: 'bass',
          parameter: 'octave'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [1, 5],
          quantize: 5,
          deadZone: 5,
          deadZoneEnd: 5
        }
      };
      expect(validate(config)).toBe(true);
    });

    it('validates minimal required fields', () => {
      const config = {
        id: 'minimal',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(true);
    });
  });

  describe('Invalid configurations', () => {
    it('rejects missing required id field', () => {
      const config = {
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('rejects CC source without controller field', () => {
      const config = {
        id: 'invalid-cc',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1
          // Missing controller field
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects note source without note field', () => {
      const config = {
        id: 'invalid-note',
        source: {
          type: 'note',
          device: 'Device',
          channel: 1
          // Missing note field
        },
        target: {
          type: 'macro',
          macroId: 'macro1'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects parameter target without patternId', () => {
      const config = {
        id: 'invalid-param',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          parameter: 'velocity'
          // Missing patternId
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects parameter target without parameter field', () => {
      const config = {
        id: 'invalid-param2',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat'
          // Missing parameter
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects macro target without macroId', () => {
      const config = {
        id: 'invalid-macro',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'macro'
          // Missing macroId
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects scene target without sceneId', () => {
      const config = {
        id: 'invalid-scene',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'scene'
          // Missing sceneId
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects exponential transform without curve', () => {
      const config = {
        id: 'invalid-exp',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0, 1]
          // Missing curve
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects logarithmic transform without curve', () => {
      const config = {
        id: 'invalid-log',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'logarithmic',
          inputRange: [0, 127],
          outputRange: [0, 1]
          // Missing curve
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects channel out of range (0)', () => {
      const config = {
        id: 'bad-channel',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 0, // Must be 1-16
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects channel out of range (17)', () => {
      const config = {
        id: 'bad-channel2',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 17, // Must be 1-16
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects controller out of range (128)', () => {
      const config = {
        id: 'bad-cc',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 128 // Must be 0-127
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects note out of range (128)', () => {
      const config = {
        id: 'bad-note',
        source: {
          type: 'note',
          device: 'Device',
          channel: 1,
          note: 128 // Must be 0-127
        },
        target: {
          type: 'macro',
          macroId: 'macro1'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects curve <= 0', () => {
      const config = {
        id: 'bad-curve',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'exponential',
          curve: 0, // Must be > 0
          inputRange: [0, 127],
          outputRange: [0, 1]
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects negative smoothing', () => {
      const config = {
        id: 'bad-smooth',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          smoothing: -10 // Must be >= 0
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects invalid quantize value', () => {
      const config = {
        id: 'bad-quantize',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        quantize: 'measure' // Must be bar/beat/immediate
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects invalid source type', () => {
      const config = {
        id: 'bad-type',
        source: {
          type: 'aftertouch', // Not supported
          device: 'Device',
          channel: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects invalid target type', () => {
      const config = {
        id: 'bad-target',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'global' // Not supported
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects transform quantize < 1', () => {
      const config = {
        id: 'bad-transform-quantize',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          quantize: 0 // Must be >= 1
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects inputRange with wrong length', () => {
      const config = {
        id: 'bad-input-range',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 50, 127] // Must be exactly 2 elements
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('rejects outputRange with wrong length', () => {
      const config = {
        id: 'bad-output-range',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          outputRange: [0] // Must be exactly 2 elements
        }
      };
      expect(validate(config)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('validates transform without type field (should fail)', () => {
      const config = {
        id: 'no-transform-type',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          inputRange: [0, 127],
          outputRange: [0, 1]
          // Missing type
        }
      };
      expect(validate(config)).toBe(false);
    });

    it('validates all dead zone and smoothing parameters together', () => {
      const config = {
        id: 'all-params',
        source: {
          type: 'cc',
          device: 'Device',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'pat',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 1],
          smoothing: 25,
          deadZone: 3,
          deadZoneEnd: 3,
          quantize: 8
        }
      };
      expect(validate(config)).toBe(true);
    });

    it('validates pitchbend with full 14-bit range', () => {
      const config = {
        id: 'pb-14bit',
        source: {
          type: 'pitchbend',
          device: 'Controller',
          channel: 1
        },
        target: {
          type: 'parameter',
          patternId: 'synth',
          parameter: 'detune'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 16383],
          outputRange: [-100, 100]
        }
      };
      expect(validate(config)).toBe(true);
    });
  });
});
