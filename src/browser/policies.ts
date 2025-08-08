import { URL } from 'node:url';
import type { AppConfig } from '../config.js';

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
};

const compileRegexes = (patterns: string[]): RegExp[] => {
  return patterns
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => new RegExp(p, 'i'));
};

export const isProtocolAllowed = (url: string): PolicyDecision => {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return { allowed: false, reason: 'UNSUPPORTED_PROTOCOL' };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'INVALID_URL' };
  }
};

export const isBlocklisted = (config: AppConfig, url: string): PolicyDecision => {
  const u = new URL(url);
  const patterns = compileRegexes(config.BLOCKLIST_REGEXES);
  for (const r of patterns) {
    if (r.test(u.hostname) || r.test(u.href)) return { allowed: false, reason: 'BLOCKLISTED_DOMAIN' };
  }
  return { allowed: true };
};

export const isAllowlistedBypass = (config: AppConfig, url: string): boolean => {
  const u = new URL(url);
  return compileRegexes(config.ALLOWLIST_REGEXES).some((r) => r.test(u.hostname) || r.test(u.href));
};

export type RobotsCheck = {
  robotsUrl: string;
  allowed: boolean;
  matchedRule?: string;
};

const robotsCache: Map<string, { fetchedAt: number; body: string }> = new Map();

export const checkRobots = async (config: AppConfig, url: string, userAgent = 'Mozilla/5.0'): Promise<RobotsCheck> => {
  const u = new URL(url);
  const robotsUrl = `${u.origin}/robots.txt`;
  let body: string | undefined;
  const cached = robotsCache.get(robotsUrl);
  if (cached && Date.now() - cached.fetchedAt < 10 * 60_000) {
    body = cached.body;
  } else {
    try {
      const res = await fetch(robotsUrl, { headers: { 'User-Agent': userAgent } });
      body = res.ok ? await res.text() : '';
    } catch {
      body = '';
    }
    robotsCache.set(robotsUrl, { fetchedAt: Date.now(), body });
  }

  const { allowed, matchedRule } = evaluateRobots(body ?? '', u.pathname, userAgent);
  return { robotsUrl, allowed, matchedRule };
};

export const evaluateRobots = (robotsTxt: string, path: string, userAgent: string): { allowed: boolean; matchedRule?: string } => {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.trim());
  let applies = false;
  const rules: { allow: boolean; pattern: string }[] = [];
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [kRaw, vRaw] = line.split(':', 2);
    const k = kRaw.toLowerCase();
    const v = (vRaw ?? '').trim();
    if (k === 'user-agent') {
      const ua = v.toLowerCase();
      applies = ua === '*' || userAgent.toLowerCase().includes(ua);
    } else if (applies && (k === 'allow' || k === 'disallow')) {
      rules.push({ allow: k === 'allow', pattern: v || '/' });
    } else if (k === 'sitemap') {
      // ignore
    }
  }

  let matched: { allow: boolean; pattern: string } | undefined;
  for (const rule of rules) {
    const regex = robotsPatternToRegex(rule.pattern);
    if (regex.test(path)) {
      if (!matched || rule.pattern.length > matched.pattern.length) {
        matched = rule;
      }
    }
  }
  if (!matched) return { allowed: true };
  return { allowed: matched.allow, matchedRule: `${matched.allow ? 'Allow' : 'Disallow'}: ${matched.pattern}` };
};

const robotsPatternToRegex = (pattern: string): RegExp => {
  // Minimal translation per https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}`);
};



