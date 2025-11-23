import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../../src/config/SchemaValidator';

/**
 * T015: SchemaValidator test suite
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * SchemaValidator class does not exist yet - implementation after Red phase.
 *
 * Requirements:
 * - Validate config against JSON schema
 * - Provide file/line error precision
 * - Support custom validation rules
 * - Generate helpful error messages
 */

describe('SchemaValidator - Basic Validation', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    // MUST FAIL - SchemaValidator doesn't exist
    validator = new SchemaValidator();
  });

  it('should validate object against schema', () => {
    const schema = {
      type: 'object',
      required: ['bpm', 'ppq'],
      properties: {
        bpm: { type: 'number', minimum: 20, maximum: 300 },
        ppq: { type: 'number', enum: [96, 192, 480, 960] }
      }
    };

    const validData = {
      bpm: 120,
      ppq: 480
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(validData, schema);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required properties', () => {
    const schema = {
      type: 'object',
      required: ['bpm', 'ppq', 'midiOutputPort'],
      properties: {
        bpm: { type: 'number' },
        ppq: { type: 'number' },
        midiOutputPort: { type: 'string' }
      }
    };

    const invalidData = {
      bpm: 120
      // Missing ppq and midiOutputPort
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(invalidData, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const errorPaths = result.errors.map((e: any) => e.path);
    expect(errorPaths).toContain('ppq');
    expect(errorPaths).toContain('midiOutputPort');
  });

  it('should detect type mismatches', () => {
    const schema = {
      type: 'object',
      properties: {
        bpm: { type: 'number' },
        name: { type: 'string' },
        active: { type: 'boolean' }
      }
    };

    const invalidData = {
      bpm: '120', // Should be number
      name: 42, // Should be string
      active: 'yes' // Should be boolean
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(invalidData, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);

    const bpmError = result.errors.find((e: any) => e.path === 'bpm');
    expect(bpmError.message).toContain('number');
  });

  it('should validate array items', () => {
    const schema = {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          items: { type: 'number', minimum: 0, maximum: 127 }
        }
      }
    };

    const validData = {
      notes: [60, 64, 67, 72]
    };

    const invalidData = {
      notes: [60, 128, 67, -1] // 128 and -1 are out of range
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        timeSignature: {
          type: 'object',
          required: ['numerator', 'denominator'],
          properties: {
            numerator: { type: 'number', minimum: 1 },
            denominator: { type: 'number', enum: [2, 4, 8, 16] }
          }
        }
      }
    };

    const validData = {
      timeSignature: {
        numerator: 4,
        denominator: 4
      }
    };

    const invalidData = {
      timeSignature: {
        numerator: 4,
        denominator: 3 // Not in enum
      }
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);

    const denominatorError = invalidResult.errors.find(
      (e: any) => e.path === 'timeSignature.denominator'
    );
    expect(denominatorError).toBeDefined();
  });

  it('should enforce minimum and maximum constraints', () => {
    const schema = {
      type: 'object',
      properties: {
        bpm: { type: 'number', minimum: 20, maximum: 300 },
        velocity: { type: 'number', minimum: 0, maximum: 127 }
      }
    };

    const invalidData = {
      bpm: 500, // Exceeds maximum
      velocity: -10 // Below minimum
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(invalidData, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);

    const bpmError = result.errors.find((e: any) => e.path === 'bpm');
    expect(bpmError.message).toContain('maximum');

    const velocityError = result.errors.find((e: any) => e.path === 'velocity');
    expect(velocityError.message).toContain('minimum');
  });

  it('should validate enum values', () => {
    const schema = {
      type: 'object',
      properties: {
        noteLength: { type: 'string', enum: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] }
      }
    };

    const validData = { noteLength: 'quarter' };
    const invalidData = { noteLength: 'third' };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);

    const error = invalidResult.errors[0];
    expect(error.message).toContain('enum');
  });

  it('should validate string patterns (regex)', () => {
    const schema = {
      type: 'object',
      properties: {
        midiPort: { type: 'string', pattern: '^[A-Za-z0-9 ]+$' }
      }
    };

    const validData = { midiPort: 'Virtual MIDI Port 1' };
    const invalidData = { midiPort: 'Invalid@Port#Name' };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
  });
});

describe('SchemaValidator - File/Line Error Precision', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator({
      enableLineNumbers: true
    });
  });

  it('should provide file path in error context', () => {
    const schema = {
      type: 'object',
      required: ['bpm'],
      properties: {
        bpm: { type: 'number' }
      }
    };

    const invalidData = {};
    const filePath = '/path/to/config.json';

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(invalidData, schema, { filePath });

    expect(result.valid).toBe(false);
    expect(result.errors[0].file).toBe(filePath);
  });

  it('should provide line numbers for JSON errors', () => {
    const schema = {
      type: 'object',
      properties: {
        bpm: { type: 'number' }
      }
    };

    // Multi-line JSON string with error on line 4
    const jsonString = `{
  "name": "Test Config",
  "description": "A test",
  "bpm": "invalid"
}`;

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validateString(jsonString, schema, { format: 'json' });

    expect(result.valid).toBe(false);

    const bpmError = result.errors.find((e: any) => e.path === 'bpm');
    expect(bpmError.line).toBe(4); // Error on line 4
    expect(bpmError.column).toBeGreaterThan(0);
  });

  it('should provide line numbers for YAML errors', () => {
    const schema = {
      type: 'object',
      properties: {
        sequences: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' }
            }
          }
        }
      }
    };

    const yamlString = `sequences:
  - name: "Sequence 1"
  - name: "Sequence 2"
  - notName: "Invalid"
`;

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validateString(yamlString, schema, { format: 'yaml' });

    expect(result.valid).toBe(false);

    // Error should be on line 4 (missing 'name' property)
    const error = result.errors[0];
    expect(error.line).toBe(4);
  });

  it('should provide context snippet around error location', () => {
    const schema = {
      type: 'object',
      properties: {
        bpm: { type: 'number' }
      }
    };

    const jsonString = `{
  "name": "Test",
  "bpm": "invalid",
  "ppq": 480
}`;

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validateString(jsonString, schema, { format: 'json' });

    const error = result.errors[0];
    expect(error.contextSnippet).toBeDefined();
    expect(error.contextSnippet).toContain('"bpm": "invalid"');
  });

  it('should provide column offset for precise error location', () => {
    const schema = {
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            value: { type: 'number' }
          }
        }
      }
    };

    const jsonString = `{
  "nested": {
    "value": "invalid"
  }
}`;

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validateString(jsonString, schema, { format: 'json' });

    const error = result.errors[0];
    expect(error.line).toBe(3);
    expect(error.column).toBeGreaterThan(0);
  });
});

describe('SchemaValidator - Custom Validation Rules', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('should support custom validation functions', () => {
    const schema = {
      type: 'object',
      properties: {
        bpm: { type: 'number' }
      }
    };

    // Add custom rule: BPM must be divisible by 10
    validator.addCustomRule('bpm', (value: number) => {
      if (value % 10 !== 0) {
        return 'BPM must be divisible by 10';
      }
      return null; // Valid
    });

    const validData = { bpm: 120 };
    const invalidData = { bpm: 125 };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0].message).toContain('divisible by 10');
  });

  it('should support cross-field validation', () => {
    const schema = {
      type: 'object',
      properties: {
        startTime: { type: 'number' },
        endTime: { type: 'number' }
      }
    };

    // Add custom rule: endTime must be > startTime
    validator.addCustomRule('_root', (data: any) => {
      if (data.endTime <= data.startTime) {
        return {
          path: 'endTime',
          message: 'End time must be after start time'
        };
      }
      return null;
    });

    const validData = { startTime: 100, endTime: 200 };
    const invalidData = { startTime: 200, endTime: 100 };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
  });

  it('should support async validation rules', async () => {
    const schema = {
      type: 'object',
      properties: {
        midiPort: { type: 'string' }
      }
    };

    // Async rule to check if MIDI port exists
    validator.addAsyncRule('midiPort', async (portName: string) => {
      // Simulate async check
      await new Promise(resolve => setTimeout(resolve, 10));

      const availablePorts = ['Virtual Port 1', 'Virtual Port 2'];
      if (!availablePorts.includes(portName)) {
        return `MIDI port "${portName}" not found`;
      }
      return null;
    });

    const validData = { midiPort: 'Virtual Port 1' };
    const invalidData = { midiPort: 'Non-existent Port' };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = await validator.validateAsync(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = await validator.validateAsync(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0].message).toContain('not found');
  });
});

describe('SchemaValidator - Error Messages', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('should generate human-readable error messages', () => {
    const schema = {
      type: 'object',
      required: ['bpm'],
      properties: {
        bpm: { type: 'number', minimum: 20, maximum: 300 }
      }
    };

    const data = { bpm: 500 };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    expect(result.valid).toBe(false);
    const error = result.errors[0];

    // Should be readable, not just "schema violation"
    expect(error.message).toMatch(/bpm.*maximum|exceeds|greater than/i);
  });

  it('should support custom error message templates', () => {
    const schema = {
      type: 'object',
      properties: {
        velocity: {
          type: 'number',
          minimum: 0,
          maximum: 127,
          errorMessage: 'Velocity must be a MIDI value (0-127)'
        }
      }
    };

    const data = { velocity: 200 };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe('Velocity must be a MIDI value (0-127)');
  });

  it('should include suggested fixes in error messages', () => {
    const schema = {
      type: 'object',
      properties: {
        ppq: { type: 'number', enum: [96, 192, 480, 960] }
      }
    };

    const data = { ppq: 100 };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    expect(result.valid).toBe(false);

    const error = result.errors[0];
    expect(error.suggestion).toBeDefined();
    expect(error.suggestion).toContain('96, 192, 480, 960');
  });

  it('should format errors as structured objects', () => {
    const schema = {
      type: 'object',
      required: ['bpm'],
      properties: {
        bpm: { type: 'number' }
      }
    };

    const data = { bpm: 'invalid' };

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    expect(result.valid).toBe(false);

    const error = result.errors[0];
    expect(error).toHaveProperty('path');
    expect(error).toHaveProperty('message');
    expect(error).toHaveProperty('value');
    expect(error).toHaveProperty('expected');
    expect(error).toHaveProperty('actual');
  });

  it('should support multiple error formats (JSON, text, HTML)', () => {
    const schema = {
      type: 'object',
      required: ['bpm', 'ppq'],
      properties: {
        bpm: { type: 'number' },
        ppq: { type: 'number' }
      }
    };

    const data = {};

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    const jsonErrors = validator.formatErrors(result.errors, 'json');
    expect(jsonErrors).toBeDefined();

    const textErrors = validator.formatErrors(result.errors, 'text');
    expect(textErrors).toContain('bpm');
    expect(textErrors).toContain('ppq');

    const htmlErrors = validator.formatErrors(result.errors, 'html');
    expect(htmlErrors).toContain('<');
    expect(htmlErrors).toContain('>');
  });
});

describe('SchemaValidator - Performance and Edge Cases', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('should handle deeply nested schemas efficiently', () => {
    const schema = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                level3: {
                  type: 'object',
                  properties: {
                    level4: {
                      type: 'object',
                      properties: {
                        value: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    const data = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'invalid' // Error deep in structure
            }
          }
        }
      }
    };

    const startTime = performance.now();

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    const validationTime = performance.now() - startTime;

    expect(result.valid).toBe(false);
    expect(validationTime).toBeLessThan(10); // Should be fast even with nesting

    const error = result.errors[0];
    expect(error.path).toBe('level1.level2.level3.level4.value');
  });

  it('should handle large arrays efficiently', () => {
    const schema = {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          items: { type: 'number', minimum: 0, maximum: 127 }
        }
      }
    };

    // Large array with one invalid value
    const data = {
      notes: Array.from({ length: 10000 }, (_, i) => i % 128)
    };
    data.notes[5000] = 200; // Invalid value

    const startTime = performance.now();

    // MUST FAIL - SchemaValidator doesn't exist
    const result = validator.validate(data, schema);

    const validationTime = performance.now() - startTime;

    expect(result.valid).toBe(false);
    expect(validationTime).toBeLessThan(100); // Should handle large arrays reasonably

    const error = result.errors[0];
    expect(error.path).toContain('notes[5000]');
  });

  it('should handle circular references gracefully', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        parent: { type: 'object' }
      }
    };

    const data: any = {
      name: 'Node 1'
    };
    data.parent = data; // Circular reference

    // MUST FAIL - SchemaValidator doesn't exist
    expect(() => validator.validate(data, schema)).not.toThrow();
  });

  it('should validate null and undefined correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        optional: { type: ['string', 'null'] },
        required: { type: 'string' }
      },
      required: ['required']
    };

    const validData = {
      required: 'value',
      optional: null
    };

    const invalidData = {
      required: null, // Should be string
      optional: null
    };

    // MUST FAIL - SchemaValidator doesn't exist
    const validResult = validator.validate(validData, schema);
    expect(validResult.valid).toBe(true);

    const invalidResult = validator.validate(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
  });
});
