import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, Camera, ArrowRight, Check, Sparkles } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

const styleOptions = [
  { id: 'minimal', label: '미니멀', emoji: '🤍' },
  { id: 'street', label: '스트릿', emoji: '🔥' },
  { id: 'classic', label: '클래식', emoji: '👔' },
  { id: 'casual', label: '캐주얼', emoji: '👕' },
  { id: 'sporty', label: '스포티', emoji: '⚡' },
  { id: 'bohemian', label: '보헤미안', emoji: '🌸' },
];

const bodyTypes = [
  { id: 'slim', label: '마른 체형' },
  { id: 'average', label: '보통 체형' },
  { id: 'muscular', label: '근육질' },
  { id: 'curvy', label: '볼륨 체형' },
];

const genderOptions = [
  { id: 'male', label: '남성', emoji: '👨' },
  { id: 'female', label: '여성', emoji: '👩' },
  { id: 'unisex', label: '유니섹스', emoji: '🧑' },
  { id: 'prefer_not_to_say', label: '선택 안함', emoji: '🔒' },
];

const ageGroupOptions = [
  { id: 'child', label: '아동 (12세 이하)', emoji: '👶' },
  { id: 'teen', label: '10대', emoji: '🧒' },
  { id: '20s', label: '20대', emoji: '🧑' },
  { id: '30s', label: '30대', emoji: '👨‍💼' },
  { id: '40s', label: '40대', emoji: '👨‍💼' },
  { id: '50s', label: '50대', emoji: '🧓' },
  { id: '60plus', label: '60대 이상', emoji: '👴' },
];

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [bodyType, setBodyType] = useState('');
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [existingAvatarPath, setExistingAvatarPath] = useState<string | null>(null);

  // 로그인 체크
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // 기존 프로필 데이터 로드 - 프로필이 완성되어 있으면 바로 스타일 페이지로 이동
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('height, weight, body_type, style_preferences, avatar_url, gender, age_group')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.error('Error loading profile:', error);
          setIsLoadingProfile(false);
          return;
        }
        
        if (profile) {
          // 프로필이 완성되어 있으면 바로 스타일 생성 페이지로 리다이렉트
          const isProfileComplete = profile.height && 
                                    profile.style_preferences && 
                                    profile.style_preferences.length > 0 &&
                                    profile.avatar_url;
          
          if (isProfileComplete) {
            navigate('/style');
            return;
          }
          
          // 기존 데이터로 폼 초기화 (프로필이 불완전한 경우에만)
          if (profile.height) setHeight(profile.height.toString());
          if (profile.weight) setWeight(profile.weight.toString());
          if (profile.body_type) setBodyType(profile.body_type);
          if (profile.gender) setGender(profile.gender);
          if (profile.age_group) setAgeGroup(profile.age_group);
          if (profile.style_preferences && profile.style_preferences.length > 0) {
            setSelectedStyles(profile.style_preferences);
          }
          
          // 기존 아바타 로드
          if (profile.avatar_url) {
            setExistingAvatarPath(profile.avatar_url);
            // Signed URL 생성하여 미리보기로 표시
            if (!profile.avatar_url.startsWith('http') && !profile.avatar_url.startsWith('data:')) {
              const { data: signedData } = await supabase.storage
                .from('avatars')
                .createSignedUrl(profile.avatar_url, 3600);
              if (signedData?.signedUrl) {
                setAvatarPreview(signedData.signedUrl);
              }
            } else {
              setAvatarPreview(profile.avatar_url);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    loadExistingProfile();
  }, [user, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev =>
      prev.includes(styleId)
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // 새 아바타 업로드 또는 기존 아바타 유지
      let avatarPath = existingAvatarPath; // 기존 아바타 경로 유지

      // Upload avatar if NEW file provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else if (data) {
          // Store the file path instead of public URL (bucket is now private)
          avatarPath = filePath;
        }
      }

      // Update profile - 아바타가 없어도 null이 아닌 기존값 유지
      const updateData: Record<string, any> = {
        height: height ? parseInt(height) : null,
        weight: weight ? parseInt(weight) : null,
        style_preferences: selectedStyles.length > 0 ? selectedStyles : null,
        body_type: bodyType || null,
        gender: gender || null,
        age_group: ageGroup || null,
      };
      
      // 아바타 경로가 있을 때만 업데이트 (없으면 기존값 유지)
      if (avatarPath !== null) {
        updateData.avatar_url = avatarPath;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: '프로필 설정 완료!',
        description: '이제 AI가 당신의 스타일을 만들어 드릴게요.',
      });

      navigate('/style');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: '오류',
        description: '프로필 저장 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return avatarPreview !== null;
    if (step === 2) return height && weight;
    if (step === 3) return selectedStyles.length > 0;
    return true;
  };

  if (loading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-korean">
          {isLoadingProfile ? '프로필 불러오는 중...' : '로딩 중...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header - using shared navigation with progress dots */}
      <MainNavigation 
        rightContent={
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-1 rounded-full transition-colors ${
                  s <= step ? 'bg-accent' : 'bg-border'
                }`}
              />
            ))}
          </div>
        }
      />

      <div className="pt-20 sm:pt-24 pb-12 px-6">
        <div className="container mx-auto max-w-lg">
          {/* Step 1: Photo Upload */}
          {step === 1 && (
            <div className="animate-fade-in-up">
              <h1 className="font-korean text-3xl text-foreground mb-2">사진을 업로드해주세요</h1>
              <p className="text-muted-foreground mb-8 font-korean">AI가 당신의 스타일을 분석합니다</p>

              <div className="mb-8">
                <label
                  htmlFor="avatar-upload"
                  className="block aspect-[3/4] max-w-xs mx-auto bg-secondary rounded-2xl border-2 border-dashed border-border hover:border-accent cursor-pointer transition-colors overflow-hidden group"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                        <Camera className="w-10 h-10 text-muted-foreground group-hover:text-accent transition-colors" />
                      </div>
                      <div className="text-center">
                        <p className="text-foreground font-medium font-korean">클릭하여 업로드</p>
                        <p className="text-sm text-muted-foreground mt-1 font-korean">전신 사진을 권장합니다</p>
                      </div>
                    </div>
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <Button
                variant="hero"
                size="xl"
                className="w-full font-korean"
                onClick={() => setStep(2)}
                disabled={!canProceed()}
              >
                다음
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Step 2: Body Measurements */}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <h1 className="font-korean text-3xl text-foreground mb-2">체형 정보를 알려주세요</h1>
              <p className="text-muted-foreground mb-8 font-korean">더 정확한 스타일링을 위해 필요해요</p>

              <div className="space-y-6 mb-8">
                <div className="space-y-2">
                  <Label htmlFor="height" className="font-korean">키 (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="170"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight" className="font-korean">몸무게 (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="65"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="font-korean">성별 (선택)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {genderOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setGender(option.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          gender === option.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <span className="text-xl mr-2">{option.emoji}</span>
                        <span className="text-foreground font-medium font-korean">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-korean">체형 (선택)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {bodyTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setBodyType(type.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          bodyType === type.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <span className="text-foreground font-medium font-korean">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-korean">연령대 (선택)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {ageGroupOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setAgeGroup(option.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          ageGroup === option.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <span className="text-xl mr-2">{option.emoji}</span>
                        <span className="text-foreground font-medium font-korean">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="minimal" size="xl" onClick={() => setStep(1)} className="flex-1 font-korean">
                  이전
                </Button>
                <Button
                  variant="hero"
                  size="xl"
                  className="flex-1 font-korean"
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                >
                  다음
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Style Preferences */}
          {step === 3 && (
            <div className="animate-fade-in-up">
              <h1 className="font-korean text-3xl text-foreground mb-2">선호하는 스타일을 선택하세요</h1>
              <p className="text-muted-foreground mb-8 font-korean">여러 개를 선택할 수 있어요</p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {styleOptions.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => toggleStyle(style.id)}
                    className={`p-5 rounded-xl border-2 transition-all text-left relative ${
                      selectedStyles.includes(style.id)
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {selectedStyles.includes(style.id) && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    <span className="text-2xl mb-2 block">{style.emoji}</span>
                    <span className="text-foreground font-medium font-korean">{style.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="minimal" size="xl" onClick={() => setStep(2)} className="flex-1 font-korean">
                  이전
                </Button>
                <Button
                  variant="gold"
                  size="xl"
                  className="flex-1 font-korean"
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                >
                  {isSubmitting ? '저장 중...' : '완료'}
                  <Sparkles className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
