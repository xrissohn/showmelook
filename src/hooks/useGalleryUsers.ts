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

    // 1. Fetch public looks without exposing internal user IDs.
    // Counts/likes come from a light query (no image column); preview images come from a second query that
    // skips inline base64 images (a single one is >1MB and they used to be downloaded on every visit).
    const [statsRes, previewRes] = await Promise.all([
      supabase
        .from('generated_looks_public' as any)
        .select('gallery_user_key, like_count, user_name, user_avatar')
        .order('like_count', { ascending: false }),
      supabase
        .from('generated_looks_public' as any)
        .select('gallery_user_key, image_url, like_count')
        .not('image_url', 'like', 'data:%')
        .order('like_count', { ascending: false })
        .limit(400),
    ]);

    const looks = statsRes.data as any[] | null;
    const error = statsRes.error;
    if (error || !looks) {
      console.error('Gallery users fetch error:', error);
      setIsLoading(false);
      return;
    }

    // 2. Aggregate by user
    const userMap = new Map<string, { count: number; likes: number; images: string[]; full_name: string | null; avatar_url: string | null }>();
    for (const look of looks) {
      const existing = userMap.get(look.gallery_user_key);
      if (existing) {
        existing.count++;
        existing.likes += look.like_count;
      } else {
        userMap.set(look.gallery_user_key, {
          count: 1,
          likes: look.like_count,
          images: [],
          full_name: look.user_name,
          avatar_url: look.user_avatar,
        });
      }
    }
    for (const row of (previewRes.data ?? []) as any[]) {
      const u = userMap.get(row.gallery_user_key);
      if (u && u.images.length < 4 && row.image_url) u.images.push(row.image_url);
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
