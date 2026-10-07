import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dataUrlToBlob, migrateInlineLooks } from './inlineLookMigration';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function fakeClient(opts: { uploadError?: boolean; updateError?: boolean } = {}) {
  const calls = { uploads: [] as string[], updates: [] as Array<{ id: string; url: string }>, removed: [] as string[] };
  const client = {
    storage: {
      from: () => ({
        upload: async (path: string) => { calls.uploads.push(path); return { error: opts.uploadError ? { message: 'x' } : null }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://s.example/storage/v1/object/public/generated-looks/${path}` } }),
        remove: async (paths: string[]) => { calls.removed.push(...paths); return { error: null }; },
      }),
    },
    from: () => ({
      update: (v: { image_url: string }) => ({
        eq: (_c: string, id: string) => ({ eq: async () => { if (!opts.updateError) calls.updates.push({ id, url: v.image_url }); return { error: opts.updateError ? { message: 'x' } : null }; } }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('dataUrlToBlob', () => {
  it('decodes image data URLs and rejects everything else', () => {
    const b = dataUrlToBlob(PNG);
    expect(b?.type).toBe('image/png');
    expect(b?.size).toBe(8);
    expect(dataUrlToBlob('https://x/y.png')).toBeNull();
    expect(dataUrlToBlob('data:text/html;base64,AAAA')).toBeNull();
    expect(dataUrlToBlob('data:image/png;base64,***')).toBeNull();
  });
});

describe('migrateInlineLooks', () => {
  it('uploads each inline image into the owner folder and points the row at it', async () => {
    const { client, calls } = fakeClient();
    const moved = await migrateInlineLooks(client, 'user-1', [
      { id: 'a', image_url: PNG }, { id: 'b', image_url: 'https://s.example/ok.png' }, { id: 'c', image_url: PNG },
    ]);
    expect(Object.keys(moved).sort()).toEqual(['a', 'c']);
    expect(calls.uploads.every((p) => p.startsWith('user-1/') && p.endsWith('.png'))).toBe(true);
    expect(calls.updates.map((u) => u.id)).toEqual(['a', 'c']);
  });

  it('moves at most maxPerRun images per visit', async () => {
    const { client } = fakeClient();
    const looks = Array.from({ length: 5 }, (_, i) => ({ id: String(i), image_url: PNG }));
    expect(Object.keys(await migrateInlineLooks(client, 'u', looks, 2))).toHaveLength(2);
  });

  it('leaves the row alone when the upload fails, and removes the file when the row update fails', async () => {
    const up = fakeClient({ uploadError: true });
    expect(await migrateInlineLooks(up.client, 'u', [{ id: 'a', image_url: PNG }])).toEqual({});
    expect(up.calls.updates).toHaveLength(0);
    const upd = fakeClient({ updateError: true });
    expect(await migrateInlineLooks(upd.client, 'u', [{ id: 'a', image_url: PNG }])).toEqual({});
    expect(upd.calls.removed).toHaveLength(1);
  });
});
