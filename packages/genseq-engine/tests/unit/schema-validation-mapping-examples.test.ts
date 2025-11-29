/**
 * Schema Validation Tests: Example Mapping Files
 * Validates example mapping configurations against mapping.schema.json
 */

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';

const ajv = new Ajv();
const schemaPath = path.join(__dirname, '../../../../schemas/mapping.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const validate = ajv.compile(schema);

describe('Example mapping file validation', () => {
  it('validates example-mappings.json from basic-sequencer', () => {
    const examplePath = path.join(
      __dirname,
      '../../../../examples/basic-sequencer/mappings/example-mappings.json'
    );

    const mappings = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));

    expect(Array.isArray(mappings)).toBe(true);
    expect(mappings.length).toBeGreaterThan(0);

    // Validate each mapping individually
    for (const mapping of mappings) {
      const isValid = validate(mapping);
      if (!isValid) {
        console.error(`Validation failed for mapping: ${mapping.id}`);
        console.error(validate.errors);
      }
      expect(isValid).toBe(true);
    }
  });

  it('validates all mapping IDs are unique', () => {
    const examplePath = path.join(
      __dirname,
      '../../../../examples/basic-sequencer/mappings/example-mappings.json'
    );

    const mappings = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    const ids = mappings.map((m: any) => m.id);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(uniqueIds.size);
  });

  it('validates source types are supported', () => {
    const examplePath = path.join(
      __dirname,
      '../../../../examples/basic-sequencer/mappings/example-mappings.json'
    );

    const mappings = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    const supportedTypes = ['cc', 'note', 'pitchbend'];

    for (const mapping of mappings) {
      expect(supportedTypes).toContain(mapping.source.type);
    }
  });

  it('validates target types are supported', () => {
    const examplePath = path.join(
      __dirname,
      '../../../../examples/basic-sequencer/mappings/example-mappings.json'
    );

    const mappings = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    const supportedTypes = ['parameter', 'macro', 'scene'];

    for (const mapping of mappings) {
      expect(supportedTypes).toContain(mapping.target.type);
    }
  });
});
