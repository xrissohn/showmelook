import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  parseSavedPersonalColor,
  type PersonalColor,
  type RetakeReason,
} from '../../supabase/functions/_shared/personalColor.ts';

export * from '../../supabase/functions/_shared/personalColor.ts';

export const ANALYSIS_TIMEOUT_MS = 60_000;

export type AnalyzeResponse =
  | { status: 'ok'; result: PersonalColor }
  | { status: 'retake'; reasons: RetakeReason[] }
  | { status: 'error'; code: string };

/** Downscale and re-encode as JPEG (also drops EXIF/location metadata) before sending. */
export async function prepareImage(file: File, maxSide = 1024): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error('invalid_image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('invalid_image'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Maps the server reply to a UI state. Pure so it can be unit tested. */
export function interpretAnalyzeReply(data: unknown, error: { context?: { status?: number } } | null, bodyErrorCode?: string): AnalyzeResponse {
  const d = data as Record<string, unknown> | null;
  if (d?.success === true && d.status === 'retake') return { status: 'retake', reasons: (d.reasons as RetakeReason[]) || [] };
  if (d?.success === true && d.status === 'ok') {
    const parsed = parseSavedPersonalColor(d.result);
    if (parsed && parsed.source === 'ai_photo' && parsed.palette.length >= 4) return { status: 'ok', result: parsed };
    return { status: 'error', code: 'analysis_failed' };
  }
  const code = (d?.error_code as string) || bodyErrorCode || (error ? 'network' : 'analysis_failed');
  return { status: 'error', code };
}

/**
 * Sends the photo for analysis. The caller passes its current consent; without it nothing is sent.
 * `signal` lets the page cancel when the user leaves or signs out; the 60s timer is always cleared.
 */
export async function analyzePersonalColor(
  imageData: string,
  language: 'ko' | 'en',
  opts: { consent: boolean; signal?: AbortSignal },
): Promise<AnalyzeResponse> {
  if (opts.consent !== true) return { status: 'error', code: 'consent_required' };
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const call = supabase.functions.invoke('analyze-personal-color', {
      body: { image_data: imageData, language, consent: true },
      signal: controller.signal,
    });
    const timeout = new Promise<'timeout'>((r) => { timer = setTimeout(() => r('timeout'), ANALYSIS_TIMEOUT_MS); });
    const res = await Promise.race([call, timeout]);
    if (res === 'timeout') { controller.abort(); return { status: 'error', code: 'timeout' }; }
    if (controller.signal.aborted) return { status: 'error', code: 'cancelled' };
    let bodyCode: string | undefined;
    if (res.error) {
      try {
        const body = await (res.error as { context?: Response }).context?.json?.();
        bodyCode = body?.error_code;
      } catch { /* ignore */ }
    }
    return interpretAnalyzeReply(res.data, res.error as never, bodyCode);
  } catch {
    return { status: 'error', code: controller.signal.aborted ? 'cancelled' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}

/** Saves (or clears) only personal_color on the user's own row. Throws unless exactly that row came back. */
export async function savePersonalColor(userId: string, value: PersonalColor | null): Promise<PersonalColor | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ personal_color: value as unknown as Json })
    .eq('user_id', userId)
    .select('user_id, personal_color');
  if (error) throw error;
  return confirmSavedRow(data, userId, value);
}

/** Pure check used by savePersonalColor: the update must return the caller's own row with the new value. */
export function confirmSavedRow(rows: unknown, userId: string, value: PersonalColor | null): PersonalColor | null {
  const list = Array.isArray(rows) ? rows as { user_id?: string; personal_color?: unknown }[] : [];
  if (list.length !== 1 || list[0].user_id !== userId) throw new Error('not_saved');
  const stored = parseSavedPersonalColor(list[0].personal_color);
  if (value === null) {
    if (list[0].personal_color !== null && list[0].personal_color !== undefined) throw new Error('not_saved');
    return null;
  }
  if (!stored || stored.season !== value.season || stored.source !== value.source) throw new Error('not_saved');
  return stored;
}

export async function loadPersonalColor(userId: string): Promise<PersonalColor | null> {
  const { data, error } = await supabase.from('profiles').select('personal_color').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return parseSavedPersonalColor(data?.personal_color);
}
