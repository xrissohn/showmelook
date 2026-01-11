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
  const [inputMode, setInputMode] = useState<'trend' | 'custom'>('custom'); // 기본값을 custom으로 변경
  const [customStylePrompt, setCustomStylePrompt] = useState('');
  const [customGender, setCustomGender] = useState<'female' | 'male' | 'kids'>('female');
  const [customAge, setCustomAge] = useState<number | undefined>(undefined);
  const [customBudget, setCustomBudget] = useState([200000]);
  const [isCustomSearching, setIsCustomSearching] = useState(false);
  const [customResult, setCustomResult] = useState<{
    items: CachedProduct[];
    styleConcept: string;
    styleReasoning: string;
    totalPrice: number;
  } | null>(null);

  // 구매 버튼 로딩 상태
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);

  // 딥링크 변환 후 구매 페이지로 이동하는 함수
  const handlePurchase = async (product: CachedProduct) => {
    // affiliate_url이 이미 있으면 바로 이동
    if (product.affiliate_url) {
      window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
      return;
    }

    // product_url이 없으면 에러
    if (!product.product_url) {
      toast({
        title: '구매 링크 없음',
        description: '이 상품의 구매 링크가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setPurchasingProductId(product.id);

    try {
      // deeplink 함수 호출하여 제휴 링크 변환
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: product.product_url }
      });

      if (error) throw error;

      if (data?.success && data?.affiliate_url) {
        // 변환된 제휴 링크로 이동
        window.open(data.affiliate_url, '_blank', 'noopener,noreferrer');
        toast({
          title: '구매 페이지 이동',
          description: `${product.name} 구매 페이지로 이동합니다.`,
        });
      } else {
        // 딥링크 실패 시 원본 URL로 이동
        window.open(product.product_url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Deeplink error:', error);
      // 에러 시에도 원본 URL로 이동
      window.open(product.product_url, '_blank', 'noopener,noreferrer');
    } finally {
      setPurchasingProductId(null);
    }
  };

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
        
        // 프로필의 성별 정보로 초기 성별 설정
        if (profileData.gender) {
          const genderMap: Record<string, 'female' | 'male' | 'kids'> = {
            'female': 'female',
            'male': 'male',
            '여성': 'female',
            '남성': 'male',
            'kids': 'kids',
            '키즈': 'kids',
          };
          const mappedGender = genderMap[profileData.gender.toLowerCase()] || 'female';
          setCustomGender(mappedGender);
        }
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
          gender: customGender === 'kids' ? '여성' : (customGender === 'female' ? '여성' : '남성'),
          budget: customBudget[0],
          forceRefresh: false,
          age: customGender === 'kids' ? (customAge || 10) : customAge
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
          styleConcept: data.look.styleConcept || data.look.name || '스타일 추천',
          styleReasoning: data.look.styleReasoning || data.look.stylingTips || '',
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
              gender: customGender === 'kids' ? '키즈' : (customGender === 'female' ? '여성' : '남성'),
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
              {/* 주관식 입력 모드 - 항상 표시 */}
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
                      
                      {/* 추천 키워드 (기존 + 트렌드 통합) */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { emoji: '☕', text: '편안한 카페 데이트룩', desc: '여유로운 분위기의 데이트에 어울리는 편안한 코디' },
                          { emoji: '💼', text: '캐주얼 오피스룩', desc: '격식과 편안함을 동시에 잡는 스마트 캐주얼' },
                          { emoji: '🌸', text: '봄나들이 페미닌 코디', desc: '화사하고 로맨틱한 봄 시즌 스타일' },
                          { emoji: '🖤', text: '모던 시크 룩', desc: '세련되고 도시적인 올블랙 베이스 스타일' },
                          { emoji: '🏃', text: '스포티 캐주얼', desc: '활동적이면서도 스타일리시한 애슬레저 룩' },
                          { emoji: '✨', text: '파티 글램 룩', desc: '특별한 날을 위한 화려하고 섹시한 스타일' },
                        ].map((example) => (
                          <button
                            key={example.text}
                            onClick={() => setCustomStylePrompt(`${example.text} - ${example.desc}`)}
                            disabled={isCustomSearching}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/50 hover:bg-secondary rounded-full text-xs font-korean transition-colors disabled:opacity-50"
                          >
                            <span>{example.emoji}</span>
                            <span>{example.text}</span>
                          </button>
                        ))}
                        {/* 트렌드 키워드 */}
                        {trends.map((trend) => {
                          const trendEmojis: Record<string, string> = {
                            'Minimalist': '🤍',
                            'Street Style': '🔥',
                            'Classic Elegance': '👔',
                            'Athleisure': '⚡',
                            'Bohemian': '🌺',
                          };
                          return (
                            <button
                              key={trend.id}
                              onClick={() => {
                                setCustomStylePrompt(`${trend.name_ko} - ${trend.description || ''}`);
                                setSelectedTrend(trend);
                              }}
                              disabled={isCustomSearching}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/50 hover:bg-secondary rounded-full text-xs font-korean transition-colors disabled:opacity-50"
                            >
                              <span>{trendEmojis[trend.name] || '🎨'}</span>
                              <span>{trend.name_ko}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                      {/* 성별 선택 (키즈 포함) */}
                      <div className="space-y-2">
                        <Label className="font-korean text-sm">누구를 위한 스타일인가요?</Label>
                        <RadioGroup
                          value={customGender}
                          onValueChange={(value) => {
                            setCustomGender(value as 'female' | 'male' | 'kids');
                            // 키즈 선택 시 기본 나이 설정
                            if (value === 'kids' && !customAge) {
                              setCustomAge(10);
                            }
                          }}
                          className="flex gap-4 flex-wrap"
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
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="kids" id="custom-kids" />
                            <Label htmlFor="custom-kids" className="cursor-pointer font-korean">👶 키즈 (12세 이하)</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* 나이 입력 (키즈 선택 시 표시) */}
                      {customGender === 'kids' && (
                        <div className="space-y-2">
                          <Label className="font-korean text-sm">아이 나이</Label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              value={customAge || ''}
                              onChange={(e) => setCustomAge(parseInt(e.target.value) || undefined)}
                              placeholder="예: 8"
                              className="w-24 font-korean"
                              disabled={isCustomSearching}
                            />
                            <span className="text-sm text-muted-foreground font-korean">세</span>
                          </div>
                          <p className="text-xs text-muted-foreground font-korean">
                            12세 이하일 경우 키즈 전용 상품이 추천됩니다.
                          </p>
                        </div>
                      )}

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
                    <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                      {/* 스타일 컨셉 헤더 */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border border-accent/20 p-5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-accent" />
                            </div>
                            <span className="text-xs font-medium text-accent uppercase tracking-wider">AI 스타일 추천</span>
                          </div>
                          <h3 className="font-display text-xl font-semibold text-foreground mb-3 leading-tight">
                            {customResult.styleConcept}
                          </h3>
                          <p className="text-sm text-muted-foreground font-korean leading-relaxed">
                            {customResult.styleReasoning}
                          </p>
                        </div>
                      </div>

                      {/* 추천 아이템 섹션 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="font-korean text-sm font-medium text-foreground flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-accent" />
                            추천 아이템
                            <span className="text-xs text-muted-foreground">({customResult.items.length}개)</span>
                          </h4>
                        </div>

                        {/* 추천 아이템 그리드 */}
                        <div className="grid grid-cols-2 gap-3">
                          {customResult.items.map((product, index) => (
                            <div
                              key={product.id}
                              className={`group relative rounded-2xl border-2 transition-all duration-300 overflow-hidden hover:shadow-lg ${
                                selectedTrendProducts.find(p => p.id === product.id)
                                  ? 'border-accent bg-accent/5 shadow-md shadow-accent/10'
                                  : 'border-border/50 bg-card hover:border-accent/50'
                              }`}
                              style={{ animationDelay: `${index * 100}ms` }}
                            >
                              {/* 이미지 영역 */}
                              <div className="relative aspect-square bg-gradient-to-br from-secondary to-secondary/50 overflow-hidden">
                                {product.image_url ? (
                                  <img 
                                    src={product.image_url} 
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                                  </div>
                                )}
                                {/* 카테고리 배지 */}
                                <div className="absolute top-2 left-2">
                                  <span className="px-2 py-0.5 text-[10px] font-medium bg-background/80 backdrop-blur-sm rounded-full text-muted-foreground">
                                    {product.category}
                                  </span>
                                </div>
                                {/* 선택 체크 아이콘 */}
                                {selectedTrendProducts.find(p => p.id === product.id) && (
                                  <div className="absolute top-2 right-2">
                                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-lg">
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 정보 영역 */}
                              <div className="p-3 space-y-2">
                                {product.brand && (
                                  <p className="text-[11px] font-medium text-accent uppercase tracking-wide truncate">
                                    {product.brand}
                                  </p>
                                )}
                                <p className="font-medium text-foreground text-sm leading-tight line-clamp-2 font-korean min-h-[2.5rem]">
                                  {product.name}
                                </p>
                                <p className="text-base font-bold text-foreground">
                                  ₩{product.price.toLocaleString()}
                                </p>

                                {/* 액션 버튼들 */}
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={() => toggleTrendProduct(product)}
                                    className={`flex-1 text-xs py-2 px-3 rounded-xl font-medium transition-all duration-200 font-korean flex items-center justify-center gap-1 ${
                                      selectedTrendProducts.find(p => p.id === product.id)
                                        ? 'bg-accent text-white shadow-md shadow-accent/30'
                                        : 'bg-secondary hover:bg-accent/10 text-foreground'
                                    }`}
                                  >
                                    {selectedTrendProducts.find(p => p.id === product.id) ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        선택됨
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        선택
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handlePurchase(product)}
                                    disabled={purchasingProductId === product.id}
                                    className="p-2 rounded-xl bg-secondary hover:bg-accent/10 text-foreground transition-all duration-200 disabled:opacity-50"
                                    title="구매하기"
                                  >
                                    {purchasingProductId === product.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ExternalLink className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 총 금액 카드 */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary via-secondary/80 to-secondary p-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent" />
                        <div className="relative flex justify-between items-center">
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground font-korean">선택한 아이템 총 금액</span>
                            <p className="text-sm text-muted-foreground font-korean">
                              {selectedTrendProducts.length}개 아이템
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-display font-bold text-2xl text-accent">
                              ₩{selectedTrendProducts.reduce((sum, p) => sum + p.price, 0).toLocaleString()}
                            </span>
                            {customResult.totalPrice !== selectedTrendProducts.reduce((sum, p) => sum + p.price, 0) && (
                              <p className="text-xs text-muted-foreground font-korean line-through">
                                전체: ₩{customResult.totalPrice.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 액션 버튼들 */}
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCustomResult(null);
                            setCustomStylePrompt('');
                          }}
                          className="flex-1 font-korean gap-2 rounded-xl h-12"
                        >
                          <Sparkles className="w-4 h-4" />
                          다른 스타일
                        </Button>
                        {selectedTrendProducts.length > 0 && (
                          <Button
                            variant="hero"
                            onClick={() => {
                              // 선택된 모든 아이템 구매 페이지 열기
                              selectedTrendProducts.forEach((product, index) => {
                                setTimeout(() => handlePurchase(product), index * 300);
                              });
                            }}
                            className="flex-1 font-korean gap-2 rounded-xl h-12"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            전체 구매하기
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
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
              <div className="aspect-[3/4] bg-secondary rounded-xl sm:rounded-2xl overflow-hidden border border-border relative">
                {isGenerating ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent/5 via-primary/5 to-accent/10">
                    {/* 메인 로고 애니메이션 */}
                    <div className="relative">
                      {/* 펄스 링 애니메이션 */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border-2 border-accent/30 animate-ping" style={{ animationDuration: '2s' }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                      </div>
                      
                      {/* 회전하는 그라데이션 링 */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div 
                          className="w-28 h-28 rounded-full"
                          style={{
                            background: 'conic-gradient(from 0deg, transparent, hsl(var(--accent)), transparent)',
                            animation: 'spin 2s linear infinite',
                          }}
                        />
                      </div>
                      
                      {/* 회전하는 로고 컨테이너 */}
                      <div className="relative w-20 h-20 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-xl border border-accent/20">
                        <img 
                          src={showmelookLogo} 
                          alt="" 
                          className="w-12 h-12 object-contain animate-spin"
                          style={{ animationDuration: '3s' }}
                        />
                      </div>
                    </div>
                    
                    {/* 로딩 텍스트 */}
                    <div className="mt-8 text-center">
                      <p className="text-lg font-medium text-foreground font-korean animate-pulse">
                        AI가 스타일을 생성중...
                      </p>
                      <p className="text-sm text-muted-foreground mt-2 font-korean">
                        잠시만 기다려주세요 ✨
                      </p>
                    </div>
                    
                    {/* 하단 도트 애니메이션 */}
                    <div className="flex gap-2 mt-6">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full bg-accent"
                          style={{
                            animation: 'bounce 1s ease-in-out infinite',
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated style"
                    className="w-full h-full object-cover animate-fade-in"
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
                          onClick={() => handlePurchase(product)}
                          disabled={purchasingProductId === product.id}
                          className="font-korean"
                        >
                          {purchasingProductId === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            '구매'
                          )}
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
