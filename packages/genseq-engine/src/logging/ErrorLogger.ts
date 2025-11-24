import type { ValidationError } from '../config/SchemaValidator';

/**
 * T052: ErrorLogger with file/line precision
 *
 * Formats validation errors with file:line precision for configuration validation.
 * Extracts line numbers from YAML/JSON parser errors and provides context.
 */

export interface ErrorDetail {
  file: string;
  line?: number;
  column?: number;
  message: string;
  context?: string[];
}

export interface FormatOptions {
  includeColumn?: boolean;
  includeContext?: boolean;
}

export interface ParseErrorLocation {
  line?: number;
  column?: number;
  position?: number;
}

export class ErrorLogger {
  /**
   * Format a validation error into an ErrorDetail with file/line precision
   */
  formatError(error: ValidationError, filePath: string): ErrorDetail {
    const context = error.contextSnippet
      ? error.contextSnippet.split('\n')
      : undefined;

    return {
      file: error.file || filePath,
      line: error.line,
      column: error.column,
      message: error.message,
      context
    };
  }

  /**
   * Format an ErrorDetail into a human-readable message
   * Default format: file:line - message
   * With column: file:line:column - message
   * With context: Includes surrounding lines
   */
  formatMessage(detail: ErrorDetail, options: FormatOptions = {}): string {
    let location = detail.file;

    if (detail.line !== undefined) {
      location += `:${detail.line}`;

      if (options.includeColumn && detail.column !== undefined) {
        location += `:${detail.column}`;
      }
    }

    let message = `${location} - ${detail.message}`;

    if (options.includeContext && detail.context && detail.context.length > 0) {
      message += '\n\n' + detail.context.join('\n');
    }

    return message;
  }

  /**
   * Format multiple validation errors for logging
   * Returns formatted string with one error per line
   */
  logValidationError(filePath: string, errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '';
    }

    const messages = errors.map(error => {
      const detail = this.formatError(error, filePath);
      return this.formatMessage(detail);
    });

    return messages.join('\n');
  }

  /**
   * Extract line/column information from YAML or JSON parse errors
   */
  extractLineFromParseError(error: Error, format: 'json' | 'yaml'): ParseErrorLocation {
    const message = error.message;

    if (format === 'yaml') {
      // YAML errors often include "at line X, column Y"
      const lineMatch = message.match(/at line (\d+), column (\d+)/);
      if (lineMatch) {
        return {
          line: parseInt(lineMatch[1], 10),
          column: parseInt(lineMatch[2], 10)
        };
      }

      // Alternative format: "on line X"
      const simpleMatch = message.match(/on line (\d+)/);
      if (simpleMatch) {
        return {
          line: parseInt(simpleMatch[1], 10)
        };
      }
    } else if (format === 'json') {
      // JSON errors include position
      const posMatch = message.match(/at position (\d+)/);
      if (posMatch) {
        return {
          position: parseInt(posMatch[1], 10)
        };
      }
    }

    return {};
  }

  /**
   * Enhance validation error message with path context
   * Example: "patterns[0].steps" becomes 'Parameter "steps"'
   */
  enhanceValidationError(error: ValidationError): ValidationError {
    let enhancedMessage = error.message;

    // Extract property name from path
    if (error.path && error.path !== '$root' && error.path !== '_root') {
      const pathParts = error.path.split('.');
      const lastPart = pathParts[pathParts.length - 1];

      // Remove array indices
      const propertyName = lastPart.replace(/\[\d+\]/, '');

      if (propertyName && !error.message.includes(propertyName)) {
        enhancedMessage = `Parameter "${propertyName}": ${error.message}`;
      }
    }

    // Add expected/actual information if available and not already in message
    if (error.expected && error.actual && !error.message.includes('Expected')) {
      enhancedMessage = `Expected ${error.expected}, got ${error.actual}. ${enhancedMessage}`;
    }

    // Add suggestion if available
    if (error.suggestion && !error.message.includes(error.suggestion)) {
      enhancedMessage += `. ${error.suggestion}`;
    }

    return {
      ...error,
      message: enhancedMessage
    };
  }

  /**
   * Log error to console with formatting
   */
  log(detail: ErrorDetail, options: FormatOptions = {}): void {
    console.error(this.formatMessage(detail, options));
  }

  /**
   * Log multiple errors to console
   */
  logAll(filePath: string, errors: ValidationError[], options: FormatOptions = {}): void {
    if (errors.length === 0) {
      return;
    }

    console.error(`\nValidation errors in ${filePath}:\n`);

    errors.forEach(error => {
      const enhanced = this.enhanceValidationError(error);
      const detail = this.formatError(enhanced, filePath);
      this.log(detail, options);
    });
  }
}
