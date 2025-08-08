import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../src/utils/sanitize.js';

describe('sanitize', () => {
  it('removes scripts and clamps', () => {
    const html = '<html><head><script>alert(1)</script></head><body onclick="x()">Hello</body></html>';
    const { sanitized, textSnippet } = sanitizeHtml(html, { maxBytes: 100 });
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onclick');
    expect(textSnippet).toContain('Hello');
  });
});



