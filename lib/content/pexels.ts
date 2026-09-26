// Real photos from Pexels (free API, free to use, no attribution required but we credit anyway).
// Docs: https://www.pexels.com/api/documentation/

export type PexelsPhoto = {
  id: number;
  alt: string;
  photographer: string;
  url: string;
  width: number;
  height: number;
  src: { original: string; large2x: string; large: string; landscape: string };
};

export async function searchPhotos(query: string, page = 1): Promise<PexelsPhoto[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY is not set');
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('size', 'medium');
  url.searchParams.set('per_page', '30');
  url.searchParams.set('page', String(page));
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels search failed (${res.status}) for "${query}"`);
  const json = (await res.json()) as { photos: PexelsPhoto[] };
  return json.photos ?? [];
}

/** A random, unused, reasonably described photo for the query. */
export async function pickPhoto(query: string, usedIds: Set<string>): Promise<PexelsPhoto> {
  const page = 1 + Math.floor(Math.random() * 3);
  let photos = await searchPhotos(query, page);
  if (photos.length === 0 && page !== 1) photos = await searchPhotos(query, 1);
  const candidates = photos.filter((p) => !usedIds.has(`pexels:${p.id}`) && p.width >= 1200);
  if (candidates.length === 0) throw new Error(`No unused Pexels photos for "${query}"`);
  const top = candidates.slice(0, 15);
  return top[Math.floor(Math.random() * top.length)];
}

export async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
