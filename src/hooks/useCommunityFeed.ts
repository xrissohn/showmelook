import { useState, useEffect, useCallback, useRef } from 'react';
import { uniqueGalleryLooks } from '@/lib/galleryDedup';
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
  const pageRef = useRef(0);
  const fetchingRef = useRef(false);
  const requestRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLooks = useCallback(async (reset = false) => {
    if (!reset && fetchingRef.current) return;
    const request = ++requestRef.current;
    fetchingRef.current = true;
    setIsLoading(true);
    const currentPage = reset ? 0 : pageRef.current;
    try {
      const orderColumn = sortBy === 'popular' ? 'like_count' : 'created_at';
      let query = supabase
        .from('generated_looks_public' as any)
        .select('id, image_url, like_count, view_count, caption, tags, created_at, gallery_user_key, user_name, user_avatar, prompt_used, product_ids, style_reasoning, tag_positions')
        .order(orderColumn, { ascending: false });
      if (sortBy === 'popular') query = query.order('created_at', { ascending: false });
      const { data, error } = await query.order('id', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
      if (request !== requestRef.current) return;
      if (error) { console.error('Community feed error:', error); return; }
      if (data) {
        const enriched = (data as any[]).map(look => ({ ...look, user_id: look.gallery_user_key })) as CommunityLook[];
        setLooks(prev => uniqueGalleryLooks(reset ? enriched : [...prev, ...enriched]));
        pageRef.current = currentPage + 1;
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      if (request === requestRef.current) console.error('Community feed error:', error);
    } finally {
      if (request === requestRef.current) {
        fetchingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [sortBy]);

  useEffect(() => {
    void fetchLooks(true);
    return () => { requestRef.current++; fetchingRef.current = false; };
  }, [fetchLooks]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchLooks(false);
    }
  }, [fetchLooks, isLoading, hasMore]);

  const updateLookLikeCount = useCallback((lookId: string, newCount: number) => {
    setLooks(prev => prev.map(l => l.id === lookId ? { ...l, like_count: newCount } : l));
  }, []);

  const updateLookContent = useCallback((lookId: string, caption: string | null, tags: string[] | null) => {
    setLooks(prev => prev.map(l => l.id === lookId ? { ...l, caption, tags } : l));
  }, []);

  const removeLook = useCallback((lookId: string) => {
    setLooks(prev => prev.filter(l => l.id !== lookId));
  }, []);

  return {
    looks,
    isLoading,
    sortBy,
    setSortBy,
    hasMore,
    loadMore,
    updateLookLikeCount,
    updateLookContent,
    removeLook,
    refetch: () => fetchLooks(true),
  };
}
