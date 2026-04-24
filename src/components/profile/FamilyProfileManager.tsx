/**
 * FamilyProfileManager - 모델 프로필 관리 UI
 * 플래티넘 등급 전용: 누적 구매 100만원당 1명 추가 가능
 */

import { useState, useRef, useEffect } from 'react';
import { useFamilyProfiles, FamilyProfileInput } from '@/hooks/useFamilyProfiles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Pencil, Trash2, Camera, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface FamilyProfileManagerProps {
  userId: string;
  maxProfiles?: number;
}

export const FamilyProfileManager = ({ userId, maxProfiles = 5 }: FamilyProfileManagerProps) => {
  const { profiles, isLoading, canAddMore, currentCount, addProfile, updateProfile, deleteProfile, refetch } = useFamilyProfiles(userId, maxProfiles);
  const { toast } = useToast();
  const { t } = useLanguage();

  const relationships = [
    { value: '뮤즈', label: t('familyProfile.relationships.muse'), emoji: '✨' },
    { value: '파트너', label: t('familyProfile.relationships.partner'), emoji: '💫' },
    { value: '베스티', label: t('familyProfile.relationships.bestie'), emoji: '👯' },
    { value: '스타일 메이트', label: t('familyProfile.relationships.styleMate'), emoji: '🔥' },
    { value: '패밀리', label: t('familyProfile.relationships.family'), emoji: '🏠' },
  ];

  const genders = [
    { value: '남성', label: t('familyProfile.genders.male'), emoji: '👨' },
    { value: '여성', label: t('familyProfile.genders.female'), emoji: '👩' },
    { value: '유니섹스', label: t('familyProfile.genders.unisex'), emoji: '🧑' },
    { value: '선택안함', label: t('familyProfile.genders.preferNotToSay'), emoji: '🔒' },
  ];

  const bodyTypes = [
    { value: 'slim', label: t('profileSetup.bodyTypes.slim') },
    { value: 'average', label: t('profileSetup.bodyTypes.average') },
    { value: 'muscular', label: t('profileSetup.bodyTypes.muscular') },
    { value: 'curvy', label: t('profileSetup.bodyTypes.curvy') },
  ];

  const ageGroupOptions = [
    { value: 'child', label: t('profileSetup.ageGroups.child') },
    { value: 'teen', label: t('profileSetup.ageGroups.teen') },
    { value: '20s', label: t('profileSetup.ageGroups.twenties') },
    { value: '30s', label: t('profileSetup.ageGroups.thirties') },
    { value: '40s', label: t('profileSetup.ageGroups.forties') },
    { value: '50s', label: t('profileSetup.ageGroups.fifties') },
    { value: '60plus', label: t('profileSetup.ageGroups.sixtyPlus') },
  ];

  const styleOptions = [
    { value: 'casual', label: t('profileSetup.styles.casual') },
    { value: 'minimal', label: t('profileSetup.styles.minimal') },
    { value: 'street', label: t('profileSetup.styles.street') },
    { value: 'sporty', label: t('profileSetup.styles.sporty') },
    { value: 'classic', label: t('profileSetup.styles.classic') },
    { value: 'romantic', label: 'Romantic' },
    { value: 'modern', label: 'Modern' },
    { value: 'vintage', label: 'Vintage' },
  ];

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<FamilyProfileInput>({
    full_name: '',
    relationship: '',
    gender: '',
    height: undefined,
    weight: undefined,
    body_type: '',
    age_group: '',
    style_preferences: [],
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      relationship: '',
      gender: '',
      height: undefined,
      weight: undefined,
      body_type: '',
      age_group: '',
      style_preferences: [],
    });
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  const toggleStylePreference = (style: string) => {
    setFormData(prev => {
      const current = prev.style_preferences || [];
      if (current.includes(style)) {
        return { ...prev, style_preferences: current.filter(s => s !== style) };
      } else {
        return { ...prev, style_preferences: [...current, style] };
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: '이미지 파일만 업로드 가능해요',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '파일 크기는 5MB 이하여야 해요',
        variant: 'destructive',
      });
      return;
    }

    setAvatarFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (profileId: string): Promise<string | null> => {
    if (!avatarFile) return null;

    try {
      const fileExt = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      // Path must start with userId for RLS policy: auth.uid() = foldername(name)[1]
      const filePath = `${userId}/family-${profileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        throw uploadError;
      }

      return filePath;
    } catch (error) {
      console.error('Avatar upload error:', error);
      return null;
    }
  };

  const handleAdd = async () => {
    // 🔥 필수 필드 검증: 이름, 성별, 연령대
    if (!formData.full_name.trim()) {
      toast({
        title: '이름을 입력해주세요',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.gender) {
      toast({
        title: '성별을 선택해주세요',
        description: '정확한 스타일 추천을 위해 필요해요.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.age_group) {
      toast({
        title: '연령대를 선택해주세요',
        description: '연령에 맞는 스타일을 추천해드려요.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      // First, add the profile to get its ID
      const success = await addProfile(formData);
      
      if (success && avatarFile) {
        // Fetch the latest profile to get its ID
        const { data: newProfiles } = await supabase
          .from('family_profiles')
          .select('id')
          .eq('owner_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (newProfiles?.[0]) {
          const avatarPath = await uploadAvatar(newProfiles[0].id);
          if (avatarPath) {
            await updateProfile(newProfiles[0].id, { avatar_url: avatarPath });
          }
        }
      }

      if (success) {
        setIsAddDialogOpen(false);
        resetForm();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditAvatarUpload = async (profileId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: '이미지 파일만 업로드 가능해요',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '파일 크기는 5MB 이하여야 해요',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      // Path must start with userId for RLS policy: auth.uid() = foldername(name)[1]
      const filePath = `${userId}/family-${profileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      await updateProfile(profileId, { avatar_url: filePath });
      
      toast({
        title: '사진 업로드 완료',
        description: '프로필 사진이 업데이트되었어요.',
      });

      refetch();
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: '사진 업로드 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async (profileId: string) => {
    setIsUploading(true);
    try {
      if (avatarFile) {
        const avatarPath = await uploadAvatar(profileId);
        if (avatarPath) {
          await updateProfile(profileId, { ...formData, avatar_url: avatarPath });
        } else {
          await updateProfile(profileId, formData);
        }
      } else {
        await updateProfile(profileId, formData);
      }
      setEditingProfile(null);
      resetForm();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm('정말 삭제하시겠어요?')) return;
    await deleteProfile(profileId);
  };

  const openEditDialog = (profile: typeof profiles[0]) => {
    setFormData({
      full_name: profile.full_name,
      relationship: profile.relationship || '',
      gender: profile.gender || '',
      height: profile.height || undefined,
      weight: profile.weight || undefined,
      body_type: profile.body_type || '',
      age_group: profile.age_group || '',
      style_preferences: profile.style_preferences || [],
    });
    // Set avatar preview from existing avatar
    if (profile.avatar_url) {
      getSignedUrl(profile.avatar_url).then(url => {
        if (url) setAvatarPreview(url);
      });
    } else {
      setAvatarPreview(null);
    }
    setAvatarFile(null);
    setEditingProfile(profile.id);
  };

  const getSignedUrl = async (path: string): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    
    const { data } = await supabase.storage
      .from('avatars')
      .createSignedUrl(path, 3600);
    
    return data?.signedUrl || null;
  };

  // Get signed URLs for profile avatars
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  
  // Load signed URLs when profiles change
  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const profile of profiles) {
        if (profile.avatar_url) {
          const url = await getSignedUrl(profile.avatar_url);
          if (url) urls[profile.id] = url;
        }
      }
      setSignedUrls(urls);
    };
    
    if (profiles.length > 0) {
      loadUrls();
    }
  }, [profiles]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="font-korean text-base">추가 모델</CardTitle>
          </div>
          <Badge variant="secondary">
            {currentCount}/{maxProfiles}명
          </Badge>
        </div>
        <CardDescription className="font-korean">
          소중한 사람을 위한 스타일도 함께 만들어보세요
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Profile List */}
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border"
          >
            <div className="relative">
              <Avatar className="w-12 h-12">
                <AvatarImage src={signedUrls[profile.id] || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                  {profile.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Quick avatar upload button */}
              <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                <Camera className="w-3 h-3" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleEditAvatarUpload(profile.id, file);
                  }}
                  disabled={isUploading}
                />
              </label>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold font-korean">{profile.full_name}</span>
                {profile.relationship && (
                  <Badge variant="outline" className="text-xs">
                    {relationships.find(r => r.value === profile.relationship)?.emoji} {profile.relationship}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground font-korean">
                {profile.gender && <span>{profile.gender}</span>}
                {profile.height && <span> · {profile.height}cm</span>}
                {profile.weight && <span> · {profile.weight}kg</span>}
              </div>
              {/* Warning if no avatar */}
              {!profile.avatar_url && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3 h-3" />
                  <span className="font-korean">얼굴 합성에는 사진이 필요해요</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(profile)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(profile.id)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {profiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-korean">아직 등록된 모델이 없어요</p>
            <p className="text-sm font-korean">소중한 사람을 위한 스타일도 만들어보세요!</p>
          </div>
        )}

        {/* Add Button */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full font-korean"
              disabled={!canAddMore}
            >
              <Plus className="w-4 h-4 mr-2" />
              {canAddMore ? '모델 추가하기' : `최대 ${maxProfiles}명까지 추가 가능`}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-korean">모델 추가</DialogTitle>
              <DialogDescription className="font-korean">
                스타일을 만들어줄 분의 정보를 입력해주세요
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Avatar Upload Section */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 group-hover:border-primary transition-colors">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} />
                    ) : (
                      <AvatarFallback className="bg-muted">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <p className="text-xs text-muted-foreground font-korean text-center">
                  프로필 사진을 등록하면 얼굴 합성이 가능해요
                </p>
              </div>

              <div>
                <Label className="font-korean">이름 *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="이름을 입력하세요"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="font-korean">관계</Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relationship: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="관계 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.emoji} {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="font-korean">성별 <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="성별 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-korean">키 (cm)</Label>
                  <Input
                    type="number"
                    value={formData.height || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="170"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-korean">몸무게 (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="font-korean">체형</Label>
                <Select
                  value={formData.body_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, body_type: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="체형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyTypes.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-korean">연령대 <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.age_group}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, age_group: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="연령대 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroupOptions.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-korean">선호 스타일</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {styleOptions.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => toggleStylePreference(style.value)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        formData.style_preferences?.includes(style.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:border-primary/50'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 font-korean"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isUploading}
                >
                  취소
                </Button>
                <Button
                  variant="hero"
                  className="flex-1 font-korean"
                  onClick={handleAdd}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    '추가하기'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-korean">프로필 수정</DialogTitle>
              <DialogDescription className="font-korean">
                프로필 정보를 수정해주세요
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Avatar Upload Section */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => editFileInputRef.current?.click()}
                >
                  <Avatar className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 group-hover:border-primary transition-colors">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} />
                    ) : (
                      <AvatarFallback className="bg-muted">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <p className="text-xs text-muted-foreground font-korean text-center">
                  프로필 사진을 등록하면 얼굴 합성이 가능해요
                </p>
              </div>

              <div>
                <Label className="font-korean">이름 *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="이름을 입력하세요"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="font-korean">관계</Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relationship: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="관계 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.emoji} {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="font-korean">성별</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="성별 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-korean">키 (cm)</Label>
                  <Input
                    type="number"
                    value={formData.height || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="170"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-korean">몸무게 (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="font-korean">체형</Label>
                <Select
                  value={formData.body_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, body_type: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="체형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyTypes.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-korean">연령대</Label>
                <Select
                  value={formData.age_group}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, age_group: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="연령대 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroupOptions.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-korean">선호 스타일</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {styleOptions.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => toggleStylePreference(style.value)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        formData.style_preferences?.includes(style.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:border-primary/50'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 font-korean"
                  onClick={() => {
                    setEditingProfile(null);
                    resetForm();
                  }}
                  disabled={isUploading}
                >
                  취소
                </Button>
                <Button
                  variant="hero"
                  className="flex-1 font-korean"
                  onClick={() => editingProfile && handleUpdate(editingProfile)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    '저장하기'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};