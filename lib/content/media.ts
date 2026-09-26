import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const W = 1200;
const H = 800;

/**
 * Make real and AI images indistinguishable by format: same size, same JPEG
 * settings, no metadata. A small random crop and optional mirror also make
 * reverse-image-searching the real photo less useful.
 */
export async function normalize(input: Buffer): Promise<Buffer> {
  const zoom = 1 + Math.random() * 0.08;
  const bw = Math.round(W * zoom);
  const bh = Math.round(H * zoom);
  let img = sharp(input).rotate().resize(bw, bh, { fit: 'cover', position: 'attention' });
  const base = await img.toBuffer();
  const left = Math.floor(Math.random() * (bw - W + 1));
  const top = Math.floor(Math.random() * (bh - H + 1));
  img = sharp(base).extract({ left, top, width: W, height: H });
  if (Math.random() < 0.5) img = img.flop();
  return img.jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}

/** Upload under a random name so the URL never hints at the answer. */
export async function upload(db: SupabaseClient, buf: Buffer): Promise<string> {
  const path = `r/${randomUUID()}.jpg`;
  const { error } = await db.storage.from('media').upload(path, buf, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return db.storage.from('media').getPublicUrl(path).data.publicUrl;
}
