import { createClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config.js';

export type UploadFile = { name: string; mime: string; bytes: Uint8Array };

export const createStorage = (config: AppConfig) => {
  const url = config.SUPABASE_URL;
  const key = config.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  const client = createClient(url, key, { auth: { persistSession: false } });
  const bucket = config.STORAGE_BUCKET;
  const isPublic = config.STORAGE_PUBLIC;

  const upload = async (prefix: string, files: UploadFile[]): Promise<Record<string, string>> => {
    const out: Record<string, string> = {};
    for (const f of files) {
      const path = `${prefix}${f.name}`;
      const { error } = await client.storage.from(bucket).upload(path, f.bytes, {
        contentType: f.mime,
        upsert: true,
      });
      if (error) throw error;
      if (isPublic) {
        const { data } = client.storage.from(bucket).getPublicUrl(path);
        out[f.name] = data.publicUrl;
      } else {
        const { data, error: serr } = await client.storage.from(bucket).createSignedUrl(path, 3600);
        if (serr) throw serr;
        out[f.name] = data.signedUrl;
      }
    }
    return out;
  };

  return { upload, bucket };
};



