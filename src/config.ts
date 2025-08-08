import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .union([z.boolean(), z.string().transform((s) => s.toLowerCase() === 'true')])
  .transform((v) => Boolean(v));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(7801),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  GLOBAL_MAX_CONCURRENCY: z.coerce.number().min(1).default(3),
  PER_HOST_MAX_CONCURRENCY: z.coerce.number().min(1).default(1),
  NAV_TIMEOUT_MS: z.coerce.number().min(1000).max(45000).default(25000),
  TOTAL_TIMEOUT_MS: z.coerce.number().min(1000).max(60000).default(30000),
  MAX_HTML_BYTES: z.coerce.number().min(1024).max(10 * 1024 * 1024).default(2_621_440),
  RESPECT_ROBOTS: booleanString.default(true),
  ALLOWLIST_REGEXES: csv.default(''),
  BLOCKLIST_REGEXES: csv.default(''),
  PROXY_LIST: csv.default(''),
  DEFAULT_USER_AGENTS: csv.default(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE: z.string().optional(),
  STORAGE_BUCKET: z.string().default('cerberus-artifacts'),
  STORAGE_PUBLIC: booleanString.default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export const loadConfig = (): AppConfig => {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`CONFIG_INVALID: ${message}`);
  }
  return parsed.data;
};



