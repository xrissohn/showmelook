import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SortOption = 'popular' | 'latest';
export type GenderFilter = 'all' | 'male' | 'female';

export interface CommunityLook {
  id: string;
  image_url: string;
  like_count: number;
  view_count: number;
  caption: string | null;
  tags: string[] | null;
  created_at: string;
  user_id: string;
  gallery_user_key?: string;
  prompt_used: string | null;
  product_ids: string[] | null;
  style_reasoning: string | null;
  user_name?: string | null;
  user_avatar?: string | null;
}

const PAGE_SIZE = 20;

export function useCommunityFeed() {
  const [looks, setLooks] = useState<CommunityLook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLooks = useCallback(async (reset = false) => {
    const currentPage = reset ? 0 : page;
    if (reset) {
      setIsLoading(true);
    }

    const orderColumn = sortBy === 'popular' ? 'like_count' : 'created_at';

    const { data, error } = await supabase
      .from('generated_looks_public' as any)
      .select('id, image_url, like_count, view_count, caption, tags, created_at, gallery_user_key, user_name, user_avatar, prompt_used, product_ids, style_reasoning, tag_positions')
      .order(orderColumn, { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Community feed error:', error);
      setIsLoading(false);
      return;
    }

    if (data) {
      const enriched = (data as any[]).map((look) => ({ ...look, user_id: look.gallery_user_key })) as CommunityLook[];
      if (reset) {
        setLooks(enriched);
        setPage(1);
      } else {
        setLooks(prev => [...prev, ...enriched]);
        setPage(prev => prev + 1);
      }
      setHasMore(data.length === PAGE_SIZE);
    }

    setIsLoading(false);
  }, [sortBy, page]);

  useEffect(() => {
    fetchLooks(true);
  }, [sortBy]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchLooks(false);
    }
  }, [fetchLooks, isLoading, hasMore]);

  const updateLookLikeCount = useCallback((lookId: string, newCount: number) => {
    setLooks(prev => prev.map(l => l.id === lookId ? { ...l, like_count: newCount } : l));
  }, []);

  return {
    looks,
    isLoading,
    sortBy,
    setSortBy,
    hasMore,
    loadMore,
    updateLookLikeCount,
  };
}
