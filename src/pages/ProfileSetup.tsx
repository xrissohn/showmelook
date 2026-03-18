import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePreloadedData } from '@/contexts/DataPreloaderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, Camera, ArrowRight, Check, Sparkles } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
import { SEOHead } from '@/components/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';

const ProfileSetup = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { setProfileDirect } = usePreloadedData();

  const styleOptions = [
    { id: 'minimal', label: t('profileSetup.styles.minimal'), emoji: '🤍' },
    { id: 'street', label: t('profileSetup.styles.street'), emoji: '🔥' },
    { id: 'classic', label: t('profileSetup.styles.classic'), emoji: '👔' },
    { id: 'casual', label: t('profileSetup.styles.casual'), emoji: '👕' },
    { id: 'sporty', label: t('profileSetup.styles.sporty'), emoji: '⚡' },
    { id: 'bohemian', label: t('profileSetup.styles.bohemian'), emoji: '🌸' },
  ];

  const bodyTypes = [
    { id: 'slim', label: t('profileSetup.bodyTypes.slim') },
    { id: 'average', label: t('profileSetup.bodyTypes.average') },
    { id: 'muscular', label: t('profileSetup.bodyTypes.muscular') },
    { id: 'curvy', label: t('profileSetup.bodyTypes.curvy') },
  ];

  const genderOptions = [
    { id: 'male', label: t('profileSetup.genderOptions.male'), emoji: '👨' },
    { id: 'female', label: t('profileSetup.genderOptions.female'), emoji: '👩' },
    { id: 'unisex', label: t('profileSetup.genderOptions.unisex'), emoji: '🧑' },
    { id: 'prefer_not_to_say', label: t('profileSetup.genderOptions.preferNotToSay'), emoji: '🔒' },
  ];

  const ageGroupOptions = [
    { id: 'child', label: t('profileSetup.ageGroups.child'), emoji: '👶' },
    { id: 'teen', label: t('profileSetup.ageGroups.teen'), emoji: '🧒' },
    { id: '20s', label: t('profileSetup.ageGroups.twenties'), emoji: '🧑' },
    { id: '30s', label: t('profileSetup.ageGroups.thirties'), emoji: '👨‍💼' },
    { id: '40s', label: t('profileSetup.ageGroups.forties'), emoji: '👨‍💼' },
    { id: '50s', label: t('profileSetup.ageGroups.fifties'), emoji: '🧓' },
    { id: '60plus', label: t('profileSetup.ageGroups.sixtyPlus'), emoji: '👴' },
  ];

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

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
          const isProfileComplete = profile.height && 
                                    profile.style_preferences && 
                                    profile.style_preferences.length > 0 &&
                                    profile.avatar_url;
          
          if (isProfileComplete) {
            navigate('/style');
            return;
          }
          
          if (profile.height) setHeight(profile.height.toString());
          if (profile.weight) setWeight(profile.weight.toString());
          if (profile.body_type) setBodyType(profile.body_type);
          if (profile.gender) setGender(profile.gender);
          if (profile.age_group) setAgeGroup(profile.age_group);
          if (profile.style_preferences && profile.style_preferences.length > 0) {
            setSelectedStyles(profile.style_preferences);
          }
          
          if (profile.avatar_url) {
            setExistingAvatarPath(profile.avatar_url);
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
      let avatarPath = existingAvatarPath;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else if (data) {
          avatarPath = filePath;
        }
      }

      const updateData: Record<string, any> = {
        height: height ? parseInt(height) : null,
        weight: weight ? parseInt(weight) : null,
        style_preferences: selectedStyles.length > 0 ? selectedStyles : null,
        body_type: bodyType || null,
        gender: gender || null,
        age_group: ageGroup || null,
      };
      
      if (avatarPath !== null) {
        updateData.avatar_url = avatarPath;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      let avatarDisplayUrl = avatarPreview;
      if (avatarPath && !avatarPreview?.startsWith('http') && !avatarPreview?.startsWith('data:')) {
        const { data: signedData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(avatarPath, 3600);
        if (signedData?.signedUrl) {
          avatarDisplayUrl = signedData.signedUrl;
        }
      }

      setProfileDirect({
        height: height ? parseInt(height) : null,
        weight: weight ? parseInt(weight) : null,
        body_type: bodyType || null,
        style_preferences: selectedStyles.length > 0 ? selectedStyles : null,
        avatar_url: avatarDisplayUrl || null,
        full_name: null,
        gender: gender || null,
        age_group: ageGroup || null,
      });

      toast({
        title: t('profileSetup.profileComplete'),
        description: t('profileSetup.aiWillCreate'),
      });

      navigate('/style');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('common.error'),
        description: t('profileEdit.saveError'),
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
          {isLoadingProfile ? t('profileSetup.loadingProfile') : t('profileSetup.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SEOHead pageKey="profileSetup" />
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
              <h1 className="font-korean text-3xl text-foreground mb-2">{t('profileSetup.uploadPhoto')}</h1>
              <p className="text-muted-foreground mb-8 font-korean">{t('profileSetup.aiAnalyze')}</p>

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
                        <p className="text-foreground font-medium font-korean">{t('profileSetup.clickUpload')}</p>
                        <p className="text-sm text-muted-foreground mt-1 font-korean">{t('profileSetup.fullBodyRecommend')}</p>
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
                {t('profileSetup.next')}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Step 2: Body Measurements */}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <h1 className="font-korean text-3xl text-foreground mb-2">{t('profileSetup.bodyInfo')}</h1>
              <p className="text-muted-foreground mb-8 font-korean">{t('profileSetup.bodyInfoDesc')}</p>

              <div className="space-y-6 mb-8">
                <div className="space-y-2">
                  <Label htmlFor="height" className="font-korean">{t('profileSetup.height')}</Label>
                  <Input id="height" type="number" placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight" className="font-korean">{t('profileSetup.weight')}</Label>
                  <Input id="weight" type="number" placeholder="65" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>

                <div className="space-y-3">
                  <Label className="font-korean">{t('profileSetup.gender')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {genderOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setGender(option.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          gender === option.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <span className="text-xl mr-2">{option.emoji}</span>
                        <span className="text-foreground font-medium font-korean">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-korean">{t('profileSetup.bodyType')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {bodyTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setBodyType(type.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          bodyType === type.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <span className="text-foreground font-medium font-korean">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-korean">{t('profileSetup.ageGroup')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {ageGroupOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setAgeGroup(option.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          ageGroup === option.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
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
                  {t('profileSetup.previous')}
                </Button>
                <Button
                  variant="hero"
                  size="xl"
                  className="flex-1 font-korean"
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                >
                  {t('profileSetup.next')}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Style Preferences */}
          {step === 3 && (
            <div className="animate-fade-in-up">
              <h1 className="font-korean text-3xl text-foreground mb-2">{t('profileSetup.selectStyle')}</h1>
              <p className="text-muted-foreground mb-8 font-korean">{t('profileSetup.selectMultiple')}</p>

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
                  {t('profileSetup.previous')}
                </Button>
                <Button
                  variant="gold"
                  size="xl"
                  className="flex-1 font-korean"
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                >
                  {isSubmitting ? t('profileSetup.saving') : t('profileSetup.complete')}
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
