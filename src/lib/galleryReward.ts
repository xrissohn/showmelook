import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const GALLERY_PUBLIC_CREDIT_TEXT =
  '스타일 갤러리에 공개하면 추가 생성 보너스 1 크레딧을 드려요 (룩 1개당 1회, 최대 10회)';

/**
 * 룩을 갤러리에 공개했을 때 보너스 크레딧 1개를 요청한다.
 * 룩 1개당 1회만 지급되며, 이미 지급된 경우 조용히 무시된다.
 */
export async function claimGalleryPublicCredit(lookId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('grant-gallery-credit', {
      body: { lookId },
    });
    if (error) return false;
    if (data?.granted) {
      toast({
        title: '보너스 크레딧 +1 🎁',
        description: '갤러리에 공개해 주셔서 감사합니다! 추가 스타일 생성 크레딧 1개가 지급되었어요.',
      });
      window.dispatchEvent(new CustomEvent('bonus-credits-updated'));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
