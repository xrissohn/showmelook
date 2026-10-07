import { expect, it } from 'vitest';
import { mixGalleryPreview } from './galleryPreview';
it('mixes both pools, removes duplicate looks and leaves input ranking untouched', () => {
  const recent = [{ id: 'new', image_url: 'new.png' }, { id: 'shared', image_url: 's.png' }];
  const popular = [{ id: 'top', image_url: 'top.png' }, recent[1]];
  const result = mixGalleryPreview(recent, popular, () => 0);
  expect(new Set(result.map(x => x.id))).toEqual(new Set(['new', 'shared', 'top']));
  expect(result).toHaveLength(3);
  expect(recent[0].id).toBe('new');
});
