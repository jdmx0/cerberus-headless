import { describe, it, expect } from 'vitest';
import { extractFields } from '../../src/utils/extract.js';

describe('extract', () => {
  it('extracts css and attr', () => {
    const html = `<html><body><a href="/x" id="a">Link</a></body></html>`;
    const fields = extractFields(html, [
      { name: 'text', css: 'a', all: false },
      { name: 'href', css: 'a', attr: 'href' },
    ]);
    expect(fields.text).toBe('Link');
    expect(fields.href).toBe('/x');
  });
});



