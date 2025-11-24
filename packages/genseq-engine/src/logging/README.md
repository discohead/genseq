# ErrorLogger

File/line precision error logging for configuration validation.

## Overview

`ErrorLogger` formats validation errors from `SchemaValidator` with precise file:line information, making it easy to locate and fix configuration issues in YAML and JSON files.

## Features

- **File:line precision** - Format errors as `file.yaml:12 - message`
- **Context snippets** - Include surrounding lines for context
- **Enhanced messages** - Add parameter names and suggestions
- **Parse error extraction** - Extract line numbers from YAML/JSON parse errors
- **Integration ready** - Works seamlessly with SchemaValidator

## Basic Usage

```typescript
import { SchemaValidator, ErrorLogger } from '@genseq/engine';

const validator = new SchemaValidator({ enableLineNumbers: true });
const logger = new ErrorLogger();

const schema = {
  type: 'object',
  required: ['type', 'steps'],
  properties: {
    type: { type: 'string' },
    steps: { type: 'number', minimum: 1 }
  }
};

const yamlContent = `type: euclidean
steps: "16"`;

const result = validator.validateString(yamlContent, schema, { format: 'yaml' });

if (!result.valid) {
  // Simple logging
  logger.logAll('patterns/kick.yaml', result.errors);
  // Output: patterns/kick.yaml:2 - Expected type number, got string
}
```

## API

### `formatError(error: ValidationError, filePath: string): ErrorDetail`

Convert a `ValidationError` to an `ErrorDetail` with file/line information.

```typescript
const detail = logger.formatError(validationError, 'patterns/kick.yaml');
// {
//   file: 'patterns/kick.yaml',
//   line: 12,
//   column: 5,
//   message: 'must be integer',
//   context: ['  type: euclidean', '  steps: "16"', '  pulses: 4']
// }
```

### `formatMessage(detail: ErrorDetail, options?: FormatOptions): string`

Format an `ErrorDetail` into a human-readable message.

```typescript
// Basic format
logger.formatMessage(detail);
// => "patterns/kick.yaml:12 - must be integer"

// With column
logger.formatMessage(detail, { includeColumn: true });
// => "patterns/kick.yaml:12:5 - must be integer"

// With context
logger.formatMessage(detail, { includeContext: true });
// => "patterns/kick.yaml:12 - must be integer
//
//   type: euclidean
//   steps: "16"
//   pulses: 4"
```

### `logValidationError(filePath: string, errors: ValidationError[]): string`

Format multiple validation errors as a single string.

```typescript
const formatted = logger.logValidationError('patterns/kick.yaml', errors);
// Returns multi-line string with all errors formatted
```

### `logAll(filePath: string, errors: ValidationError[], options?: FormatOptions): void`

Log all errors to console with formatting.

```typescript
logger.logAll('patterns/kick.yaml', errors, { includeContext: true });
// Logs to console.error with header
```

### `enhanceValidationError(error: ValidationError): ValidationError`

Enhance error messages with parameter names and suggestions.

```typescript
const enhanced = logger.enhanceValidationError(error);
// Original: "must be integer"
// Enhanced: 'Parameter "steps": must be integer'
```

### `extractLineFromParseError(error: Error, format: 'json' | 'yaml'): ParseErrorLocation`

Extract line/column from YAML or JSON parse errors.

```typescript
const yamlError = new Error('bad indentation at line 12, column 5');
const location = logger.extractLineFromParseError(yamlError, 'yaml');
// { line: 12, column: 5 }

const jsonError = new SyntaxError('Unexpected token at position 123');
const location = logger.extractLineFromParseError(jsonError, 'json');
// { position: 123 }
```

## Types

```typescript
interface ErrorDetail {
  file: string;
  line?: number;
  column?: number;
  message: string;
  context?: string[];
}

interface FormatOptions {
  includeColumn?: boolean;
  includeContext?: boolean;
}

interface ParseErrorLocation {
  line?: number;
  column?: number;
  position?: number;
}
```

## Integration with SchemaValidator

`ErrorLogger` is designed to work seamlessly with `SchemaValidator`:

```typescript
import { SchemaValidator, ErrorLogger } from '@genseq/engine';

const validator = new SchemaValidator({ enableLineNumbers: true });
const logger = new ErrorLogger();

// Validate with line numbers
const result = validator.validateString(content, schema, { format: 'yaml' });

// Log errors with file:line precision
if (!result.valid) {
  logger.logAll('config.yaml', result.errors);
}
```

## Examples

### Multiple Errors

```typescript
const errors = [
  { path: 'patterns[0].steps', message: 'must be integer', line: 12 },
  { path: 'patterns[0].pulses', message: 'must be >= 1', line: 13 }
];

logger.logAll('patterns/kick.yaml', errors);
// Output:
// Validation errors in patterns/kick.yaml:
//
// patterns/kick.yaml:12 - must be integer
// patterns/kick.yaml:13 - must be >= 1
```

### Parse Errors

```typescript
const result = validator.validateString('{ invalid json }', schema, { format: 'json' });

if (!result.valid) {
  logger.logAll('config.json', result.errors);
  // Output: config.json - Failed to parse JSON: Unexpected token i in JSON at position 2
}
```

### Enhanced Messages

```typescript
const error = {
  path: 'patterns[0].type',
  message: 'must be one of: euclidean, probability, phase',
  value: 'euclid',
  suggestion: 'Did you mean "euclidean"?'
};

const enhanced = logger.enhanceValidationError(error);
const detail = logger.formatError(enhanced, 'patterns/kick.yaml');
console.log(logger.formatMessage(detail));
// Output: patterns/kick.yaml - Parameter "type": must be one of: euclidean, probability, phase. Did you mean "euclidean"?
```

## Testing

ErrorLogger is fully tested with both unit and integration tests:

```bash
# Run all ErrorLogger tests
pnpm test ErrorLogger

# Run unit tests only
pnpm test tests/unit/ErrorLogger.test.ts

# Run integration tests only
pnpm test tests/integration/ErrorLogger.integration.test.ts
```

## Implementation Notes

- Line numbers are extracted from `SchemaValidator` when `enableLineNumbers: true`
- Context snippets come from the `contextSnippet` field in `ValidationError`
- Parse errors are detected via pattern matching on error messages
- Enhanced messages add parameter names from error paths
- All public methods handle missing optional fields gracefully
