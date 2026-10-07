/** Keep the first (highest-ranked) row; never mutate saved looks. */
export function uniqueGalleryLooks<T extends { id: string; image_url: string }>(rows: T[]): T[] {
  const ids = new Set<string>();
  const images = new Set<string>();
  return rows.filter(row => {
    const image = row.image_url?.trim();
    if (ids.has(row.id) || (image && images.has(image))) return false;
    ids.add(row.id);
    if (image) images.add(image);
    return true;
  });
}
