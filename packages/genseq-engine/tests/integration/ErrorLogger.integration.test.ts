import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../src/config/SchemaValidator';
import { ErrorLogger } from '../../src/logging/ErrorLogger';

describe('ErrorLogger Integration', () => {
  it('integrates with SchemaValidator for YAML validation', () => {
    const validator = new SchemaValidator({ enableLineNumbers: true });
    const logger = new ErrorLogger();

    const schema = {
      type: 'object',
      required: ['type', 'steps', 'pulses'],
      properties: {
        type: { type: 'string', enum: ['euclidean'] },
        steps: { type: 'number', minimum: 1 },
        pulses: { type: 'number', minimum: 1 }
      }
    };

    const yamlContent = `type: euclidean
steps: "16"
pulses: 4`;

    const result = validator.validateString(yamlContent, schema, { format: 'yaml' });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Format errors with ErrorLogger
    const formatted = logger.logValidationError('patterns/kick.yaml', result.errors);

    expect(formatted).toContain('patterns/kick.yaml');
    expect(formatted).toContain('number'); // Type error for steps field
  });

  it('formats multiple validation errors from SchemaValidator', () => {
    const validator = new SchemaValidator({ enableLineNumbers: true });
    const logger = new ErrorLogger();

    const schema = {
      type: 'object',
      required: ['type', 'steps', 'pulses'],
      properties: {
        type: { type: 'string', enum: ['euclidean'] },
        steps: { type: 'number', minimum: 1, maximum: 32 },
        pulses: { type: 'number', minimum: 1 }
      }
    };

    const yamlContent = `type: euclidean
steps: "16"
pulses: 0`;

    const result = validator.validateString(yamlContent, schema, { format: 'yaml' });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Each error should have a formatted message
    result.errors.forEach(error => {
      const detail = logger.formatError(error, 'patterns/kick.yaml');
      const message = logger.formatMessage(detail);

      expect(message).toContain('patterns/kick.yaml');
      expect(message).toMatch(/.*:.*/); // Should contain file:line or file - message
    });
  });

  it('enhances validation errors with context', () => {
    const validator = new SchemaValidator({ enableLineNumbers: true });
    const logger = new ErrorLogger();

    const schema = {
      type: 'object',
      properties: {
        patterns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: { type: 'string' },
              steps: { type: 'number' }
            }
          }
        }
      }
    };

    const yamlContent = `patterns:
  - type: euclidean
    steps: "16"`;

    const result = validator.validateString(yamlContent, schema, { format: 'yaml' });

    if (!result.valid) {
      const enhancedErrors = result.errors.map(error => logger.enhanceValidationError(error));

      enhancedErrors.forEach(error => {
        expect(error.message).toBeTruthy();
      });
    }
  });

  it('handles JSON parse errors', () => {
    const validator = new SchemaValidator({ enableLineNumbers: true });
    const logger = new ErrorLogger();

    const schema = { type: 'object' };
    const invalidJson = '{ "type": "euclidean", }'; // Trailing comma

    const result = validator.validateString(invalidJson, schema, { format: 'json' });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const formatted = logger.logValidationError('patterns/kick.json', result.errors);

    expect(formatted).toContain('patterns/kick.json');
    expect(formatted).toContain('parse');
  });

  it('provides helpful error messages for enum violations', () => {
    const validator = new SchemaValidator({ enableLineNumbers: true });
    const logger = new ErrorLogger();

    const schema = {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['euclidean', 'probability', 'phase']
        }
      }
    };

    const yamlContent = `type: euclid`;

    const result = validator.validateString(yamlContent, schema, { format: 'yaml' });

    expect(result.valid).toBe(false);

    const formatted = logger.logValidationError('patterns/kick.yaml', result.errors);

    expect(formatted).toContain('patterns/kick.yaml');
    expect(formatted).toContain('enum'); // Enum validation error
  });
});
