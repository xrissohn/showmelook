import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserProfile {
  height: number | null;
  weight: number | null;
  body_type: string | null;
  style_preferences: string[] | null;
  avatar_url: string | null;
  full_name: string | null;
  gender: string | null;
  age_group: string | null;
}

export function useUserProfile() {
  // 모든 useState를 조건문 전에 선언 (React 훅 규칙)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<{ data: UserProfile; timestamp: number } | null>(null);
  const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시

  // useAuth를 useState 이후에 호출
  const { user } = useAuth();

  const fetchProfile = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setProfile(null);
      return null;
    }

    // 캐시가 유효하고 강제 새로고침이 아니면 캐시 사용
    if (!forceRefresh && cacheRef.current) {
      const now = Date.now();
      if (now - cacheRef.current.timestamp < CACHE_DURATION) {
        setProfile(cacheRef.current.data);
        return cacheRef.current.data;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('height, weight, body_type, style_preferences, avatar_url, full_name, gender, age_group')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profileData) {
        setProfile(null);
        return null;
      }

      // Avatar Signed URL 생성 (필요시)
      let avatarDisplayUrl = profileData.avatar_url;
      if (profileData.avatar_url && !profileData.avatar_url.startsWith('http') && !profileData.avatar_url.startsWith('data:')) {
        const { data: signedData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(profileData.avatar_url, 3600);
        avatarDisplayUrl = signedData?.signedUrl || profileData.avatar_url;
      }

      const processedProfile: UserProfile = {
        ...profileData,
        avatar_url: avatarDisplayUrl,
      };

      setProfile(processedProfile);
      cacheRef.current = { data: processedProfile, timestamp: Date.now() };
      return processedProfile;
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 프로필 업데이트 시 캐시도 업데이트
  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      if (cacheRef.current) {
        cacheRef.current.data = updated;
        cacheRef.current.timestamp = Date.now();
      }
      return updated;
    });
  }, []);

  // 캐시 무효화
  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  // 초기 로딩
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: () => fetchProfile(true),
    updateProfile,
    invalidateCache,
  };
}
