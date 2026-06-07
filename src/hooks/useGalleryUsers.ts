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

    // 1. Fetch all public looks without exposing internal user IDs
    const { data: looks, error } = await supabase
      .from('generated_looks_public' as any)
      .select('gallery_user_key, image_url, like_count, user_name, user_avatar')
      .order('like_count', { ascending: false });

    if (error || !looks) {
      console.error('Gallery users fetch error:', error);
      setIsLoading(false);
      return;
    }

    // 2. Aggregate by user
    const userMap = new Map<string, { count: number; likes: number; images: string[]; full_name: string | null; avatar_url: string | null }>();
    for (const look of looks as any[]) {
      const existing = userMap.get(look.gallery_user_key);
      if (existing) {
        existing.count++;
        existing.likes += look.like_count;
        if (existing.images.length < 4) existing.images.push(look.image_url);
      } else {
        userMap.set(look.gallery_user_key, {
          count: 1,
          likes: look.like_count,
          images: [look.image_url],
          full_name: look.user_name,
          avatar_url: look.user_avatar,
        });
      }
    }

    const userIds = Array.from(userMap.keys());
    if (userIds.length === 0) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    // 3. Merge and sort by total likes
    const result: GalleryUser[] = userIds.map((uid) => {
      const stats = userMap.get(uid)!;
      return {
        user_id: uid,
        full_name: stats.full_name,
        avatar_url: stats.avatar_url,
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
