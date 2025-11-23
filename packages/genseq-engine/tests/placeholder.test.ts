import { describe, it, expect } from 'vitest';
import { version } from '../src/index';

describe('GenSeq Engine - Placeholder Tests', () => {
  it('should export version', () => {
    expect(version).toBe('0.1.0');
  });

  // Real tests will be created in Phase 2 following test-first principles
});
