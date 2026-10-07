import { uniqueGalleryLooks } from './galleryDedup';

/** Give recent and popular looks equal room, then vary their display order per visit. */
export function mixGalleryPreview<T extends { id: string; image_url: string }>(recent: T[], popular: T[], random = Math.random): T[] {
  const mixed = uniqueGalleryLooks([...recent.slice(0, 12), ...popular.slice(0, 12)]);
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
  }
  return mixed;
}
