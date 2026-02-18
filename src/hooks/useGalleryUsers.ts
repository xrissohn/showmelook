import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GalleryUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  public_look_count: number;
  total_likes: number;
  preview_images: string[];
}

export function useGalleryUsers() {
  const [users, setUsers] = useState<GalleryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGalleryUsers = useCallback(async () => {
    setIsLoading(true);

    // 1. Fetch all public looks
    const { data: looks, error } = await supabase
      .from('generated_looks')
      .select('user_id, image_url, like_count')
      .eq('is_public', true)
      .order('like_count', { ascending: false });

    if (error || !looks) {
      console.error('Gallery users fetch error:', error);
      setIsLoading(false);
      return;
    }

    // 2. Aggregate by user
    const userMap = new Map<string, { count: number; likes: number; images: string[] }>();
    for (const look of looks) {
      const existing = userMap.get(look.user_id);
      if (existing) {
        existing.count++;
        existing.likes += look.like_count;
        if (existing.images.length < 4) existing.images.push(look.image_url);
      } else {
        userMap.set(look.user_id, {
          count: 1,
          likes: look.like_count,
          images: [look.image_url],
        });
      }
    }

    const userIds = Array.from(userMap.keys());
    if (userIds.length === 0) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    // 3. Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles_public' as any)
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (profiles) {
      for (const p of profiles as any[]) {
        profileMap.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url });
      }
    }

    // 4. Merge and sort by total likes
    const result: GalleryUser[] = userIds.map((uid) => {
      const stats = userMap.get(uid)!;
      const profile = profileMap.get(uid);
      return {
        user_id: uid,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        public_look_count: stats.count,
        total_likes: stats.likes,
        preview_images: stats.images,
      };
    });

    result.sort((a, b) => b.total_likes - a.total_likes);
    setUsers(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchGalleryUsers();
  }, [fetchGalleryUsers]);

  return { users, isLoading };
}
