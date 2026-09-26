import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const W = 1080;
const H = 720;

/**
 * One random "camera look" per round, applied identically to the real photo
 * and the fake. Grain, softening and heavier compression hide the too-smooth
 * textures that give AI images away, and since both get the same treatment
 * the processing itself is never a clue.
 */
export type Look = {
  grain: number;      // gaussian noise sigma, 0 = none
  soften: number;     // blur sigma (0 = none, otherwise 0.3+)
  saturation: number; // 1 = unchanged
  brightness: number; // 1 = unchanged
  quality: number;    // JPEG quality
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function randomLook(): Look {
  return {
    grain: rand(14, 26),
    soften: Math.random() < 0.6 ? rand(0.35, 0.7) : 0,
    saturation: rand(0.88, 1.06),
    brightness: rand(0.96, 1.04),
    quality: Math.round(rand(62, 74)),
  };
}

/**
 * Same size, same processing, no metadata. A small random crop and optional
 * mirror (independent per image) also make reverse image search less useful.
 */
export async function normalize(input: Buffer, look: Look): Promise<Buffer> {
  const zoom = 1 + Math.random() * 0.08;
  const bw = Math.round(W * zoom);
  const bh = Math.round(H * zoom);
  const resized = await sharp(input).rotate().resize(bw, bh, { fit: 'cover', position: 'attention' }).toBuffer();

  let img = sharp(resized).extract({
    left: Math.floor(Math.random() * (bw - W + 1)),
    top: Math.floor(Math.random() * (bh - H + 1)),
    width: W,
    height: H,
  });
  if (Math.random() < 0.5) img = img.flop();
  img = img.modulate({ saturation: look.saturation, brightness: look.brightness });
  if (look.soften >= 0.3) img = img.blur(look.soften);
  const graded = await img.toBuffer();

  let out = sharp(graded);
  if (look.grain > 0) {
    const noise = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: 'gaussian', mean: 128, sigma: look.grain } },
    })
      .png()
      .toBuffer();
    out = out.composite([{ input: noise, blend: 'soft-light' }]);
  }
  return out.jpeg({ quality: look.quality, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
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
