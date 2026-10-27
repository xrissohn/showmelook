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

export async function analyzePersonalColor(imageData: string, language: 'ko' | 'en'): Promise<AnalyzeResponse> {
  const call = supabase.functions.invoke('analyze-personal-color', {
    body: { image_data: imageData, language, consent: true },
  });
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ANALYSIS_TIMEOUT_MS));
  const res = await Promise.race([call, timeout]);
  if (res === 'timeout') return { status: 'error', code: 'timeout' };
  let bodyCode: string | undefined;
  if (res.error) {
    try {
      const body = await (res.error as { context?: Response }).context?.json?.();
      bodyCode = body?.error_code;
    } catch { /* ignore */ }
  }
  return interpretAnalyzeReply(res.data, res.error as never, bodyCode);
}

/** Updates only personal_color on the user's own profile; other fields stay untouched. */
export async function savePersonalColor(userId: string, value: PersonalColor | null) {
  const { error } = await supabase
    .from('profiles')
    .update({ personal_color: value as unknown as Json })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function loadPersonalColor(userId: string): Promise<PersonalColor | null> {
  const { data, error } = await supabase.from('profiles').select('personal_color').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return parseSavedPersonalColor(data?.personal_color);
}
