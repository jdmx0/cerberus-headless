import { parse, type HTMLElement } from 'node-html-parser';

export type SanitizeOptions = {
  maxBytes: number;
  redactPatterns?: string[];
};

export const sanitizeHtml = (html: string, options: SanitizeOptions): { sanitized: string; textSnippet: string } => {
  const root = parse(html);
  // Remove script tags and inline event handlers
  root.querySelectorAll('script').forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((el) => {
    const attrs = (el as HTMLElement).attributes;
    Object.keys(attrs).forEach((name) => {
      if (/^on/i.test(name)) {
        el.removeAttribute(name);
      }
    });
  });

  let sanitized = root.toString();

  // Redact
  if (options.redactPatterns && options.redactPatterns.length > 0) {
    for (const p of options.redactPatterns) {
      try {
        const r = new RegExp(p, 'gi');
        sanitized = sanitized.replace(r, '[REDACTED]');
      } catch {
        // ignore invalid regex
      }
    }
  }

  // Clamp size
  if (Buffer.byteLength(sanitized, 'utf8') > options.maxBytes) {
    const buf = Buffer.from(sanitized, 'utf8');
    const clamped = buf.subarray(0, options.maxBytes - 3);
    sanitized = clamped.toString('utf8') + '...';
  }

  const textSnippet = extractTextSnippet(root.innerText);
  return { sanitized, textSnippet };
};

const extractTextSnippet = (text: string, maxChars = 1200): string => {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, maxChars);
};



