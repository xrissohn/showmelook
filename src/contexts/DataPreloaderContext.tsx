import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { preloadImages } from '@/hooks/useImagePreloader';

// 글로벌 캐시 (컴포넌트 외부에서 유지)
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

interface GeneratedLook {
  id: string;
  image_url: string;
  prompt_used: string | null;
  is_favorite: boolean;
  created_at: string;
  style_trend_id: string | null;
  product_ids: string[] | null;
  memo?: string | null;
  tags?: string[] | null;
  style_reasoning?: string | null;
  tag_positions?: any;
}

interface DataCache {
  profile: { data: UserProfile | null; timestamp: number } | null;
  looks: { data: GeneratedLook[]; timestamp: number } | null;
}

// 싱글톤 글로벌 캐시 - 앱 전체에서 공유
const globalCache: DataCache = {
  profile: null,
  looks: null,
};

const PROFILE_CACHE_DURATION = 10 * 60 * 1000; // 10분
const LOOKS_CACHE_DURATION = 5 * 60 * 1000; // 5분

interface DataPreloaderContextType {
  profile: UserProfile | null;
  looks: GeneratedLook[];
  isProfileLoading: boolean;
  isLooksLoading: boolean;
  isPreloading: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
  refreshLooks: () => Promise<GeneratedLook[]>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setProfileDirect: (profile: UserProfile) => void;
  addLook: (look: GeneratedLook) => void;
  removeLook: (lookId: string) => void;
  invalidateAll: () => void;
}

const DataPreloaderContext = createContext<DataPreloaderContextType | undefined>(undefined);

export function DataPreloaderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(globalCache.profile?.data || null);
  const [looks, setLooks] = useState<GeneratedLook[]>(globalCache.looks?.data || []);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isLooksLoading, setIsLooksLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  
  const preloadedRef = useRef(false);

  // 프로필 로드
  const fetchProfile = useCallback(async (forceRefresh = false): Promise<UserProfile | null> => {
    if (!user) {
      setProfile(null);
      globalCache.profile = null;
      return null;
    }

    // 캐시 확인
    if (!forceRefresh && globalCache.profile) {
      const now = Date.now();
      if (now - globalCache.profile.timestamp < PROFILE_CACHE_DURATION) {
        setProfile(globalCache.profile.data);
        return globalCache.profile.data;
      }
    }

    setIsProfileLoading(true);
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

      // Avatar Signed URL 생성
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
      globalCache.profile = { data: processedProfile, timestamp: Date.now() };
      
      // 아바타 이미지 프리로드
      if (avatarDisplayUrl) {
        preloadImages([avatarDisplayUrl]).catch(() => {});
      }

      return processedProfile;
    } catch (err) {
      console.error('Error preloading profile:', err);
      return null;
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]);

  // 룩 로드
  const fetchLooks = useCallback(async (forceRefresh = false): Promise<GeneratedLook[]> => {
    if (!user) {
      setLooks([]);
      globalCache.looks = null;
      return [];
    }

    // 캐시 확인
    if (!forceRefresh && globalCache.looks) {
      const now = Date.now();
      if (now - globalCache.looks.timestamp < LOOKS_CACHE_DURATION) {
        setLooks(globalCache.looks.data);
        return globalCache.looks.data;
      }
    }

    setIsLooksLoading(true);
    try {
      const { data: looksData, error: looksError } = await supabase
        .from('generated_looks')
        .select('id, image_url, prompt_used, is_favorite, created_at, style_trend_id, product_ids, memo, tags')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);


      if (looksError) throw looksError;
      if (!looksData || looksData.length === 0) {
        setLooks([]);
        globalCache.looks = { data: [], timestamp: Date.now() };
        return [];
      }

      // Public bucket이므로 직접 URL 사용 (signed URL 불필요)
      const looksWithUrls: GeneratedLook[] = looksData.map((look) => {
        let imageUrl = look.image_url;
        // Public bucket URL 생성 (signed URL 대신)
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
          const { data } = supabase.storage.from('generated-looks').getPublicUrl(imageUrl);
          imageUrl = data.publicUrl;
        }
        return {
          ...look,
          image_url: imageUrl,
        };
      });

      setLooks(looksWithUrls);
      globalCache.looks = { data: looksWithUrls, timestamp: Date.now() };

      // 이미지 프리로드 (처음 6개만 - 갤러리 첫 화면)
      const imagesToPreload = looksWithUrls.slice(0, 6).map(l => l.image_url).filter(Boolean);
      if (imagesToPreload.length > 0) {
        preloadImages(imagesToPreload).catch(() => {});
      }

      return looksWithUrls;
    } catch (err) {
      console.error('Error preloading looks:', err);
      return [];
    } finally {
      setIsLooksLoading(false);
    }
  }, [user]);

  // 프로필 업데이트
  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      if (globalCache.profile) {
        globalCache.profile.data = updated;
        globalCache.profile.timestamp = Date.now();
      }
      return updated;
    });
  }, []);

  // 프로필 직접 세팅 (ProfileSetup에서 저장 후 즉시 캐시에 주입)
  const setProfileDirect = useCallback((newProfile: UserProfile) => {
    setProfile(newProfile);
    globalCache.profile = { data: newProfile, timestamp: Date.now() };
    setIsProfileLoading(false);
    // 아바타 이미지 프리로드
    if (newProfile.avatar_url) {
      preloadImages([newProfile.avatar_url]).catch(() => {});
    }
  }, []);

  // 룩 추가
  const addLook = useCallback((newLook: GeneratedLook) => {
    setLooks(prev => {
      const updated = [newLook, ...prev];
      if (globalCache.looks) {
        globalCache.looks.data = updated;
        globalCache.looks.timestamp = Date.now();
      }
      return updated;
    });
  }, []);

  // 룩 삭제
  const removeLook = useCallback((lookId: string) => {
    setLooks(prev => {
      const updated = prev.filter(look => look.id !== lookId);
      if (globalCache.looks) {
        globalCache.looks.data = updated;
      }
      return updated;
    });
  }, []);

  // 캐시 무효화
  const invalidateAll = useCallback(() => {
    globalCache.profile = null;
    globalCache.looks = null;
    preloadedRef.current = false;
  }, []);

  // 로그인 시 백그라운드 프리로드
  useEffect(() => {
    if (user && !preloadedRef.current) {
      preloadedRef.current = true;
      setIsPreloading(true);
      
      // 병렬로 프로필과 룩 데이터 로드
      Promise.all([
        fetchProfile(),
        fetchLooks()
      ]).finally(() => {
        setIsPreloading(false);
      });
    } else if (!user) {
      // 로그아웃 시 초기화
      setProfile(null);
      setLooks([]);
      globalCache.profile = null;
      globalCache.looks = null;
      preloadedRef.current = false;
    }
  }, [user, fetchProfile, fetchLooks]);

  return (
    <DataPreloaderContext.Provider
      value={{
        profile,
        looks,
        isProfileLoading,
        isLooksLoading,
        isPreloading,
        refreshProfile: () => fetchProfile(true),
        refreshLooks: () => fetchLooks(true),
        updateProfile,
        setProfileDirect,
        addLook,
        removeLook,
        invalidateAll,
      }}
    >
      {children}
    </DataPreloaderContext.Provider>
  );
}

export function usePreloadedData() {
  const context = useContext(DataPreloaderContext);
  if (context === undefined) {
    throw new Error('usePreloadedData must be used within a DataPreloaderProvider');
  }
  return context;
}

// 기존 훅과의 호환성을 위한 래퍼
export function usePreloadedProfile() {
  const { profile, isProfileLoading, refreshProfile, updateProfile } = usePreloadedData();
  return {
    profile,
    isLoading: isProfileLoading,
    error: null,
    refetch: refreshProfile,
    updateProfile,
    invalidateCache: () => {},
  };
}

export function usePreloadedLooks() {
  const { looks, isLooksLoading, refreshLooks, addLook, removeLook } = usePreloadedData();
  return {
    looks,
    isLoading: isLooksLoading,
    error: null,
    refetch: refreshLooks,
    addLook,
    removeLook,
    invalidateCache: () => {},
  };
}
