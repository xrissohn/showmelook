import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useGenerationLimit } from '@/hooks/useGenerationLimit';
import { ShoppingBag, Heart, LogOut, ChevronRight, Loader2, User, Camera, Check, Zap, Crown, Settings, Sparkles, ExternalLink, Plus } from 'lucide-react';
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

// 캐시된 상품 (products_cache 테이블에서 가져온 상품)
interface CachedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  style_tags: string[] | null;
  affiliate_url?: string;
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
  
  // 트렌드 기반 실시간 검색된 상품들
  const [trendProducts, setTrendProducts] = useState<CachedProduct[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [selectedTrendProducts, setSelectedTrendProducts] = useState<CachedProduct[]>([]);
  
  // 필터 상태
  const [priceFilter, setPriceFilter] = useState<'all' | 'under50k' | 'under100k' | 'under200k' | 'over200k'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  
  // 주관식 스타일 입력 모드 상태
  const [inputMode, setInputMode] = useState<'trend' | 'custom'>('trend');
  const [customStylePrompt, setCustomStylePrompt] = useState('');
  const [customGender, setCustomGender] = useState<'female' | 'male'>('female');
  const [customBudget, setCustomBudget] = useState([200000]);
  const [isCustomSearching, setIsCustomSearching] = useState(false);
  const [customResult, setCustomResult] = useState<{
    items: CachedProduct[];
    styleConcept: string;
    styleReasoning: string;
    totalPrice: number;
  } | null>(null);

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
      
      // Generate signed URLs for generated looks (bucket is now private)
      if (looksData) {
        const looksWithSignedUrls = await Promise.all(
          looksData.map(async (look) => {
            // Check if it's a file path (not already a full signed URL)
            if (look.image_url && !look.image_url.startsWith('http')) {
              const { data: signedData } = await supabase.storage
                .from('generated-looks')
                .createSignedUrl(look.image_url, 3600);
              return { ...look, image_url: signedData?.signedUrl || look.image_url };
            }
            return look;
          })
        );
        setMyLooks(looksWithSignedUrls);
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('height, weight, body_type, style_preferences, avatar_url, full_name, gender')
        .eq('user_id', user.id)
        .single();
      
      if (profileData) {
        // Generate signed URL for avatar if it's a file path
        let avatarDisplayUrl = profileData.avatar_url;
        if (profileData.avatar_url && !profileData.avatar_url.startsWith('http')) {
          const { data: signedData } = await supabase.storage
            .from('avatars')
            .createSignedUrl(profileData.avatar_url, 3600);
          avatarDisplayUrl = signedData?.signedUrl || profileData.avatar_url;
        }
        
        setUserProfile({ ...profileData, avatar_url: avatarDisplayUrl });
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

      // Store the file path instead of public URL (bucket is now private)
      const storagePath = filePath;

      await supabase
        .from('profiles')
        .update({ avatar_url: storagePath })
        .eq('user_id', user.id);

      // Generate signed URL for display (valid for 1 hour)
      const { data: signedData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(storagePath, 3600);

      setUserProfile(prev => prev ? { ...prev, avatar_url: signedData?.signedUrl || storagePath } : null);
      
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

  const toggleTrendProduct = (product: CachedProduct) => {
    setSelectedTrendProducts(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  };

  // 트렌드 선택 시 실시간 상품 검색
  const handleTrendSelect = async (trend: StyleTrend) => {
    setSelectedTrend(trend);
    setTrendProducts([]);
    setSelectedTrendProducts([]);
    
    if (!trend) return;
    
    setIsSearchingProducts(true);
    
    try {
      const gender = userProfile?.gender === 'female' ? '여성' : '남성';
      const userRequest = `${trend.name_ko} 스타일 코디`;
      
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest,
          gender,
          budget: 300000,
          forceRefresh: false
        }
      });
      
      if (error) throw error;
      
      if (data.success && data.look?.items) {
        // 검색된 상품들 추출 (product가 있는 아이템만)
        const foundProducts: CachedProduct[] = data.look.items
          .filter((item: any) => item.product !== null)
          .map((item: any) => ({
            id: item.product.id,
            name: item.product.name,
            brand: item.product.brand,
            price: item.product.price,
            image_url: item.product.image_url,
            product_url: item.product.product_url,
            category: item.category,
            style_tags: item.product.style_tags,
            affiliate_url: item.affiliateUrl
          }));
        
        setTrendProducts(foundProducts);
        
        // 캐시 히트 시 알림
        if (data.cacheHit) {
          toast({
            title: '캐시된 스타일 불러옴!',
            description: `${foundProducts.length}개 아이템 (API 비용 절약 🎉)`,
          });
        } else {
          toast({
            title: '상품 검색 완료!',
            description: `${foundProducts.length}개의 ${trend.name_ko} 스타일 아이템을 찾았어요.`,
          });
        }
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast({
        title: '검색 실패',
        description: '상품 검색 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSearchingProducts(false);
    }
  };

  // 주관식 스타일 추천 핸들러
  const handleCustomStyleSearch = async () => {
    if (!customStylePrompt.trim()) {
      toast({
        title: '스타일 프롬프트를 입력해주세요',
        variant: 'destructive',
      });
      return;
    }

    setIsCustomSearching(true);
    setCustomResult(null);
    setSelectedTrendProducts([]);

    try {
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest: customStylePrompt,
          gender: customGender === 'female' ? '여성' : '남성',
          budget: customBudget[0],
          forceRefresh: false
        }
      });

      if (error) throw error;

      if (data.success && data.look) {
        const transformedItems: CachedProduct[] = data.look.items
          .filter((item: any) => item.product !== null)
          .map((item: any) => ({
            id: item.product.id,
            name: item.product.name,
            brand: item.product.brand,
            price: item.product.price,
            image_url: item.product.image_url,
            product_url: item.product.product_url,
            category: item.category,
            style_tags: item.product.style_tags,
            affiliate_url: item.affiliateUrl
          }));

        setCustomResult({
          items: transformedItems,
          styleConcept: data.look.name || '스타일 추천',
          styleReasoning: data.look.stylingTips || '',
          totalPrice: data.look.totalPrice || 0
        });

        // 자동으로 선택된 상태로
        setSelectedTrendProducts(transformedItems);

        toast({
          title: data.cacheHit ? '캐시된 스타일 불러옴!' : '스타일 추천 완료!',
          description: `${transformedItems.length}개의 아이템을 추천해드렸어요.`,
        });

        // 히스토리 저장
        if (user) {
          try {
            await supabase.from('recommendation_history').insert({
              user_id: user.id,
              prompt: customStylePrompt,
              gender: customGender === 'female' ? '여성' : '남성',
              budget: customBudget[0],
              style_concept: data.look.name || '',
              style_reasoning: data.look.stylingTips || '',
              items: transformedItems as any,
              total_price: data.look.totalPrice || 0
            });
          } catch (saveError) {
            console.error('Failed to save to history:', saveError);
          }
        }
      } else {
        throw new Error(data.error || '추천 실패');
      }
    } catch (error: any) {
      console.error('Custom style recommendation error:', error);
      toast({
        title: '추천 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsCustomSearching(false);
    }
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

    // 트렌드 상품 또는 일반 상품 사용
    const useTrendProducts = selectedTrendProducts.length > 0;
    const productsToUse = useTrendProducts ? selectedTrendProducts : selectedProducts;
    
    if (productsToUse.length === 0 && !selectedTrend && !customResult) {
      toast({
        title: '상품을 선택해주세요',
        description: '스타일 생성을 위해 최소 1개의 상품을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const styleDescription = selectedTrend?.name_ko || customResult?.styleConcept || '트렌디한';
      
      // 상품 정보를 상세하게 구성 (이름, 브랜드, 카테고리 포함)
      const productsWithDetails = useTrendProducts 
        ? selectedTrendProducts.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            category: p.category,
            image_url: p.image_url,
          }))
        : selectedProducts.map(p => ({
            id: p.id,
            name: p.name_ko,
            brand: p.brand,
            category: p.category,
            image_url: p.image_url,
          }));

      const productsDescription = productsWithDetails.map(p => {
        const brandPart = p.brand ? `${p.brand} ` : '';
        return `${brandPart}${p.name}`;
      }).join(', ') || '기본 아이템';

      // 상품 이미지 URL 목록 (AI가 참고할 수 있도록)
      const productImageUrls = productsWithDetails
        .filter(p => p.image_url)
        .map(p => p.image_url);

      // Call AI generation edge function with face composite option
      const { data, error } = await supabase.functions.invoke('generate-style', {
        body: {
          style: styleDescription,
          products: productsDescription,
          productDetails: productsWithDetails, // 상세 상품 정보 전달
          productImageUrls: productImageUrls, // 상품 이미지 URL 전달
          userProfile: userProfile,
          useFaceComposite: useFaceComposite && !!userProfile?.avatar_url,
          userAvatarUrl: userProfile?.avatar_url,
          styleTrendId: selectedTrend?.id || null,
          productIds: productsWithDetails.map(p => p.id),
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
            image_url: data.imagePath || data.imageUrl,
            prompt_used: `${styleDescription} 스타일, ${productsDescription}`,
            style_trend_id: selectedTrend?.id || null,
            product_ids: productsWithDetails.map(p => p.id),
          });
        }

        fetchData(); // Refresh my looks
      }
    } catch (error: any) {
      console.error('Error generating style:', error);
      
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
              {/* 입력 모드 선택 탭 */}
              <div className="flex gap-2 p-1 bg-secondary rounded-xl">
                <button
                  onClick={() => {
                    setInputMode('trend');
                    setCustomResult(null);
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-korean text-sm transition-all ${
                    inputMode === 'trend'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🎨 트렌드 선택
                </button>
                <button
                  onClick={() => {
                    setInputMode('custom');
                    setSelectedTrend(null);
                    setTrendProducts([]);
                    setSelectedTrendProducts([]);
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-korean text-sm transition-all ${
                    inputMode === 'custom'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ✍️ 주관식 입력
                </button>
              </div>

              {/* 트렌드 모드 */}
              {inputMode === 'trend' && (
                <>
                  {/* Trend Selection */}
                  <div>
                    <h2 className="font-korean text-xl sm:text-2xl text-foreground mb-3 sm:mb-4">트렌드 스타일 선택</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {trends.map((trend) => (
                        <button
                          key={trend.id}
                          onClick={() => handleTrendSelect(trend)}
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
                </>
              )}

              {/* 주관식 입력 모드 */}
              {inputMode === 'custom' && (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl border-2 border-border bg-secondary/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-accent" />
                      <h2 className="font-korean text-lg font-medium text-foreground">원하는 스타일 설명</h2>
                    </div>
                    
                    <div className="space-y-4">
                      {/* 스타일 프롬프트 */}
                      <div className="space-y-2">
                        <Label className="font-korean text-sm">스타일 프롬프트</Label>
                        <Textarea
                          placeholder="예: 봄 데이트룩, 화사하고 로맨틱한 느낌으로 원피스나 블라우스 위주로 추천해줘"
                          value={customStylePrompt}
                          onChange={(e) => setCustomStylePrompt(e.target.value)}
                          className="min-h-[100px] resize-none font-korean"
                          disabled={isCustomSearching}
                        />
                      </div>

                      {/* 성별 선택 */}
                      <div className="space-y-2">
                        <Label className="font-korean text-sm">성별</Label>
                        <RadioGroup
                          value={customGender}
                          onValueChange={(value) => setCustomGender(value as 'female' | 'male')}
                          className="flex gap-4"
                          disabled={isCustomSearching}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id="custom-female" />
                            <Label htmlFor="custom-female" className="cursor-pointer font-korean">여성</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id="custom-male" />
                            <Label htmlFor="custom-male" className="cursor-pointer font-korean">남성</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* 예산 슬라이더 */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="font-korean text-sm">예산</Label>
                          <span className="text-lg font-semibold text-accent font-korean">
                            {new Intl.NumberFormat('ko-KR').format(customBudget[0])}원
                          </span>
                        </div>
                        <Slider
                          value={customBudget}
                          onValueChange={setCustomBudget}
                          min={50000}
                          max={1000000}
                          step={10000}
                          disabled={isCustomSearching}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground font-korean">
                          <span>5만원</span>
                          <span>100만원</span>
                        </div>
                      </div>

                      {/* 추천 버튼 */}
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full font-korean"
                        onClick={handleCustomStyleSearch}
                        disabled={isCustomSearching || !customStylePrompt.trim()}
                      >
                        {isCustomSearching ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            AI가 스타일을 분석중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            스타일 추천받기
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* 주관식 추천 결과 */}
                  {customResult && (
                    <div className="space-y-4 animate-in fade-in-50 duration-500">
                      {/* 스타일 컨셉 */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20">
                        <h3 className="font-korean text-lg font-medium text-foreground mb-2">
                          🎨 {customResult.styleConcept}
                        </h3>
                        <p className="text-sm text-muted-foreground font-korean">{customResult.styleReasoning}</p>
                      </div>

                      {/* 추천 아이템 그리드 */}
                      <div className="grid grid-cols-2 gap-3">
                        {customResult.items.map((product) => (
                          <div
                            key={product.id}
                            className={`p-3 rounded-xl border-2 transition-all ${
                              selectedTrendProducts.find(p => p.id === product.id)
                                ? 'border-accent bg-accent/5'
                                : 'border-border'
                            }`}
                          >
                            <div className="aspect-square bg-secondary rounded-lg mb-2 overflow-hidden">
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-korean mb-0.5">{product.category}</p>
                            <p className="font-medium text-foreground text-sm truncate font-korean">{product.name}</p>
                            {product.brand && (
                              <p className="text-xs text-accent truncate">{product.brand}</p>
                            )}
                            <p className="text-sm font-bold text-foreground mt-1">
                              ₩{product.price.toLocaleString()}
                            </p>
                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={() => toggleTrendProduct(product)}
                                className={`flex-1 text-xs py-1.5 px-2 rounded-lg transition-colors font-korean ${
                                  selectedTrendProducts.find(p => p.id === product.id)
                                    ? 'bg-accent text-white'
                                    : 'bg-secondary text-foreground hover:bg-accent/20'
                                }`}
                              >
                                {selectedTrendProducts.find(p => p.id === product.id) ? (
                                  <>
                                    <Check className="w-3 h-3 inline mr-1" />
                                    선택됨
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 inline mr-1" />
                                    선택
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  const url = product.affiliate_url || product.product_url;
                                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                className="text-xs py-1.5 px-2 rounded-lg bg-secondary text-foreground hover:bg-accent/20 transition-colors font-korean"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 총 금액 */}
                      <div className="p-3 rounded-xl bg-secondary/50 flex justify-between items-center">
                        <span className="font-korean text-sm text-muted-foreground">총 예상 금액</span>
                        <span className="font-korean font-bold text-lg text-accent">
                          ₩{customResult.totalPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trend-based Product Selection (트렌드 모드에서만 표시) */}
              {inputMode === 'trend' && selectedTrend && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <h2 className="font-korean text-xl sm:text-2xl text-foreground">
                      {selectedTrend.name_ko} 추천 아이템
                    </h2>
                    {isSearchingProducts && (
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    )}
                  </div>
                  
                  {/* 필터 UI */}
                  {trendProducts.length > 0 && !isSearchingProducts && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {/* 가격 필터 */}
                      <select
                        value={priceFilter}
                        onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground font-korean"
                      >
                        <option value="all">전체 가격</option>
                        <option value="under50k">5만원 미만</option>
                        <option value="under100k">10만원 미만</option>
                        <option value="under200k">20만원 미만</option>
                        <option value="over200k">20만원 이상</option>
                      </select>
                      
                      {/* 브랜드 필터 */}
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground font-korean"
                      >
                        <option value="all">전체 브랜드</option>
                        {[...new Set(trendProducts.map(p => p.brand).filter(Boolean))].map((brand) => (
                          <option key={brand} value={brand!}>{brand}</option>
                        ))}
                      </select>
                      
                      {/* 필터 초기화 */}
                      {(priceFilter !== 'all' || brandFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setPriceFilter('all');
                            setBrandFilter('all');
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg border border-accent/50 text-accent hover:bg-accent/10 font-korean"
                        >
                          초기화
                        </button>
                      )}
                    </div>
                  )}
                  
                  {isSearchingProducts ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-3 rounded-xl border-2 border-border animate-pulse">
                          <div className="aspect-square bg-secondary rounded-lg mb-2" />
                          <div className="h-4 bg-secondary rounded w-3/4 mb-1" />
                          <div className="h-3 bg-secondary rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : trendProducts.length > 0 ? (
                    <div className="space-y-4 sm:space-y-6">
                      {/* 필터링된 상품 */}
                      {(() => {
                        const filteredProducts = trendProducts.filter(p => {
                          // 가격 필터
                          if (priceFilter === 'under50k' && p.price >= 50000) return false;
                          if (priceFilter === 'under100k' && p.price >= 100000) return false;
                          if (priceFilter === 'under200k' && p.price >= 200000) return false;
                          if (priceFilter === 'over200k' && p.price < 200000) return false;
                          // 브랜드 필터
                          if (brandFilter !== 'all' && p.brand !== brandFilter) return false;
                          return true;
                        });
                        
                        if (filteredProducts.length === 0) {
                          return (
                            <div className="p-6 text-center text-muted-foreground bg-secondary/50 rounded-xl">
                              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="font-korean">필터 조건에 맞는 상품이 없습니다</p>
                            </div>
                          );
                        }
                        
                        // Map categories (Korean and English)
                        const categoryGroups: Record<string, string[]> = {
                          '상의': ['상의', 'top', 'tops'],
                          '하의': ['하의', 'bottom', 'bottoms', 'pants'],
                          '아우터': ['아우터', 'outerwear', 'outer', 'jacket'],
                          '신발': ['신발', 'shoes', 'footwear'],
                          '가방': ['가방', 'bag', 'bags', 'accessory'],
                        };
                        
                        const normalizeCategory = (cat: string): string => {
                          for (const [korName, variants] of Object.entries(categoryGroups)) {
                            if (variants.some(v => v.toLowerCase() === cat.toLowerCase())) {
                              return korName;
                            }
                          }
                          return cat;
                        };
                        
                        // Group products by normalized category
                        const groupedProducts: Record<string, CachedProduct[]> = {};
                        filteredProducts.forEach(p => {
                          const normalizedCat = normalizeCategory(p.category);
                          if (!groupedProducts[normalizedCat]) {
                            groupedProducts[normalizedCat] = [];
                          }
                          groupedProducts[normalizedCat].push(p);
                        });
                        
                        return Object.entries(groupedProducts).map(([category, categoryItems]) => {
                          if (categoryItems.length === 0) return null;
                          
                          return (
                            <div key={category}>
                              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 font-korean">
                                {category}
                              </h3>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                                {categoryItems.map((product) => (
                                  <button
                                    key={product.id}
                                    onClick={() => toggleTrendProduct(product)}
                                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                                      selectedTrendProducts.find(p => p.id === product.id)
                                        ? 'border-accent bg-accent/5'
                                        : 'border-border hover:border-accent/50'
                                    }`}
                                  >
                                    <div className="aspect-square bg-secondary rounded-lg mb-2 overflow-hidden">
                                      {product.image_url ? (
                                        <img 
                                          src={product.image_url} 
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
                                        </div>
                                      )}
                                    </div>
                                    <p className="font-medium text-foreground text-sm truncate font-korean">
                                      {product.name}
                                    </p>
                                    {product.brand && (
                                      <p className="text-xs text-accent truncate">{product.brand}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      ₩{product.price.toLocaleString()}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground bg-secondary/50 rounded-xl">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-korean">트렌드를 선택하면 추천 아이템이 표시됩니다</p>
                    </div>
                  )}
                </div>
              )}

              {/* 기본 아이템 선택 (트렌드 모드에서 트렌드 상품이 없을 때만 표시) */}
              {inputMode === 'trend' && !selectedTrend && products.length > 0 && (
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
                              <div className="aspect-square bg-secondary rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                {product.image_url ? (
                                  <img 
                                    src={product.image_url} 
                                    alt={product.name_ko}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
                                )}
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
              )}

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
                      <p className="font-medium text-foreground text-sm font-korean">프리미엄으로 업그레이드</p>
                      <p className="text-xs text-muted-foreground mt-1 font-korean">
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
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <img src={showmelookLogo} alt="" className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium font-korean">AI 스타일 미리보기</p>
                    <p className="text-sm mt-2 font-korean">트렌드와 아이템을 선택하고 생성하세요</p>
                  </div>
                )}
              </div>

              {/* 선택된 트렌드 상품 구매하기 */}
              {selectedTrendProducts.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-foreground mb-3 font-korean">선택된 아이템 구매하기</h3>
                  <div className="space-y-2">
                    {selectedTrendProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 p-3 bg-secondary rounded-xl"
                      >
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground font-korean text-sm truncate">{product.name}</p>
                          {product.brand && (
                            <p className="text-xs text-accent truncate">{product.brand}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            ₩{product.price.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="minimal"
                          size="sm"
                          onClick={() => {
                            const url = product.affiliate_url || product.product_url;
                            if (url) window.open(url, '_blank');
                          }}
                          className="font-korean"
                        >
                          구매
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-accent/10 rounded-xl text-center">
                    <p className="text-sm text-accent font-korean">
                      총 ₩{selectedTrendProducts.reduce((sum, p) => sum + p.price, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* 기존 상품 테이블에서 선택한 아이템 */}
              {generatedImage && selectedProducts.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-foreground mb-3 font-korean">기본 아이템 구매하기</h3>
                  <div className="space-y-2">
                    {selectedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-secondary rounded-xl"
                      >
                        <div>
                          <p className="font-medium text-foreground font-korean">{product.name_ko}</p>
                          <p className="text-sm text-muted-foreground">
                            ₩{product.price.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="minimal"
                          size="sm"
                          onClick={() => addToCart(product)}
                          className="font-korean"
                        >
                          담기
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full mt-4 font-korean"
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
                <p className="text-lg text-muted-foreground font-korean">아직 생성된 룩이 없습니다</p>
                <Button
                  variant="hero"
                  className="mt-4 font-korean"
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
                      loading="lazy"
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
                      loading="lazy"
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
              <h2 className="font-korean text-2xl text-foreground mt-4">
                {userProfile?.full_name || user?.email?.split('@')[0] || '사용자'}
              </h2>
              <p className="text-muted-foreground font-korean">{user?.email}</p>
            </div>

            {/* Profile Info */}
            <div className="bg-secondary/50 rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-korean text-xl text-foreground">프로필 정보</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/profile-edit')} className="font-korean">
                    <Settings className="w-4 h-4 mr-1" />
                    전체 수정
                  </Button>
                  {!isEditingProfile && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)} className="font-korean">
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
                    <Button variant="hero" size="sm" onClick={saveProfile} disabled={isSavingProfile} className="font-korean">
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
                      <Label htmlFor="edit-height" className="font-korean">키 (cm)</Label>
                      <Input
                        id="edit-height"
                        type="number"
                        placeholder="170"
                        value={editForm.height}
                        onChange={(e) => setEditForm(prev => ({ ...prev, height: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-weight" className="font-korean">몸무게 (kg)</Label>
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
                    <Label className="font-korean">체형</Label>
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
                          <span className="text-foreground font-medium font-korean">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-korean">선호 스타일</Label>
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
                          <span className="text-foreground text-sm font-medium font-korean">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground font-korean">키</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {userProfile?.height ? `${userProfile.height}cm` : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground font-korean">몸무게</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {userProfile?.weight ? `${userProfile.weight}kg` : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2 font-korean">성별</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {userProfile?.gender === 'male' ? '남성' : 
                         userProfile?.gender === 'female' ? '여성' : 
                         userProfile?.gender === 'unisex' ? '유니섹스' : 
                         userProfile?.gender === 'prefer_not_to_say' ? '비공개' : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2 font-korean">체형</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {bodyTypes.find(t => t.id === userProfile?.body_type)?.label || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-background rounded-xl">
                    <p className="text-sm text-muted-foreground mb-2 font-korean">선호 스타일</p>
                    <div className="flex flex-wrap gap-2">
                      {userProfile?.style_preferences?.length ? (
                        userProfile.style_preferences.map(styleId => {
                          const style = styleOptions.find(s => s.id === styleId);
                          return style ? (
                            <span key={styleId} className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-korean">
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
                <p className="text-3xl font-korean text-foreground">{myLooks.length}</p>
                <p className="text-muted-foreground font-korean">생성된 룩</p>
              </div>
              <div className="p-6 bg-secondary/50 rounded-2xl border border-border text-center">
                <p className="text-3xl font-korean text-foreground">
                  {myLooks.filter(l => l.is_favorite).length}
                </p>
                <p className="text-muted-foreground font-korean">즐겨찾기</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleGenerator;
