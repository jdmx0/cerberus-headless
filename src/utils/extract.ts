import { parse } from 'node-html-parser';

export type Selector = { name: string; css?: string; xpath?: string; attr?: string; all?: boolean };

export const extractFields = (
  html: string,
  selectors: Selector[],
  normalizeWhitespace = true,
): Record<string, string | string[] | null> => {
  const root = parse(html);
  const out: Record<string, string | string[] | null> = {};
  for (const sel of selectors) {
    if (sel.css) {
      const nodes = root.querySelectorAll(sel.css);
      if (sel.all) {
        const values = nodes.map((n) => getNodeValue(n, sel.attr, normalizeWhitespace)).filter(Boolean) as string[];
        out[sel.name] = values;
      } else {
        const n = nodes[0];
        out[sel.name] = n ? getNodeValue(n, sel.attr, normalizeWhitespace) : null;
      }
    } else if (sel.xpath) {
      // Minimal XPath support: //tag[@attr="val"] and //tag
      const matched = selectByMiniXPath(root, sel.xpath);
      if (sel.all) {
        out[sel.name] = matched.map((n) => getNodeValue(n, sel.attr, normalizeWhitespace));
      } else {
        out[sel.name] = matched[0] ? getNodeValue(matched[0], sel.attr, normalizeWhitespace) : null;
      }
    } else {
      out[sel.name] = null;
    }
  }
  return out;
};

const getNodeValue = (node: any, attr?: string, normalize = true): string => {
  let v = attr ? node.getAttribute(attr) ?? '' : node.innerText;
  if (normalize) v = v.replace(/\s+/g, ' ').trim();
  return v;
};

const selectByMiniXPath = (root: any, xpath: string): any[] => {
  // Very limited support to avoid heavy deps
  if (xpath.startsWith('//')) {
    const rest = xpath.slice(2);
    const [tagWithPred] = rest.split('/');
    const m = tagWithPred.match(/^(\w+)(\[@(\w+)="([^"]+)"\])?$/);
    if (!m) return [];
    const [, tag, , attr, val] = m as any;
    return root.querySelectorAll(tag).filter((n: any) => (attr ? n.getAttribute(attr) === val : true));
  }
  return [];
};



