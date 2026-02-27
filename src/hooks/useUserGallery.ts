import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface GalleryLook {
  id: string;
  image_url: string;
  like_count: number;
  view_count: number;
  caption: string | null;
  tags: string[] | null;
  created_at: string;
  is_public: boolean;
  prompt_used: string | null;
  product_ids: string[] | null;
  style_reasoning: string | null;
}

export interface UserGalleryData {
  profile: { full_name: string | null; avatar_url: string | null };
  looks: GalleryLook[];
  publicCount: number;
  totalLikes: number;
  isOwner: boolean;
}

export type VisibilityFilter = 'all' | 'public' | 'private';

export function useUserGallery(userId: string | undefined) {
  const { user } = useAuth();
  const [data, setData] = useState<UserGalleryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<VisibilityFilter>('all');

  const isOwner = !!user && user.id === userId;

  const fetchGallery = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles_public' as any)
      .select('full_name, avatar_url')
      .eq('user_id', userId)
      .single();

    // Fetch looks - RLS handles visibility (public OR own)
    const { data: looks, error } = await supabase
      .from('generated_looks')
      .select('id, image_url, like_count, view_count, caption, tags, created_at, is_public, prompt_used, product_ids, style_reasoning')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('User gallery fetch error:', error);
      setIsLoading(false);
      return;
    }

    const allLooks = (looks || []) as GalleryLook[];
    const publicCount = allLooks.filter((l) => l.is_public).length;
    const totalLikes = allLooks.reduce((sum, l) => sum + l.like_count, 0);

    setData({
      profile: {
        full_name: (profileData as any)?.full_name ?? null,
        avatar_url: (profileData as any)?.avatar_url ?? null,
      },
      looks: allLooks,
      publicCount,
      totalLikes,
      isOwner,
    });
    setIsLoading(false);
  }, [userId, isOwner]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const togglePublic = useCallback(async (lookId: string, currentPublic: boolean) => {
    const newPublic = !currentPublic;
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.looks.map((l) =>
        l.id === lookId ? { ...l, is_public: newPublic } : l
      );
      const publicCount = updated.filter((l) => l.is_public).length;
      return { ...prev, looks: updated, publicCount };
    });

    await supabase
      .from('generated_looks')
      .update({ is_public: newPublic })
      .eq('id', lookId);
  }, []);

  const bulkToggle = useCallback(async (makePublic: boolean) => {
    if (!data) return;
    const ids = data.looks.map((l) => l.id);
    
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.looks.map((l) => ({ ...l, is_public: makePublic }));
      return { ...prev, looks: updated, publicCount: makePublic ? updated.length : 0 };
    });

    await supabase
      .from('generated_looks')
      .update({ is_public: makePublic })
      .in('id', ids);
  }, [data]);

  const filteredLooks = data?.looks.filter((l) => {
    if (filter === 'public') return l.is_public;
    if (filter === 'private') return !l.is_public;
    return true;
  }) ?? [];

  return {
    data,
    isLoading,
    isOwner,
    filter,
    setFilter,
    filteredLooks,
    togglePublic,
    bulkToggle,
  };
}
