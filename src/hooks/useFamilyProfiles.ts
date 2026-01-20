/**
 * useFamilyProfiles - 가족 프로필 관리 훅
 * Premium 전용 기능: 최대 5명 추가 가능
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FamilyProfile {
  id: string;
  owner_user_id: string;
  full_name: string;
  relationship: string | null;
  avatar_url: string | null;
  height: number | null;
  weight: number | null;
  body_type: string | null;
  gender: string | null;
  age_group: string | null;
  style_preferences: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyProfileInput {
  full_name: string;
  relationship?: string;
  avatar_url?: string;
  height?: number;
  weight?: number;
  body_type?: string;
  gender?: string;
  age_group?: string;
  style_preferences?: string[];
}

export const useFamilyProfiles = (userId: string | undefined, maxProfiles: number = 5) => {
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfiles = useCallback(async () => {
    if (!userId) {
      setProfiles([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('family_profiles')
        .select('*')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching family profiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const addProfile = useCallback(async (input: FamilyProfileInput): Promise<boolean> => {
    if (!userId) return false;

    if (profiles.length >= maxProfiles) {
      toast({
        title: '프로필 추가 불가',
        description: `가족 프로필은 최대 ${maxProfiles}명까지만 추가할 수 있어요.`,
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('family_profiles')
        .insert({
          owner_user_id: userId,
          full_name: input.full_name,
          relationship: input.relationship || null,
          avatar_url: input.avatar_url || null,
          height: input.height || null,
          weight: input.weight || null,
          body_type: input.body_type || null,
          gender: input.gender || null,
          age_group: input.age_group || null,
          style_preferences: input.style_preferences || null,
        });

      if (error) throw error;

      toast({
        title: '프로필 추가 완료',
        description: `${input.full_name}님의 프로필이 추가되었어요.`,
      });

      await fetchProfiles();
      return true;
    } catch (error) {
      console.error('Error adding family profile:', error);
      toast({
        title: '프로필 추가 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
      return false;
    }
  }, [userId, profiles.length, maxProfiles, toast, fetchProfiles]);

  const updateProfile = useCallback(async (profileId: string, input: Partial<FamilyProfileInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('family_profiles')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: '프로필 수정 완료',
        description: '프로필이 업데이트되었어요.',
      });

      await fetchProfiles();
      return true;
    } catch (error) {
      console.error('Error updating family profile:', error);
      toast({
        title: '프로필 수정 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchProfiles]);

  const deleteProfile = useCallback(async (profileId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('family_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: '프로필 삭제 완료',
        description: '가족 프로필이 삭제되었어요.',
      });

      await fetchProfiles();
      return true;
    } catch (error) {
      console.error('Error deleting family profile:', error);
      toast({
        title: '프로필 삭제 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchProfiles]);

  return {
    profiles,
    isLoading,
    canAddMore: profiles.length < maxProfiles,
    currentCount: profiles.length,
    maxCount: maxProfiles,
    addProfile,
    updateProfile,
    deleteProfile,
    refetch: fetchProfiles,
  };
};
