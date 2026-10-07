import { describe, expect, it } from 'vitest';
import { uniqueGalleryLooks } from './galleryDedup';
describe('uniqueGalleryLooks', () => {
  it('keeps ranked first row and removes repeated IDs and image URLs across pages', () => {
    const rows = [{id:'a',image_url:'a.png'},{id:'a',image_url:'other.png'},{id:'b',image_url:'a.png'},{id:'c',image_url:'c.png'}];
    expect(uniqueGalleryLooks(rows)).toEqual([rows[0],rows[3]]);
    expect(rows).toHaveLength(4);
  });
  it('retains different photos and does not collapse missing images', () => {
    expect(uniqueGalleryLooks([{id:'a',image_url:''},{id:'b',image_url:''},{id:'c',image_url:'c.png'}])).toHaveLength(3);
  });
});
