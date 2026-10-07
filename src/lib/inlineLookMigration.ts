// Some old looks (2025-12) were saved with the image inlined as a base64 data URL (>1MB per row), which makes every
// list that includes them slow. When the owner opens their own gallery we move those images into storage and point the
// row at the stored file. Only the owner's own rows/folder are touched (the same permissions the app already uses).
import type { SupabaseClient } from '@supabase/supabase-js';

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Returns { lookId: storedPublicUrl } for the looks that were moved. Never throws; failures just leave the row as it is. */
export async function migrateInlineLooks(
  client: SupabaseClient,
  userId: string,
  looks: Array<{ id: string; image_url: string }>,
  maxPerRun = 3,
): Promise<Record<string, string>> {
  const moved: Record<string, string> = {};
  const todo = looks.filter((l) => typeof l.image_url === 'string' && l.image_url.startsWith('data:')).slice(0, maxPerRun);
  for (const look of todo) {
    try {
      const blob = dataUrlToBlob(look.image_url);
      if (!blob) continue;
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${EXT[blob.type] ?? 'png'}`;
      const { error: upError } = await client.storage.from('generated-looks').upload(path, blob, {
        contentType: blob.type,
        cacheControl: '31536000',
        upsert: false,
      });
      if (upError) continue;
      const url = client.storage.from('generated-looks').getPublicUrl(path).data.publicUrl;
      const { error: updError } = await client.from('generated_looks').update({ image_url: url }).eq('id', look.id).eq('user_id', userId);
      if (updError) {
        await client.storage.from('generated-looks').remove([path]); // 행을 못 바꿨으면 올린 파일을 되돌린다
        continue;
      }
      moved[look.id] = url;
    } catch {
      // 다음 방문 때 다시 시도
    }
  }
  return moved;
}
