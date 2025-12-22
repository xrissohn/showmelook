import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Camera, ArrowLeft, Check, Save } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

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

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [bodyType, setBodyType] = useState('');
  const [gender, setGender] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setHeight(data.height?.toString() || '');
          setWeight(data.weight?.toString() || '');
          setSelectedStyles(data.style_preferences || []);
          setBodyType(data.body_type || '');
          setGender(data.gender || '');
          setCurrentAvatarUrl(data.avatar_url);
          setAvatarPreview(data.avatar_url);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: '오류',
          description: '프로필을 불러오는 중 문제가 발생했습니다.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, toast]);

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
      let avatarUrl = currentAvatarUrl;

      // Upload new avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          height: height ? parseInt(height) : null,
          weight: weight ? parseInt(weight) : null,
          style_preferences: selectedStyles,
          body_type: bodyType || null,
          gender: gender || null,
          avatar_url: avatarUrl,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: '프로필 수정 완료!',
        description: '변경 사항이 저장되었습니다.',
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

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate('/style')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>돌아가기</span>
          </button>
          <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
            <img src={showmelookLogo} alt="쇼미룩 로고" className="w-10 h-10 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[90px] object-contain -ml-3" />
          </button>
          <span className="font-display text-lg text-foreground">프로필 수정</span>
        </div>
      </header>

      <div className="pt-28 pb-12 px-6">
        <div className="container mx-auto max-w-lg space-y-8">
          {/* Photo Section */}
          <section className="animate-fade-in-up">
            <h2 className="font-display text-xl text-foreground mb-4">프로필 사진</h2>
            <div className="flex justify-center">
              <label
                htmlFor="avatar-upload"
                className="block w-40 h-40 bg-secondary rounded-full border-2 border-dashed border-border hover:border-accent cursor-pointer transition-colors overflow-hidden group"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <Camera className="w-8 h-8 text-muted-foreground group-hover:text-accent transition-colors" />
                    <span className="text-sm text-muted-foreground">사진 추가</span>
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
          </section>

          {/* Body Info Section */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="font-display text-xl text-foreground mb-4">체형 정보</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">키 (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="170"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">몸무게 (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="65"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>성별</Label>
                <div className="grid grid-cols-2 gap-3">
                  {genderOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setGender(option.id)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        gender === option.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <span className="text-lg mr-2">{option.emoji}</span>
                      <span className="text-foreground font-medium text-sm">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>체형</Label>
                <div className="grid grid-cols-2 gap-3">
                  {bodyTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setBodyType(type.id)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        bodyType === type.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <span className="text-foreground font-medium text-sm">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Style Preferences Section */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="font-display text-xl text-foreground mb-4">선호 스타일</h2>
            <div className="grid grid-cols-3 gap-3">
              {styleOptions.map((style) => (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-center relative ${
                    selectedStyles.includes(style.id)
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  {selectedStyles.includes(style.id) && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-xl block mb-1">{style.emoji}</span>
                  <span className="text-foreground font-medium text-sm">{style.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Save Button */}
          <div className="pt-4">
            <Button
              variant="gold"
              size="xl"
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : '변경 사항 저장'}
              <Save className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
