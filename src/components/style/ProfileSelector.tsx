/**
 * ProfileSelector - 스타일 생성 시 프로필 선택 컴포넌트
 * Premium 사용자만 가족 프로필 선택 가능
 */

import { useState, useEffect } from 'react';
import { useFamilyProfiles, FamilyProfile } from '@/hooks/useFamilyProfiles';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown, User, ChevronDown, Check, Users, Lock } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface SelectedProfile {
  id: string;
  type: 'self' | 'family';
  full_name: string | null;
  avatar_url: string | null;
  height: number | null;
  weight: number | null;
  body_type: string | null;
  gender: string | null;
}

interface ProfileSelectorProps {
  userId: string | undefined;
  userProfile: {
    full_name: string | null;
    avatar_url: string | null;
    height: number | null;
    weight: number | null;
    body_type: string | null;
    gender: string | null;
  } | null;
  isPremium: boolean;
  canUseFamilyProfiles: boolean;
  selectedProfile: SelectedProfile | null;
  onProfileSelect: (profile: SelectedProfile) => void;
}

export const ProfileSelector = ({
  userId,
  userProfile,
  isPremium,
  canUseFamilyProfiles,
  selectedProfile,
  onProfileSelect,
}: ProfileSelectorProps) => {
  const { profiles: familyProfiles, isLoading } = useFamilyProfiles(userId, 5);
  const [isOpen, setIsOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // 프로필 아바타 URL에 서명 처리
  useEffect(() => {
    const signAvatarUrls = async () => {
      const urls: Record<string, string> = {};
      
      for (const profile of familyProfiles) {
        if (profile.avatar_url && !profile.avatar_url.startsWith('http') && !profile.avatar_url.startsWith('data:')) {
          const { data } = await supabase.storage
            .from('avatars')
            .createSignedUrl(profile.avatar_url, 3600);
          if (data?.signedUrl) {
            urls[profile.id] = data.signedUrl;
          }
        } else if (profile.avatar_url) {
          urls[profile.id] = profile.avatar_url;
        }
      }
      
      setSignedUrls(urls);
    };

    if (familyProfiles.length > 0) {
      signAvatarUrls();
    }
  }, [familyProfiles]);

  // 기본값으로 자신의 프로필 선택
  useEffect(() => {
    if (!selectedProfile && userProfile) {
      onProfileSelect({
        id: 'self',
        type: 'self',
        full_name: userProfile.full_name,
        avatar_url: userProfile.avatar_url,
        height: userProfile.height,
        weight: userProfile.weight,
        body_type: userProfile.body_type,
        gender: userProfile.gender,
      });
    }
  }, [userProfile, selectedProfile, onProfileSelect]);

  const handleSelectSelf = () => {
    if (userProfile) {
      onProfileSelect({
        id: 'self',
        type: 'self',
        full_name: userProfile.full_name,
        avatar_url: userProfile.avatar_url,
        height: userProfile.height,
        weight: userProfile.weight,
        body_type: userProfile.body_type,
        gender: userProfile.gender,
      });
      setIsOpen(false);
    }
  };

  const handleSelectFamily = (profile: FamilyProfile) => {
    onProfileSelect({
      id: profile.id,
      type: 'family',
      full_name: profile.full_name,
      avatar_url: signedUrls[profile.id] || profile.avatar_url,
      height: profile.height,
      weight: profile.weight,
      body_type: profile.body_type,
      gender: profile.gender,
    });
    setIsOpen(false);
  };

  // 프리미엄이 아니거나 가족 프로필을 사용할 수 없으면 심플 UI
  if (!canUseFamilyProfiles) {
    return (
      <div className="p-3 sm:p-4 rounded-xl border-2 border-dashed border-border bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-muted-foreground font-korean text-sm sm:text-base">가족/친구 프로필</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  <Crown className="w-3 h-3 mr-0.5 text-amber-500" />
                  Premium
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-korean truncate">
                프리미엄으로 업그레이드하면 가족/친구를 위한 스타일도 생성할 수 있어요
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentDisplayProfile = selectedProfile || {
    id: 'self',
    type: 'self' as const,
    full_name: userProfile?.full_name,
    avatar_url: userProfile?.avatar_url,
    height: userProfile?.height,
    weight: userProfile?.weight,
    body_type: userProfile?.body_type,
    gender: userProfile?.gender,
  };

  return (
    <div className="p-3 sm:p-4 rounded-xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center justify-between gap-2 hover:bg-accent/10 rounded-lg p-1 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative">
                <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-accent/30">
                  <AvatarImage src={currentDisplayProfile.avatar_url || undefined} />
                  <AvatarFallback className="bg-accent/20">
                    <User className="w-5 h-5 text-accent" />
                  </AvatarFallback>
                </Avatar>
                {currentDisplayProfile.type === 'family' && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                    <Users className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground font-korean text-sm sm:text-base truncate">
                    {currentDisplayProfile.full_name || '프로필 선택'}
                  </p>
                  <Badge 
                    variant="secondary" 
                    className={`text-[10px] px-1.5 py-0.5 ${
                      currentDisplayProfile.type === 'self' 
                        ? 'bg-accent/20 text-accent' 
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {currentDisplayProfile.type === 'self' ? '나' : '가족/친구'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-korean truncate">
                  누구를 위한 스타일을 생성할까요?
                </p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </PopoverTrigger>
        
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-1">
            {/* 나 (본인) */}
            <button
              onClick={handleSelectSelf}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                currentDisplayProfile.type === 'self' 
                  ? 'bg-accent/20' 
                  : 'hover:bg-muted'
              }`}
            >
              <Avatar className="w-10 h-10 border-2 border-accent/30">
                <AvatarImage src={userProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-accent/20">
                  <User className="w-5 h-5 text-accent" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium text-foreground font-korean text-sm truncate">
                  {userProfile?.full_name || '나'}
                </p>
                <p className="text-xs text-muted-foreground font-korean">본인</p>
              </div>
              {currentDisplayProfile.type === 'self' && (
                <Check className="w-5 h-5 text-accent flex-shrink-0" />
              )}
            </button>

            {/* 구분선 */}
            {familyProfiles.length > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-korean">가족/친구</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* 가족 프로필들 */}
            {isLoading ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground font-korean">로딩 중...</p>
              </div>
            ) : familyProfiles.length === 0 ? (
              <div className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground font-korean">
                  마이페이지에서 가족/친구 프로필을 추가해보세요
                </p>
              </div>
            ) : (
              familyProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleSelectFamily(profile)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    currentDisplayProfile.id === profile.id 
                      ? 'bg-primary/20' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="w-10 h-10 border-2 border-primary/30">
                    <AvatarImage src={signedUrls[profile.id] || undefined} />
                    <AvatarFallback className="bg-primary/20">
                      <User className="w-5 h-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-foreground font-korean text-sm truncate">
                      {profile.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-korean">
                      {profile.relationship || '가족/친구'}
                      {profile.gender && ` · ${profile.gender}`}
                    </p>
                  </div>
                  {currentDisplayProfile.id === profile.id && (
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
