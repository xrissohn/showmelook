import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GeneratedLook {
  id: string;
  image_url: string;
  prompt_used: string | null;
  is_favorite: boolean;
  is_public: boolean;
  created_at: string;
  style_trend_id: string | null;
  product_ids: string[] | null;
  memo?: string | null;
  tags?: string[] | null;
  style_reasoning?: string | null;
  like_count?: number;
  caption?: string | null;
}

export function useGeneratedLooks() {
  const { user } = useAuth();
  const [looks, setLooks] = useState<GeneratedLook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Cache tracking
  const cacheRef = useRef<{ data: GeneratedLook[]; timestamp: number } | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

  const fetchLooks = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setLooks([]);
      return;
    }

    // 캐시가 유효하고 강제 새로고침이 아니면 캐시 사용
    if (!forceRefresh && cacheRef.current) {
      const now = Date.now();
      if (now - cacheRef.current.timestamp < CACHE_DURATION) {
        setLooks(cacheRef.current.data);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch all looks
      const { data: looksData, error: looksError } = await supabase
        .from('generated_looks')
        .select('id, image_url, prompt_used, is_favorite, is_public, created_at, style_trend_id, product_ids, memo, tags, like_count, caption, tag_positions, style_reasoning')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (looksError) throw looksError;
      if (!looksData || looksData.length === 0) {
        setLooks([]);
        cacheRef.current = { data: [], timestamp: Date.now() };
        return;
      }

      // 2. Signed URL 배치 처리 - 파일 경로만 필터링
      const pathsNeedingSigning = looksData
        .map((look, index) => ({ index, path: look.image_url }))
        .filter(item => item.path && !item.path.startsWith('http') && !item.path.startsWith('data:'));

      let signedUrlMap: Record<number, string> = {};

      if (pathsNeedingSigning.length > 0) {
        // 배치로 한 번에 Signed URL 생성 (최대 효과!)
        const paths = pathsNeedingSigning.map(item => item.path);
        const { data: signedData, error: signError } = await supabase.storage
          .from('generated-looks')
          .createSignedUrls(paths, 3600);

        if (!signError && signedData) {
          pathsNeedingSigning.forEach((item, i) => {
            if (signedData[i]?.signedUrl) {
              signedUrlMap[item.index] = signedData[i].signedUrl;
            }
          });
        }
      }

      // 3. Signed URL 적용
      const looksWithUrls: GeneratedLook[] = looksData.map((look, index) => ({
        ...look,
        image_url: signedUrlMap[index] || look.image_url,
      }));

      setLooks(looksWithUrls);
      cacheRef.current = { data: looksWithUrls, timestamp: Date.now() };
    } catch (err) {
      console.error('Error fetching generated looks:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 새 룩 추가 시 캐시 업데이트 (전체 재조회 없이)
  const addLook = useCallback((newLook: GeneratedLook) => {
    setLooks(prev => [newLook, ...prev]);
    if (cacheRef.current) {
      cacheRef.current.data = [newLook, ...cacheRef.current.data];
      cacheRef.current.timestamp = Date.now();
    }
  }, []);

  // 룩 삭제 시 캐시 업데이트
  const removeLook = useCallback((lookId: string) => {
    setLooks(prev => prev.filter(look => look.id !== lookId));
    if (cacheRef.current) {
      cacheRef.current.data = cacheRef.current.data.filter(look => look.id !== lookId);
    }
  }, []);

  // 캐시 무효화
  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  // 초기 로딩
  useEffect(() => {
    fetchLooks();
  }, [fetchLooks]);

  return {
    looks,
    isLoading,
    error,
    refetch: () => fetchLooks(true),
    addLook,
    removeLook,
    invalidateCache,
  };
}
