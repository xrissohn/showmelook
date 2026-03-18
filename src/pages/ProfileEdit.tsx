import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Camera, Check, Save } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
import { useLanguage } from '@/contexts/LanguageContext';

const ProfileEdit = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

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

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [bodyType, setBodyType] = useState('');
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
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
          setAgeGroup((data as any).age_group || '');
          setCurrentAvatarUrl(data.avatar_url);
          
          if (data.avatar_url) {
            if (!data.avatar_url.startsWith('http')) {
              const { data: signedData } = await supabase.storage
                .from('avatars')
                .createSignedUrl(data.avatar_url, 3600);
              setAvatarPreview(signedData?.signedUrl || null);
            } else {
              setAvatarPreview(data.avatar_url);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: t('profileEdit.error'),
          description: t('profileEdit.loadError'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, toast, t]);

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
      let avatarPath = currentAvatarUrl;

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

      const { error } = await supabase
        .from('profiles')
        .update({
          height: height ? parseInt(height) : null,
          weight: weight ? parseInt(weight) : null,
          style_preferences: selectedStyles,
          body_type: bodyType || null,
          gender: gender || null,
          age_group: ageGroup || null,
          avatar_url: avatarPath,
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('profileEdit.saveComplete'),
        description: t('profileEdit.changesSaved'),
      });

      navigate('/style');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('profileEdit.error'),
        description: t('profileEdit.saveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-korean">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <MainNavigation 
        showBackButton
        rightContent={
          <span className="font-korean text-lg text-foreground">{t('profileEdit.title')}</span>
        }
      />

      <div className="pt-20 sm:pt-24 pb-12 px-6">
        <div className="container mx-auto max-w-lg space-y-8">
          {/* Photo Section */}
          <section className="animate-fade-in-up">
            <h2 className="font-korean text-xl text-foreground mb-4">{t('profileEdit.profilePhoto')}</h2>
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
                    <span className="text-sm text-muted-foreground font-korean">{t('profileEdit.addPhoto')}</span>
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
            <h2 className="font-korean text-xl text-foreground mb-4">{t('profileEdit.bodyInfo')}</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height" className="font-korean">{t('profileSetup.height')}</Label>
                  <Input id="height" type="number" placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight" className="font-korean">{t('profileSetup.weight')}</Label>
                  <Input id="weight" type="number" placeholder="65" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-korean">{t('profileSetup.gender')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {genderOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setGender(option.id)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        gender === option.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                      }`}
                    >
                        <span className="text-lg mr-2">{option.emoji}</span>
                        <span className="text-foreground font-medium text-sm font-korean">{option.label}</span>
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
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        bodyType === type.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <span className="text-foreground font-medium text-sm font-korean">{type.label}</span>
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
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        ageGroup === option.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <span className="text-lg mr-2">{option.emoji}</span>
                      <span className="text-foreground font-medium text-sm font-korean">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Style Preferences Section */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="font-korean text-xl text-foreground mb-4">{t('profileEdit.preferredStyle')}</h2>
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
                  <span className="text-foreground font-medium text-sm font-korean">{style.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Save Button */}
          <div className="pt-4">
            <Button
              variant="gold"
              size="xl"
              className="w-full font-korean"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('profileEdit.saving') : t('profileEdit.save')}
              <Save className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
