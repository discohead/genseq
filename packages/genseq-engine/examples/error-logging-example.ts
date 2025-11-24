/**
 * ErrorLogger Usage Example
 *
 * Demonstrates how to use ErrorLogger with SchemaValidator
 * to provide file/line precision for configuration validation errors.
 */

import { SchemaValidator, ErrorLogger } from '../src';

// Example: Validating a YAML pattern configuration
const validator = new SchemaValidator({ enableLineNumbers: true });
const logger = new ErrorLogger();

// Define schema for pattern validation
const patternSchema = {
  type: 'object',
  required: ['type', 'steps', 'pulses'],
  properties: {
    type: {
      type: 'string',
      enum: ['euclidean', 'probability', 'phase']
    },
    steps: {
      type: 'number',
      minimum: 1,
      maximum: 64
    },
    pulses: {
      type: 'number',
      minimum: 1
    },
    offset: {
      type: 'number',
      default: 0
    }
  }
};

// Example 1: Valid YAML configuration
const validYaml = `type: euclidean
steps: 16
pulses: 4
offset: 2`;

console.log('Example 1: Valid configuration');
console.log('--------------------------------');
const validResult = validator.validateString(validYaml, patternSchema, { format: 'yaml' });

if (validResult.valid) {
  console.log('✓ Configuration is valid\n');
} else {
  logger.logAll('patterns/kick.yaml', validResult.errors);
}

// Example 2: Invalid type (steps is string instead of number)
const invalidTypeYaml = `type: euclidean
steps: "16"
pulses: 4`;

console.log('Example 2: Type error (steps should be number)');
console.log('-----------------------------------------------');
const typeErrorResult = validator.validateString(invalidTypeYaml, patternSchema, { format: 'yaml' });

if (!typeErrorResult.valid) {
  logger.logAll('patterns/kick.yaml', typeErrorResult.errors);
  console.log();
}

// Example 3: Multiple validation errors
const multipleErrorsYaml = `type: euclid
steps: 100
pulses: 0`;

console.log('Example 3: Multiple validation errors');
console.log('--------------------------------------');
const multipleErrorsResult = validator.validateString(multipleErrorsYaml, patternSchema, { format: 'yaml' });

if (!multipleErrorsResult.valid) {
  logger.logAll('patterns/kick.yaml', multipleErrorsResult.errors);
  console.log();
}

// Example 4: Missing required field
const missingFieldYaml = `type: euclidean
pulses: 4`;

console.log('Example 4: Missing required field');
console.log('----------------------------------');
const missingFieldResult = validator.validateString(missingFieldYaml, patternSchema, { format: 'yaml' });

if (!missingFieldResult.valid) {
  logger.logAll('patterns/kick.yaml', missingFieldResult.errors);
  console.log();
}

// Example 5: Enhanced error messages with context
const errorWithContextYaml = `type: euclidean
steps: 16
pulses: 4
unknown_field: "value"`;

console.log('Example 5: Enhanced error formatting');
console.log('-------------------------------------');
const contextResult = validator.validateString(errorWithContextYaml, patternSchema, { format: 'yaml' });

if (!contextResult.valid) {
  // Manually format each error with context
  contextResult.errors.forEach(error => {
    const enhanced = logger.enhanceValidationError(error);
    const detail = logger.formatError(enhanced, 'patterns/kick.yaml');
    console.log(logger.formatMessage(detail, { includeContext: true, includeColumn: true }));
  });
  console.log();
}

// Example 6: JSON parse error
const invalidJson = `{ "type": "euclidean", "steps": 16, }`;

console.log('Example 6: JSON parse error');
console.log('----------------------------');
const parseErrorResult = validator.validateString(invalidJson, patternSchema, { format: 'json' });

if (!parseErrorResult.valid) {
  logger.logAll('patterns/kick.json', parseErrorResult.errors);
  console.log();
}

// Example 7: Extract line numbers from YAML errors
console.log('Example 7: Extract line from parse error');
console.log('-----------------------------------------');
try {
  // This would come from a real YAML parse error
  const yamlError = new Error('bad indentation of a mapping entry at line 12, column 5');
  const location = logger.extractLineFromParseError(yamlError, 'yaml');
  console.log('Extracted location:', location);
  console.log();
} catch (e) {
  // Handle error
}

// Example 8: Programmatic error formatting
console.log('Example 8: Programmatic error formatting');
console.log('-----------------------------------------');
const programmaticError = {
  path: 'patterns[0].steps',
  message: 'must be integer',
  value: '16',
  line: 12,
  column: 5,
  file: 'patterns/kick.yaml',
  contextSnippet: '  type: euclidean\n  steps: "16"\n  pulses: 4'
};

const detail = logger.formatError(programmaticError, 'patterns/kick.yaml');
console.log('Simple format:', logger.formatMessage(detail));
console.log('With column:', logger.formatMessage(detail, { includeColumn: true }));
console.log('With context:');
console.log(logger.formatMessage(detail, { includeContext: true }));
