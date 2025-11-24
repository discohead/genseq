import { describe, it, expect } from 'vitest';
import { ErrorLogger, type ErrorDetail } from '../../src/logging/ErrorLogger';
import type { ValidationError } from '../../src/config/SchemaValidator';

describe('ErrorLogger', () => {
  describe('formatError', () => {
    it('formats error with file and line number', () => {
      const logger = new ErrorLogger();
      const error = {
        path: 'patterns[0].steps',
        message: 'must be integer',
        value: '16',
        line: 12,
        column: 5,
        file: 'patterns/kick.yaml'
      } as ValidationError;

      const detail = logger.formatError(error, 'patterns/kick.yaml');

      expect(detail.file).toBe('patterns/kick.yaml');
      expect(detail.line).toBe(12);
      expect(detail.column).toBe(5);
      expect(detail.message).toBe('must be integer');
    });

    it('formats error without line number', () => {
      const logger = new ErrorLogger();
      const error = {
        path: 'patterns[0].steps',
        message: 'must be integer',
        value: '16'
      } as ValidationError;

      const detail = logger.formatError(error, 'patterns/kick.yaml');

      expect(detail.file).toBe('patterns/kick.yaml');
      expect(detail.line).toBeUndefined();
      expect(detail.message).toBe('must be integer');
    });

    it('includes context lines when available', () => {
      const logger = new ErrorLogger();
      const error = {
        path: 'patterns[0].steps',
        message: 'must be integer',
        value: '16',
        line: 12,
        contextSnippet: '  type: euclidean\n  steps: "16"\n  pulses: 4'
      } as ValidationError;

      const detail = logger.formatError(error, 'patterns/kick.yaml');

      expect(detail.context).toEqual([
        '  type: euclidean',
        '  steps: "16"',
        '  pulses: 4'
      ]);
    });

    it('handles missing context gracefully', () => {
      const logger = new ErrorLogger();
      const error = {
        path: 'patterns[0].steps',
        message: 'must be integer',
        value: '16'
      } as ValidationError;

      const detail = logger.formatError(error, 'patterns/kick.yaml');

      expect(detail.context).toBeUndefined();
    });
  });

  describe('formatMessage', () => {
    it('formats message with file and line', () => {
      const logger = new ErrorLogger();
      const detail: ErrorDetail = {
        file: 'patterns/kick.yaml',
        line: 12,
        column: 5,
        message: 'Invalid parameter "steps": must be integer'
      };

      const formatted = logger.formatMessage(detail);

      expect(formatted).toBe('patterns/kick.yaml:12 - Invalid parameter "steps": must be integer');
    });

    it('formats message with file, line, and column', () => {
      const logger = new ErrorLogger();
      const detail: ErrorDetail = {
        file: 'patterns/kick.yaml',
        line: 12,
        column: 5,
        message: 'Invalid parameter "steps": must be integer'
      };

      const formatted = logger.formatMessage(detail, { includeColumn: true });

      expect(formatted).toBe('patterns/kick.yaml:12:5 - Invalid parameter "steps": must be integer');
    });

    it('formats message without line number', () => {
      const logger = new ErrorLogger();
      const detail: ErrorDetail = {
        file: 'patterns/kick.yaml',
        message: 'Invalid parameter "steps": must be integer'
      };

      const formatted = logger.formatMessage(detail);

      expect(formatted).toBe('patterns/kick.yaml - Invalid parameter "steps": must be integer');
    });

    it('formats message with context lines', () => {
      const logger = new ErrorLogger();
      const detail: ErrorDetail = {
        file: 'patterns/kick.yaml',
        line: 12,
        message: 'Invalid parameter "steps": must be integer',
        context: [
          '  type: euclidean',
          '  steps: "16"',
          '  pulses: 4'
        ]
      };

      const formatted = logger.formatMessage(detail, { includeContext: true });

      expect(formatted).toContain('patterns/kick.yaml:12 - Invalid parameter "steps": must be integer');
      expect(formatted).toContain('  type: euclidean');
      expect(formatted).toContain('  steps: "16"');
      expect(formatted).toContain('  pulses: 4');
    });
  });

  describe('logValidationError', () => {
    it('formats multiple validation errors', () => {
      const logger = new ErrorLogger();
      const errors: ValidationError[] = [
        {
          path: 'patterns[0].steps',
          message: 'must be integer',
          value: '16',
          line: 12,
          column: 5
        },
        {
          path: 'patterns[0].pulses',
          message: 'must be >= 1',
          value: 0,
          line: 13,
          column: 5
        }
      ];

      const formatted = logger.logValidationError('patterns/kick.yaml', errors);

      expect(formatted).toContain('patterns/kick.yaml:12 - must be integer');
      expect(formatted).toContain('patterns/kick.yaml:13 - must be >= 1');
    });

    it('handles errors without line numbers', () => {
      const logger = new ErrorLogger();
      const errors: ValidationError[] = [
        {
          path: 'patterns[0].steps',
          message: 'must be integer',
          value: '16'
        }
      ];

      const formatted = logger.logValidationError('patterns/kick.yaml', errors);

      expect(formatted).toContain('patterns/kick.yaml - must be integer');
    });

    it('returns empty string for no errors', () => {
      const logger = new ErrorLogger();
      const formatted = logger.logValidationError('patterns/kick.yaml', []);

      expect(formatted).toBe('');
    });
  });

  describe('extractLineFromYAMLError', () => {
    it('extracts line number from YAML parse error', () => {
      const logger = new ErrorLogger();
      const yamlError = new Error('bad indentation of a mapping entry at line 12, column 5');

      const line = logger.extractLineFromParseError(yamlError, 'yaml');

      expect(line).toEqual({ line: 12, column: 5 });
    });

    it('extracts line number from JSON parse error', () => {
      const logger = new ErrorLogger();
      const jsonError = new SyntaxError('Unexpected token } in JSON at position 123');

      const line = logger.extractLineFromParseError(jsonError, 'json');

      expect(line).toEqual({ position: 123 });
    });

    it('returns empty object for unparseable error', () => {
      const logger = new ErrorLogger();
      const error = new Error('Some other error');

      const line = logger.extractLineFromParseError(error, 'yaml');

      expect(line).toEqual({});
    });
  });

  describe('enhanceValidationError', () => {
    it('enhances error with path context', () => {
      const logger = new ErrorLogger();
      const error: ValidationError = {
        path: 'patterns[0].steps',
        message: 'must be integer',
        value: '16'
      };

      const enhanced = logger.enhanceValidationError(error);

      expect(enhanced.message).toContain('Parameter "steps"');
      expect(enhanced.message).toContain('must be integer');
    });

    it('handles root-level errors', () => {
      const logger = new ErrorLogger();
      const error: ValidationError = {
        path: '$root',
        message: 'must be object',
        value: null
      };

      const enhanced = logger.enhanceValidationError(error);

      expect(enhanced.message).toBe('must be object');
    });

    it('includes expected/actual values when available', () => {
      const logger = new ErrorLogger();
      const error: ValidationError = {
        path: 'patterns[0].steps',
        message: 'must be integer',
        value: '16',
        expected: 'number',
        actual: 'string'
      };

      const enhanced = logger.enhanceValidationError(error);

      expect(enhanced.message).toContain('Expected number, got string');
    });

    it('includes suggestions when available', () => {
      const logger = new ErrorLogger();
      const error: ValidationError = {
        path: 'patterns[0].type',
        message: 'must be one of: euclidean, probability, phase',
        value: 'euclid',
        suggestion: 'Did you mean "euclidean"?'
      };

      const enhanced = logger.enhanceValidationError(error);

      expect(enhanced.message).toContain('Did you mean "euclidean"?');
    });
  });

  describe('integration with SchemaValidator', () => {
    it('formats SchemaValidator errors correctly', () => {
      const logger = new ErrorLogger();
      const validationError: ValidationError = {
        path: 'patterns[0].steps',
        message: 'Expected type number, got string',
        value: '16',
        expected: 'number',
        actual: 'string',
        line: 12,
        column: 5,
        file: 'patterns/kick.yaml',
        contextSnippet: '  type: euclidean\n  steps: "16"\n  pulses: 4'
      };

      const detail = logger.formatError(validationError, 'patterns/kick.yaml');
      const message = logger.formatMessage(detail);

      expect(message).toBe('patterns/kick.yaml:12 - Expected type number, got string');
    });

    it('handles missing property errors', () => {
      const logger = new ErrorLogger();
      const validationError: ValidationError = {
        path: 'patterns[0]',
        message: 'Missing required property: steps',
        value: { type: 'euclidean', pulses: 4 },
        line: 10,
        file: 'patterns/kick.yaml'
      };

      const detail = logger.formatError(validationError, 'patterns/kick.yaml');
      const message = logger.formatMessage(detail);

      expect(message).toBe('patterns/kick.yaml:10 - Missing required property: steps');
    });
  });
});
