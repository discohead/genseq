import Ajv, { type ErrorObject } from 'ajv';
import YAML from 'yaml';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  expected?: string;
  actual?: string;
  line?: number;
  column?: number;
  file?: string;
  contextSnippet?: string;
  suggestion?: string;
}

export interface SchemaValidatorConfig {
  enableLineNumbers?: boolean;
}

export interface ValidationContext {
  filePath?: string;
  format?: 'json' | 'yaml';
}

/**
 * T020: Schema validation using AJV
 *
 * Provides file/line/column error precision
 * Supports custom validation rules and async validation
 */
export class SchemaValidator {
  private ajv: Ajv;
  private config: SchemaValidatorConfig;
  private customRules: Map<string, (value: any) => string | null> = new Map();
  private asyncRules: Map<string, (value: any) => Promise<string | null>> = new Map();

  constructor(config: SchemaValidatorConfig = {}) {
    this.config = config;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  validate(data: any, schema: any, context?: ValidationContext): ValidationResult {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    const errors: ValidationError[] = [];

    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push(this.formatError(error, data, context));
      }
    }

    // Apply custom rules
    for (const [path, rule] of this.customRules) {
      if (path === '_root') {
        const result = rule(data);
        if (result) {
          if (typeof result === 'object' && 'path' in result) {
            errors.push({
              path: result.path,
              message: result.message,
              value: data,
              expected: 'valid',
              actual: 'invalid'
            });
          } else {
            errors.push({
              path,
              message: result,
              value: data,
              expected: 'valid',
              actual: 'invalid'
            });
          }
        }
      } else {
        const value = this.getValueAtPath(data, path);
        if (value !== undefined) {
          const result = rule(value);
          if (result) {
            errors.push({
              path,
              message: result,
              value,
              expected: 'valid',
              actual: 'invalid'
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validateAsync(data: any, schema: any, context?: ValidationContext): Promise<ValidationResult> {
    const syncResult = this.validate(data, schema, context);

    // Apply async rules
    for (const [path, rule] of this.asyncRules) {
      const value = this.getValueAtPath(data, path);
      if (value !== undefined) {
        const result = await rule(value);
        if (result) {
          syncResult.errors.push({
            path,
            message: result,
            value,
            expected: 'valid',
            actual: 'invalid'
          });
        }
      }
    }

    return {
      valid: syncResult.errors.length === 0,
      errors: syncResult.errors
    };
  }

  validateString(dataString: string, schema: any, options: { format: 'json' | 'yaml' }): ValidationResult {
    try {
      const data = options.format === 'json' ? JSON.parse(dataString) : YAML.parse(dataString);
      const result = this.validate(data, schema);

      // Add line numbers if enabled
      if (this.config.enableLineNumbers) {
        result.errors = result.errors.map(error => {
          const lineInfo = this.findLineNumber(dataString, error.path, options.format);
          return {
            ...error,
            ...lineInfo
          };
        });
      }

      return result;
    } catch (parseError: any) {
      return {
        valid: false,
        errors: [{
          path: '$root',
          message: `Failed to parse ${options.format.toUpperCase()}: ${parseError.message}`,
          value: dataString,
          expected: `valid ${options.format}`,
          actual: 'invalid syntax'
        }]
      };
    }
  }

  private formatError(error: ErrorObject, data: any, context?: ValidationContext): ValidationError {
    // Convert instancePath to dot notation, preserving array indices
    let path = error.instancePath ? error.instancePath.substring(1).replace(/\//g, '.') : error.params.missingProperty || '$root';

    // Convert array indices from .0 to [0] format
    path = path.replace(/\.(\d+)/g, '[$1]');

    const value = this.getValueAtPath(data, path);

    let message = error.message || 'Validation failed';
    let suggestion: string | undefined;
    let expected: string | undefined;
    let actual: string | undefined;

    // Enhance error messages based on type
    if (error.keyword === 'type') {
      expected = error.params.type;
      actual = typeof value;
      message = `Expected type ${expected}, got ${actual}`;
    } else if (error.keyword === 'required') {
      message = `Missing required property: ${error.params.missingProperty}`;
    } else if (error.keyword === 'minimum') {
      const limit = error.params.limit;
      message = `Value must be >= ${limit} (minimum constraint)`;
    } else if (error.keyword === 'maximum') {
      const limit = error.params.limit;
      message = `Value must be <= ${limit} (maximum constraint)`;
    } else if (error.keyword === 'enum') {
      const allowedValues = error.params.allowedValues;
      suggestion = `Allowed values: ${allowedValues.join(', ')}`;
      message = `Value must be one of (enum): ${allowedValues.join(', ')}`;
    }

    return {
      path,
      message,
      value,
      expected,
      actual,
      suggestion,
      file: context?.filePath
    };
  }

  private findLineNumber(content: string, path: string, format: 'json' | 'yaml'): { line?: number; column?: number; contextSnippet?: string } {
    const lines = content.split('\n');
    const pathParts = path.split('.');

    // Simple line number detection - find the line containing the property
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lastPart = pathParts[pathParts.length - 1];

      if (format === 'json') {
        if (line.includes(`"${lastPart}"`)) {
          return {
            line: i + 1,
            column: line.indexOf(`"${lastPart}"`) + 1,
            contextSnippet: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n')
          };
        }
      } else {
        if (line.includes(`${lastPart}:`)) {
          return {
            line: i + 1,
            column: line.indexOf(`${lastPart}:`) + 1,
            contextSnippet: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n')
          };
        }
      }
    }

    return {};
  }

  private getValueAtPath(obj: any, path: string): any {
    if (path === '$root' || path === '_root') {
      return obj;
    }

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array indices
      const arrayMatch = part.match(/(.+)\[(\d+)\]/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = current[key]?.[parseInt(index)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  addCustomRule(path: string, rule: (value: any) => string | null | { path: string; message: string }): void {
    this.customRules.set(path, rule);
  }

  addAsyncRule(path: string, rule: (value: any) => Promise<string | null>): void {
    this.asyncRules.set(path, rule);
  }

  formatErrors(errors: ValidationError[], format: 'json' | 'text' | 'html'): string {
    if (format === 'json') {
      return JSON.stringify(errors, null, 2);
    } else if (format === 'text') {
      return errors.map(error => {
        let text = `Error at ${error.path}: ${error.message}`;
        if (error.line) {
          text = `Line ${error.line}, Column ${error.column}: ${text}`;
        }
        if (error.file) {
          text = `${error.file}:${text}`;
        }
        return text;
      }).join('\n');
    } else if (format === 'html') {
      return `<ul>${errors.map(error => `<li><strong>${error.path}</strong>: ${error.message}</li>`).join('')}</ul>`;
    }

    return '';
  }
}
