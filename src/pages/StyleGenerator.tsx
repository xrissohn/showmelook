import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useGenerationLimit } from '@/hooks/useGenerationLimit';
import { ShoppingBag, Heart, LogOut, ChevronRight, Loader2, User, Camera, Check, Zap, Crown, Settings } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

interface StyleTrend {
  id: string;
  name: string;
  name_ko: string;
  description: string | null;
  image_url: string | null;
  tags: string[] | null;
}

interface Product {
  id: string;
  name: string;
  name_ko: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  brand: string | null;
  external_url: string | null;
  tags: string[] | null;
}

interface GeneratedLook {
  id: string;
  image_url: string;
  is_favorite: boolean;
  created_at: string;
}

interface UserProfile {
  height: number | null;
  weight: number | null;
  body_type: string | null;
  style_preferences: string[] | null;
  avatar_url: string | null;
  full_name: string | null;
  gender: string | null;
}

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

const StyleGenerator = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { 
    isPremium, 
    remainingCount, 
    canGenerate, 
    isLoading: limitLoading, 
    updateAfterGeneration,
    refetch: refetchLimit 
  } = useGenerationLimit(user?.id);

  const [trends, setTrends] = useState<StyleTrend[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<StyleTrend | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [myLooks, setMyLooks] = useState<GeneratedLook[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'mylooks' | 'mypage'>('generate');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    height: '',
    weight: '',
    body_type: '',
    style_preferences: [] as string[],
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [useFaceComposite, setUseFaceComposite] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    // Fetch trends
    const { data: trendsData } = await supabase
      .from('style_trends')
      .select('*')
      .eq('is_active', true);
    
    if (trendsData) setTrends(trendsData);

    // Fetch products
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);
    
    if (productsData) setProducts(productsData);

    // Fetch user's generated looks and profile
    if (user) {
      const { data: looksData } = await supabase
        .from('generated_looks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (looksData) setMyLooks(looksData);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('height, weight, body_type, style_preferences, avatar_url, full_name, gender')
        .eq('user_id', user.id)
        .single();
      
      if (profileData) {
        setUserProfile(profileData);
        setEditForm({
          height: profileData.height?.toString() || '',
          weight: profileData.weight?.toString() || '',
          body_type: profileData.body_type || '',
          style_preferences: profileData.style_preferences || [],
        });
      }
    }
  };

  const toggleStylePreference = (styleId: string) => {
    setEditForm(prev => ({
      ...prev,
      style_preferences: prev.style_preferences.includes(styleId)
        ? prev.style_preferences.filter(s => s !== styleId)
        : [...prev.style_preferences, styleId]
    }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      setUserProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      
      toast({
        title: '프로필 사진 변경됨',
        description: '새 프로필 사진이 저장되었습니다.',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: '업로드 실패',
        description: '프로필 사진 업로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          height: editForm.height ? parseInt(editForm.height) : null,
          weight: editForm.weight ? parseInt(editForm.weight) : null,
          body_type: editForm.body_type || null,
          style_preferences: editForm.style_preferences,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setUserProfile(prev => prev ? {
        ...prev,
        height: editForm.height ? parseInt(editForm.height) : null,
        weight: editForm.weight ? parseInt(editForm.weight) : null,
        body_type: editForm.body_type || null,
        style_preferences: editForm.style_preferences,
      } : null);
      
      setIsEditingProfile(false);
      toast({
        title: '프로필 저장됨',
        description: '프로필 정보가 업데이트되었습니다.',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: '저장 실패',
        description: '프로필 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleProduct = (product: Product) => {
    setSelectedProducts(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  };

  const generateStyle = async () => {
    if (!user) return;

    // Check limit before generating
    if (!canGenerate) {
      toast({
        title: '일일 생성 횟수 초과',
        description: '프리미엄으로 업그레이드하면 무제한 생성이 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const styleDescription = selectedTrend?.name_ko || '트렌디한';
      const productsDescription = selectedProducts.map(p => p.name_ko).join(', ') || '기본 아이템';

      // Call AI generation edge function with face composite option
      const { data, error } = await supabase.functions.invoke('generate-style', {
        body: {
          style: styleDescription,
          products: productsDescription,
          userProfile: userProfile,
          useFaceComposite: useFaceComposite && !!userProfile?.avatar_url,
          userAvatarUrl: userProfile?.avatar_url,
          styleTrendId: selectedTrend?.id || null,
          productIds: selectedProducts.map(p => p.id),
        },
      });

      if (error) throw error;

      // Handle limit exceeded error
      if (data?.limitExceeded) {
        toast({
          title: '일일 생성 횟수 초과',
          description: '프리미엄으로 업그레이드하면 무제한 생성이 가능합니다.',
          variant: 'destructive',
        });
        refetchLimit();
        return;
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);

        // Update local limit state
        if (typeof data.remainingCount === 'number') {
          updateAfterGeneration(data.isPremium, data.remainingCount);
        }

        // Show appropriate toast
        if (data.cached) {
          toast({
            title: '캐시된 스타일 불러옴!',
            description: '이전에 생성된 동일한 조합의 스타일입니다. (비용 절약 🎉)',
          });
        } else {
          toast({
            title: '스타일 생성 완료!',
            description: useFaceComposite && userProfile?.avatar_url 
              ? '당신의 얼굴이 합성된 룩이 완성되었습니다.' 
              : '당신만의 룩이 완성되었습니다.',
          });
        }

        // Save to database (only if not cached - edge function handles caching)
        if (!data.cached) {
          await supabase.from('generated_looks').insert({
            user_id: user.id,
            image_url: data.imageUrl,
            prompt_used: `${styleDescription} 스타일, ${productsDescription}`,
            style_trend_id: selectedTrend?.id || null,
            product_ids: selectedProducts.map(p => p.id),
          });
        }

        fetchData(); // Refresh my looks
      }
    } catch (error: any) {
      console.error('Error generating style:', error);
      
      // Handle specific error messages
      const errorMessage = error?.message || '스타일 생성 중 문제가 발생했습니다.';
      toast({
        title: '생성 실패',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const addToCart = async (product: Product) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('cart_items').upsert({
        user_id: user.id,
        product_id: product.id,
        quantity: 1,
      });

      if (error) throw error;

      toast({
        title: '장바구니에 추가됨',
        description: `${product.name_ko}이(가) 장바구니에 추가되었습니다.`,
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const productsByCategory = products.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const categoryLabels: Record<string, string> = {
    top: '상의',
    bottom: '하의',
    outerwear: '아우터',
    shoes: '신발',
    accessory: '액세서리',
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
            <img src={showmelookLogo} alt="쇼미룩 로고" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[60px] sm:h-[90px] object-contain -ml-2 sm:-ml-3" />
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/cart')} className="p-2">
              <ShoppingBag className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="p-2">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Tabs - Mobile optimized with horizontal scroll */}
        <div className="flex gap-1 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-3 sm:px-4 py-2 font-medium font-korean transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'generate'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            스타일 생성
          </button>
          <button
            onClick={() => setActiveTab('mylooks')}
            className={`px-3 sm:px-4 py-2 font-medium font-korean transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'mylooks'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            내 룩 ({myLooks.length})
          </button>
          <button
            onClick={() => setActiveTab('mypage')}
            className={`px-3 sm:px-4 py-2 font-medium font-korean transition-colors whitespace-nowrap text-sm sm:text-base flex items-center ${
              activeTab === 'mypage'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-4 h-4 mr-1" />
            마이페이지
          </button>
        </div>

        {activeTab === 'generate' ? (
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left: Selection */}
            <div className="space-y-6 sm:space-y-8">
              {/* Trend Selection */}
              <div>
                <h2 className="font-korean text-xl sm:text-2xl text-foreground mb-3 sm:mb-4">트렌드 스타일 선택</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {trends.map((trend) => (
                    <button
                      key={trend.id}
                      onClick={() => setSelectedTrend(trend)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedTrend?.id === trend.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <p className="font-medium text-foreground font-korean">{trend.name_ko}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-korean">
                        {trend.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Selection by Category */}
              <div>
                <h2 className="font-korean text-xl sm:text-2xl text-foreground mb-3 sm:mb-4">아이템 선택</h2>
                <div className="space-y-4 sm:space-y-6">
                  {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                    <div key={category}>
                      <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 font-korean">
                        {categoryLabels[category] || category}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        {categoryProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => toggleProduct(product)}
                            className={`p-3 rounded-xl border-2 transition-all text-left ${
                              selectedProducts.find(p => p.id === product.id)
                                ? 'border-accent bg-accent/5'
                                : 'border-border hover:border-accent/50'
                            }`}
                          >
                            <div className="aspect-square bg-secondary rounded-lg mb-2 flex items-center justify-center">
                              <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
                            </div>
                            <p className="font-medium text-foreground text-sm truncate font-korean">
                              {product.name_ko}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ₩{product.price.toLocaleString()}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Face Composite Option */}
              {userProfile?.avatar_url && (
                <div className="p-3 sm:p-4 rounded-xl border-2 border-border bg-secondary/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={userProfile.avatar_url} 
                          alt="Your face" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground font-korean text-sm sm:text-base truncate">내 얼굴 합성하기</p>
                        <p className="text-xs text-muted-foreground font-korean truncate">AI가 생성한 이미지에 내 얼굴을 합성합니다</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseFaceComposite(!useFaceComposite)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        useFaceComposite ? 'bg-accent' : 'bg-muted'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        useFaceComposite ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Daily Generation Limit Display */}
              <div className="p-3 sm:p-4 rounded-xl border-2 border-border bg-secondary/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {isPremium ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground font-korean text-sm sm:text-base truncate">
                        {isPremium ? '프리미엄 회원' : '오늘 남은 생성 횟수'}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground font-korean truncate">
                        {limitLoading ? (
                          '로딩 중...'
                        ) : isPremium ? (
                          '무제한 스타일 생성'
                        ) : (
                          `${remainingCount}회 남음 (일일 5회)`
                        )}
                      </p>
                    </div>
                  </div>
                  {!isPremium && remainingCount <= 2 && remainingCount > 0 && (
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full font-korean">
                      곧 소진
                    </span>
                  )}
                  {!isPremium && remainingCount === 0 && (
                    <span className="px-3 py-1 bg-destructive/20 text-destructive text-xs font-medium rounded-full font-korean">
                      소진됨
                    </span>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                variant="gold"
                size="xl"
                className="w-full font-korean"
                onClick={generateStyle}
                disabled={isGenerating || !canGenerate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    생성 중...
                  </>
                ) : !canGenerate ? (
                  <>
                    <Crown className="w-5 h-5" />
                    프리미엄으로 업그레이드
                  </>
                ) : (
                  <>
                    <img src={showmelookLogo} alt="" className="w-5 h-5 object-contain" />
                    {useFaceComposite && userProfile?.avatar_url ? '내 얼굴로 스타일 생성' : '스타일 생성하기'}
                  </>
                )}
              </Button>

              {/* Upgrade Prompt for non-premium users with low remaining */}
              {!isPremium && remainingCount <= 2 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <Crown className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground text-sm">프리미엄으로 업그레이드</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        무제한 스타일 생성, 고화질 이미지, 우선 처리 혜택을 누려보세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Generated Result */}
            <div className="lg:sticky lg:top-24 lg:self-start mt-6 lg:mt-0">
              <h2 className="font-korean text-xl sm:text-2xl text-foreground mb-3 sm:mb-4">생성된 스타일</h2>
              <div className="aspect-[3/4] bg-secondary rounded-xl sm:rounded-2xl overflow-hidden border border-border">
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated style"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <img src={showmelookLogo} alt="" className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium font-korean">AI 스타일 미리보기</p>
                    <p className="text-sm mt-2 font-korean">트렌드와 아이템을 선택하고 생성하세요</p>
                  </div>
                )}
              </div>

              {generatedImage && selectedProducts.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-foreground mb-3">선택된 아이템 구매하기</h3>
                  <div className="space-y-2">
                    {selectedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-secondary rounded-xl"
                      >
                        <div>
                          <p className="font-medium text-foreground">{product.name_ko}</p>
                          <p className="text-sm text-muted-foreground">
                            ₩{product.price.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="minimal"
                          size="sm"
                          onClick={() => addToCart(product)}
                        >
                          담기
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full mt-4"
                    onClick={() => navigate('/cart')}
                  >
                    장바구니로 이동
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'mylooks' ? (
          /* My Looks Grid */
          <div>
            {myLooks.length === 0 ? (
              <div className="text-center py-20">
                <img src={showmelookLogo} alt="" className="w-16 h-16 mx-auto opacity-50 mb-4" />
                <p className="text-lg text-muted-foreground">아직 생성된 룩이 없습니다</p>
                <Button
                  variant="hero"
                  className="mt-4"
                  onClick={() => setActiveTab('generate')}
                >
                  첫 스타일 만들기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {myLooks.map((look) => (
                  <div
                    key={look.id}
                    className="aspect-[3/4] rounded-2xl overflow-hidden bg-secondary relative group"
                  >
                    <img
                      src={look.image_url}
                      alt="Generated look"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-overlay opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <p className="text-sm text-primary-foreground/80">
                        {new Date(look.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <button className="absolute top-3 right-3 w-10 h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Heart className={`w-5 h-5 ${look.is_favorite ? 'fill-accent text-accent' : 'text-foreground'}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* My Page */
          <div className="max-w-2xl mx-auto">
            {/* Profile Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-secondary border-4 border-accent/20">
                  {userProfile?.avatar_url ? (
                    <img 
                      src={userProfile.avatar_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent/90 transition-colors">
                  <Camera className="w-5 h-5 text-primary-foreground" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <h2 className="font-display text-2xl text-foreground mt-4">
                {userProfile?.full_name || user?.email?.split('@')[0] || '사용자'}
              </h2>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>

            {/* Profile Info */}
            <div className="bg-secondary/50 rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl text-foreground">프로필 정보</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/profile-edit')}>
                    <Settings className="w-4 h-4 mr-1" />
                    전체 수정
                  </Button>
                  {!isEditingProfile && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)}>
                      빠른 수정
                    </Button>
                  )}
                {isEditingProfile && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setIsEditingProfile(false);
                      setEditForm({
                        height: userProfile?.height?.toString() || '',
                        weight: userProfile?.weight?.toString() || '',
                        body_type: userProfile?.body_type || '',
                        style_preferences: userProfile?.style_preferences || [],
                      });
                    }}>
                      취소
                    </Button>
                    <Button variant="hero" size="sm" onClick={saveProfile} disabled={isSavingProfile}>
                      {isSavingProfile ? '저장 중...' : '저장'}
                    </Button>
                  </>
                )}
                </div>
              </div>

              {isEditingProfile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-height">키 (cm)</Label>
                      <Input
                        id="edit-height"
                        type="number"
                        placeholder="170"
                        value={editForm.height}
                        onChange={(e) => setEditForm(prev => ({ ...prev, height: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-weight">몸무게 (kg)</Label>
                      <Input
                        id="edit-weight"
                        type="number"
                        placeholder="65"
                        value={editForm.weight}
                        onChange={(e) => setEditForm(prev => ({ ...prev, weight: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>체형</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {bodyTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setEditForm(prev => ({ ...prev, body_type: type.id }))}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            editForm.body_type === type.id
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          <span className="text-foreground font-medium">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>선호 스타일</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {styleOptions.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => toggleStylePreference(style.id)}
                          className={`p-3 rounded-xl border-2 transition-all text-center relative ${
                            editForm.style_preferences.includes(style.id)
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          {editForm.style_preferences.includes(style.id) && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                          <span className="text-xl block mb-1">{style.emoji}</span>
                          <span className="text-foreground text-sm font-medium">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground">키</p>
                      <p className="text-lg font-medium text-foreground">
                        {userProfile?.height ? `${userProfile.height}cm` : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground">몸무게</p>
                      <p className="text-lg font-medium text-foreground">
                        {userProfile?.weight ? `${userProfile.weight}kg` : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2">성별</p>
                      <p className="text-lg font-medium text-foreground">
                        {userProfile?.gender === 'male' ? '남성' : 
                         userProfile?.gender === 'female' ? '여성' : 
                         userProfile?.gender === 'unisex' ? '유니섹스' : 
                         userProfile?.gender === 'prefer_not_to_say' ? '비공개' : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2">체형</p>
                      <p className="text-lg font-medium text-foreground">
                        {bodyTypes.find(t => t.id === userProfile?.body_type)?.label || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-background rounded-xl">
                    <p className="text-sm text-muted-foreground mb-2">선호 스타일</p>
                    <div className="flex flex-wrap gap-2">
                      {userProfile?.style_preferences?.length ? (
                        userProfile.style_preferences.map(styleId => {
                          const style = styleOptions.find(s => s.id === styleId);
                          return style ? (
                            <span key={styleId} className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
                              {style.emoji} {style.label}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-6 bg-secondary/50 rounded-2xl border border-border text-center">
                <p className="text-3xl font-display text-foreground">{myLooks.length}</p>
                <p className="text-muted-foreground">생성된 룩</p>
              </div>
              <div className="p-6 bg-secondary/50 rounded-2xl border border-border text-center">
                <p className="text-3xl font-display text-foreground">
                  {myLooks.filter(l => l.is_favorite).length}
                </p>
                <p className="text-muted-foreground">즐겨찾기</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleGenerator;
