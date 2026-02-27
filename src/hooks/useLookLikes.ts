import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function useLookLikes(lookIds: string[]) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [likedLookIds, setLikedLookIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's likes for given look IDs
  useEffect(() => {
    if (!user || lookIds.length === 0) {
      setLikedLookIds(new Set());
      return;
    }

    const fetchLikes = async () => {
      const { data } = await supabase
        .from('look_likes')
        .select('look_id')
        .eq('user_id', user.id)
        .in('look_id', lookIds);

      if (data) {
        setLikedLookIds(new Set(data.map(d => d.look_id)));
      }
    };

    fetchLikes();
  }, [user, lookIds.join(',')]);

  const toggleLike = useCallback(async (lookId: string, currentLikeCount: number): Promise<{ liked: boolean; newCount: number } | null> => {
    if (!user) {
      toast({
        title: '로그인 필요',
        description: '좋아요를 하려면 로그인이 필요합니다.',
        variant: 'destructive',
      });
      return null;
    }

    const isLiked = likedLookIds.has(lookId);
    const newLiked = !isLiked;
    const newCount = currentLikeCount + (newLiked ? 1 : -1);

    // Optimistic update
    setLikedLookIds(prev => {
      const next = new Set(prev);
      if (newLiked) next.add(lookId);
      else next.delete(lookId);
      return next;
    });

    try {
      if (newLiked) {
        const { error } = await supabase
          .from('look_likes')
          .upsert({ user_id: user.id, look_id: lookId }, { onConflict: 'user_id,look_id', ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('look_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('look_id', lookId);
        if (error) throw error;
      }

      // Recalculate actual count from look_likes table
      const { count } = await supabase
        .from('look_likes')
        .select('*', { count: 'exact', head: true })
        .eq('look_id', lookId);

      const actualCount = count ?? Math.max(0, newCount);

      await supabase
        .from('generated_looks')
        .update({ like_count: actualCount })
        .eq('id', lookId);

      return { liked: newLiked, newCount: actualCount };
    } catch (error) {
      // Rollback
      setLikedLookIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(lookId);
        else next.delete(lookId);
        return next;
      });
      console.error('Like toggle error:', error);
      return null;
    }
  }, [user, likedLookIds, toast]);

  return { likedLookIds, toggleLike, isLoading };
}
