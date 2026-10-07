// Gallery cards show ~250px thumbnails, but the stored looks are ~1MB PNGs. Supabase Storage can resize
// public objects on the fly (render/image endpoint; webp for browsers that accept it), which makes a card
// ~30KB instead of ~1MB. Anything that is not a plain public storage URL (data URLs, external images,
// URLs that already carry a query) is returned unchanged.
const PUBLIC_OBJECT = '/storage/v1/object/public/';
const PUBLIC_RENDER = '/storage/v1/render/image/public/';

export function thumbUrl(src: string | null | undefined, width: number, quality = 70): string | null | undefined {
  if (!src || !src.startsWith('http') || !src.includes(PUBLIC_OBJECT) || src.includes('?')) return src;
  const w = Math.max(64, Math.min(2000, Math.round(width)));
  return `${src.replace(PUBLIC_OBJECT, PUBLIC_RENDER)}?width=${w}&quality=${quality}`;
}
