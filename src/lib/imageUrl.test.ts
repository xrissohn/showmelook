import { describe, expect, it } from 'vitest';
import { thumbUrl } from './imageUrl';

const BASE = 'https://abc.supabase.co/storage/v1';

describe('thumbUrl', () => {
  it('rewrites a public storage object to the resizing endpoint', () => {
    expect(thumbUrl(`${BASE}/object/public/generated-looks/u/1.png`, 480)).toBe(
      `${BASE}/render/image/public/generated-looks/u/1.png?width=480&quality=70`,
    );
  });

  it('leaves data URLs, external images, empty values and URLs with a query untouched', () => {
    expect(thumbUrl('data:image/png;base64,AAAA', 480)).toBe('data:image/png;base64,AAAA');
    expect(thumbUrl('https://cdn.example.com/a.png', 480)).toBe('https://cdn.example.com/a.png');
    expect(thumbUrl(`${BASE}/object/public/x/y.png?t=1`, 480)).toBe(`${BASE}/object/public/x/y.png?t=1`);
    expect(thumbUrl(null, 480)).toBeNull();
    expect(thumbUrl(undefined, 480)).toBeUndefined();
  });

  it('clamps the width to a sane range', () => {
    expect(thumbUrl(`${BASE}/object/public/b/o.png`, 10)).toContain('width=64');
    expect(thumbUrl(`${BASE}/object/public/b/o.png`, 9000)).toContain('width=2000');
  });
});
