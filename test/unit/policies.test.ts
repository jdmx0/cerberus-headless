import { describe, it, expect } from 'vitest';
import { evaluateRobots } from '../../src/browser/policies.js';

describe('robots', () => {
  it('allows when no rules', () => {
    const r = evaluateRobots('', '/path', 'Agent');
    expect(r.allowed).toBe(true);
  });
  it('matches longest rule', () => {
    const txt = `User-agent: *\nDisallow: /\nAllow: /public`;
    const r1 = evaluateRobots(txt, '/x', 'Agent');
    const r2 = evaluateRobots(txt, '/public/page', 'Agent');
    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
  });
});



