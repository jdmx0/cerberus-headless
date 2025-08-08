import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('config', () => {
  it('loads defaults', () => {
    const cfg = loadConfig();
    expect(cfg.PORT).toBeTypeOf('number');
    expect(cfg.GLOBAL_MAX_CONCURRENCY).toBeGreaterThan(0);
  });
});



