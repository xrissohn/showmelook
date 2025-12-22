import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, ShoppingBag, RefreshCw, Heart, LogOut, ChevronRight, Loader2 } from 'lucide-react';

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

const StyleGenerator = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [trends, setTrends] = useState<StyleTrend[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<StyleTrend | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [myLooks, setMyLooks] = useState<GeneratedLook[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'mylooks'>('generate');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

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

    // Fetch user's generated looks
    if (user) {
      const { data: looksData } = await supabase
        .from('generated_looks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (looksData) setMyLooks(looksData);
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

    setIsGenerating(true);
    try {
      // Get user profile for context
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const styleDescription = selectedTrend?.name_ko || '트렌디한';
      const productsDescription = selectedProducts.map(p => p.name_ko).join(', ') || '기본 아이템';

      // Call AI generation edge function
      const { data, error } = await supabase.functions.invoke('generate-style', {
        body: {
          style: styleDescription,
          products: productsDescription,
          userProfile: profile,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);

        // Save to database
        await supabase.from('generated_looks').insert({
          user_id: user.id,
          image_url: data.imageUrl,
          prompt_used: `${styleDescription} 스타일, ${productsDescription}`,
          style_trend_id: selectedTrend?.id || null,
          product_ids: selectedProducts.map(p => p.id),
        });

        toast({
          title: '스타일 생성 완료!',
          description: '당신만의 룩이 완성되었습니다.',
        });

        fetchData(); // Refresh my looks
      }
    } catch (error) {
      console.error('Error generating style:', error);
      toast({
        title: '생성 실패',
        description: '스타일 생성 중 문제가 발생했습니다. 다시 시도해주세요.',
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
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" />
            <span className="font-display text-xl text-foreground">showmelook</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/cart')}>
              <ShoppingBag className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'generate'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            스타일 생성
          </button>
          <button
            onClick={() => setActiveTab('mylooks')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'mylooks'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            내 룩 ({myLooks.length})
          </button>
        </div>

        {activeTab === 'generate' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Selection */}
            <div className="space-y-8">
              {/* Trend Selection */}
              <div>
                <h2 className="font-display text-2xl text-foreground mb-4">트렌드 스타일 선택</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      <p className="font-medium text-foreground">{trend.name_ko}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {trend.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Selection by Category */}
              <div>
                <h2 className="font-display text-2xl text-foreground mb-4">아이템 선택</h2>
                <div className="space-y-6">
                  {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        {categoryLabels[category] || category}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                            <p className="font-medium text-foreground text-sm truncate">
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

              {/* Generate Button */}
              <Button
                variant="gold"
                size="xl"
                className="w-full"
                onClick={generateStyle}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    스타일 생성하기
                  </>
                )}
              </Button>
            </div>

            {/* Right: Generated Result */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="font-display text-2xl text-foreground mb-4">생성된 스타일</h2>
              <div className="aspect-[3/4] bg-secondary rounded-2xl overflow-hidden border border-border">
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated style"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Sparkles className="w-16 h-16 mb-4" />
                    <p className="text-lg font-medium">AI 스타일 미리보기</p>
                    <p className="text-sm mt-2">트렌드와 아이템을 선택하고 생성하세요</p>
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
        ) : (
          /* My Looks Grid */
          <div>
            {myLooks.length === 0 ? (
              <div className="text-center py-20">
                <Sparkles className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        )}
      </div>
    </div>
  );
};

export default StyleGenerator;
