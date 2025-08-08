import { z } from 'zod';

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const FetchRenderInput = z.object({
  url: z
    .string()
    .url()
    .regex(/^https?:\/\//i),
  wait_until: z.enum(['load', 'domcontentloaded', 'networkidle']).default('networkidle'),
  timeout_ms: z.number().int().min(1000).max(45000).default(25000),
  js_enabled: z.boolean().default(true),
  block_media: z.boolean().default(true),
  user_agent: z.string().optional(),
  viewport: ViewportSchema.optional(),
  referer: z.string().optional(),
  extra_headers: z.record(z.string()).optional(),
  cookies: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        domain: z.string().optional(),
        path: z.string().optional(),
        httpOnly: z.boolean().optional(),
        secure: z.boolean().optional(),
        sameSite: z.enum(['Lax', 'Strict', 'None']).optional(),
      }),
    )
    .optional(),
  proxy_label: z.string().optional(),
  persist_artifacts: z.boolean().default(false),
  redact_patterns: z.array(z.string()).optional(),
  max_html_bytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(2_621_440),
  respect_robots: z.boolean().default(true),
  bypass_robots_for: z.array(z.string()).optional(),
  dry_run: z.boolean().default(false),
});

export const FetchRenderOutput = z.object({
  status: z.number().int(),
  headers: z.record(z.string()),
  final_url: z.string(),
  html: z.string(),
  text_snippet: z.string(),
  lang: z.string().optional(),
  timing: z.object({ nav_ms: z.number().int(), total_ms: z.number().int() }),
  evidence: z
    .object({ html_url: z.string().optional(), screenshot_url: z.string().optional() })
    .optional(),
  policy: z.object({
    robots_allowed: z.boolean(),
    rule_source: z.string().optional(),
    blocked_reason: z.string().optional(),
  }),
  meta: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    og: z.record(z.string()).optional(),
    canonical: z.string().optional(),
  }),
  correlation_id: z.string(),
});

export const ExtractContentInput = z.object({
  url: z.string().optional(),
  html: z.string().optional(),
  selectors: z.array(
    z.object({
      name: z.string(),
      css: z.string().optional(),
      xpath: z.string().optional(),
      attr: z.string().optional(),
      all: z.boolean().optional(),
    }),
  ),
  re_render: z.boolean().default(false),
  normalize_whitespace: z.boolean().default(true),
  language_hint: z.string().optional(),
  dry_run: z.boolean().default(false),
});

export const ExtractContentOutput = z.object({
  fields: z.record(z.union([z.string(), z.array(z.string()), z.null()])),
  confidence: z.number(),
  notes: z.array(z.string()).optional(),
  correlation_id: z.string(),
});

export const ScreenshotInput = z.object({
  url: z.string().url(),
  full_page: z.boolean().default(true),
  selector: z.string().optional(),
  clip: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
  wait_until: z.enum(['load', 'domcontentloaded', 'networkidle']).default('networkidle'),
  persist_artifacts: z.boolean().default(true),
  omit_background: z.boolean().default(false),
  dry_run: z.boolean().default(false),
});

export const ScreenshotOutput = z.object({
  final_url: z.string(),
  bytes_base64: z.string().optional(),
  screenshot_url: z.string().optional(),
  dimensions: z.object({ width: z.number().int(), height: z.number().int() }),
  timing_ms: z.number().int(),
  correlation_id: z.string(),
});

export const PdfInput = z.object({
  url: z.string().url(),
  print_background: z.boolean().default(false),
  format: z.string().default('A4'),
  margin_mm: z.number().int().default(10),
  persist_artifacts: z.boolean().default(true),
  dry_run: z.boolean().default(false),
});

export const PdfOutput = z.object({
  final_url: z.string(),
  pdf_url: z.string().optional(),
  bytes_base64: z.string().optional(),
  size_bytes: z.number().int(),
  correlation_id: z.string(),
});

export const VideoInput = z.object({
  url: z.string().url(),
  duration_ms: z.number().int().min(100).max(60_000).default(5_000),
  width: z.number().int().default(1280),
  height: z.number().int().default(720),
  wait_until: z.enum(['load', 'domcontentloaded', 'networkidle']).default('networkidle'),
  persist_artifacts: z.boolean().default(true),
  dry_run: z.boolean().default(false),
});

export const VideoOutput = z.object({
  final_url: z.string(),
  video_url: z.string().optional(),
  bytes_base64: z.string().optional(),
  size_bytes: z.number().int(),
  duration_ms: z.number().int(),
  timing_ms: z.number().int(),
  correlation_id: z.string(),
});

export const GetLinksInput = z.object({
  url: z.string().url(),
  scope: z.enum(['same_origin', 'same_host', 'all']).default('same_origin'),
  unique: z.boolean().default(true),
  include_rel_nofollow: z.boolean().default(false),
  max_count: z.number().int().default(200),
  dry_run: z.boolean().default(false),
});

export const GetLinksOutput = z.object({
  links: z.array(
    z.object({ href: z.string(), text: z.string().optional(), rel: z.string().optional() }),
  ),
  counts: z.object({ total: z.number().int(), unique: z.number().int() }),
  correlation_id: z.string(),
});

export const EvaluateInput = z.object({
  url: z.string().url(),
  function_source: z.string(),
  timeout_ms: z.number().int().min(100).max(8000).default(5000),
  sandbox: z.enum(['strict', 'relaxed']).default('strict'),
  dry_run: z.boolean().default(false),
});

export const EvaluateOutput = z.object({
  result: z.any(),
  logs: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  correlation_id: z.string(),
});

export const MetaInput = z.object({ url: z.string().url(), dry_run: z.boolean().default(false) });
export const MetaOutput = z.object({
  canonical: z.string().optional(),
  metas: z.record(z.string()),
  og: z.record(z.string()),
  twitter: z.record(z.string()),
  correlation_id: z.string(),
});

export const RobotsInput = z.object({ url: z.string().url(), dry_run: z.boolean().default(false) });
export const RobotsOutput = z.object({
  robots_url: z.string(),
  allowed: z.boolean(),
  matched_rule: z.string().optional(),
  correlation_id: z.string(),
});

export const SaveArtifactsInput = z.object({
  files: z.array(z.object({ name: z.string(), mime: z.string(), bytes_base64: z.string() })),
  prefix: z.string().optional(),
  dry_run: z.boolean().default(false),
});
export const SaveArtifactsOutput = z.object({
  urls: z.record(z.string()),
  bucket: z.string(),
  correlation_id: z.string(),
});

export type JsonSchema = Record<string, unknown>;
