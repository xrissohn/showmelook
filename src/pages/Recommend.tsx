import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, ShoppingBag, ArrowLeft, ExternalLink, Heart, Lightbulb } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

interface RecommendedProduct {
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

interface RecommendResult {
  items: RecommendedProduct[];
  styleConcept: string;
  styleReasoning: string;
  totalPrice: number;
}

const styleExamples = [
  { emoji: '☕', text: '편안한 카페 데이트룩' },
  { emoji: '💼', text: '캐주얼 오피스룩' },
  { emoji: '🌸', text: '봄나들이 페미닌 코디' },
  { emoji: '🖤', text: '모던 시크 룩' },
  { emoji: '🏃', text: '스포티 캐주얼' },
  { emoji: '✨', text: '파티 글램 룩' },
];

const Recommend = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stylePrompt, setStylePrompt] = useState('');
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [budget, setBudget] = useState([200000]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const handleRecommend = async () => {
    if (!stylePrompt.trim()) {
      toast({
        title: '스타일을 입력해주세요',
        description: '원하는 스타일이나 상황을 설명해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest: stylePrompt,
          gender: gender === 'female' ? '여성' : '남성',
          budget: budget[0],
          forceRefresh: false,
        },
      });

      if (error) throw error;

      if (data.success && data.look) {
        const transformedItems: RecommendedProduct[] = data.look.items
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
            affiliate_url: item.affiliateUrl,
          }));

        setResult({
          items: transformedItems,
          styleConcept: data.look.name || '스타일 추천',
          styleReasoning: data.look.stylingTips || '',
          totalPrice: data.look.totalPrice || 0,
        });

        toast({
          title: data.cacheHit ? '💾 저장된 스타일!' : '✨ 스타일 추천 완료!',
          description: `${transformedItems.length}개의 아이템을 추천해드렸어요.`,
        });
      } else {
        throw new Error(data.error || '추천 실패');
      }
    } catch (error: any) {
      console.error('Recommendation error:', error);
      toast({
        title: '추천 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBuyClick = (product: RecommendedProduct) => {
    // 딥링크가 있으면 사용, 없으면 원본 URL
    const url = product.affiliate_url || product.product_url;
    window.open(url, '_blank');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
            <img src={showmelookLogo} alt="쇼미룩" className="w-8 h-8 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[60px] object-contain -ml-2" />
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            뒤로
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            AI 스타일 추천
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-korean">
            어떤 스타일을 찾으세요?
          </h1>
          <p className="text-muted-foreground font-korean">
            원하는 스타일이나 상황을 알려주시면 맞춤 코디를 추천해드려요
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6 shadow-sm">
          {/* Style Prompt */}
          <div className="space-y-3 mb-6">
            <Label className="font-korean text-base font-medium">스타일 설명</Label>
            <Input
              placeholder="예: 편안한 카페 데이트룩"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              className="h-12 text-base"
            />
            {/* Quick Examples */}
            <div className="flex flex-wrap gap-2">
              {styleExamples.map((example) => (
                <button
                  key={example.text}
                  onClick={() => setStylePrompt(example.text)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-secondary/50 hover:bg-secondary rounded-full text-xs font-korean transition-colors"
                >
                  <span>{example.emoji}</span>
                  <span>{example.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-3 mb-6">
            <Label className="font-korean text-base font-medium">성별</Label>
            <RadioGroup
              value={gender}
              onValueChange={(v) => setGender(v as 'female' | 'male')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female" className="font-korean cursor-pointer">여성</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male" className="font-korean cursor-pointer">남성</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Budget */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <Label className="font-korean text-base font-medium">예산</Label>
              <span className="text-accent font-bold">₩{formatPrice(budget[0])}</span>
            </div>
            <Slider
              value={budget}
              onValueChange={setBudget}
              min={50000}
              max={500000}
              step={10000}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>₩50,000</span>
              <span>₩500,000</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleRecommend}
            disabled={isLoading || !stylePrompt.trim()}
            className="w-full h-12 text-base font-korean bg-gradient-to-r from-accent to-primary hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                AI가 스타일을 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                스타일 추천받기
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-fade-in">
            {/* Style Concept Card */}
            <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl p-6 border border-accent/20">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground font-korean mb-1">
                    {result.styleConcept}
                  </h3>
                  <p className="text-sm text-muted-foreground font-korean leading-relaxed">
                    {result.styleReasoning}
                  </p>
                </div>
              </div>
            </div>

            {/* Total Price */}
            <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 rounded-xl">
              <span className="font-korean text-muted-foreground">총 가격</span>
              <span className="font-bold text-xl text-foreground">₩{formatPrice(result.totalPrice)}</span>
            </div>

            {/* Product Cards */}
            <div className="space-y-4">
              <h3 className="font-korean font-bold text-lg">추천 아이템 ({result.items.length}개)</h3>
              
              {result.items.map((product) => (
                <div
                  key={product.id}
                  className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex">
                    {/* Product Image */}
                    <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 bg-secondary">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs text-accent font-medium">{product.category}</span>
                            <h4 className="font-korean font-medium text-sm sm:text-base text-foreground line-clamp-2">
                              {product.name}
                            </h4>
                            {product.brand && (
                              <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>
                            )}
                          </div>
                          <button
                            onClick={() => toggleFavorite(product.id)}
                            className="p-1.5 hover:bg-secondary rounded-full transition-colors flex-shrink-0"
                          >
                            <Heart
                              className={`w-5 h-5 transition-colors ${
                                favorites.has(product.id)
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </button>
                        </div>
                        
                        {/* Style Tags */}
                        {product.style_tags && product.style_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.style_tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-foreground">₩{formatPrice(product.price)}</span>
                        <Button
                          size="sm"
                          onClick={() => handleBuyClick(product)}
                          className="gap-1 bg-accent hover:bg-accent/90 text-white"
                        >
                          구매하기
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Retry Button */}
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setStylePrompt('');
              }}
              className="w-full font-korean"
            >
              다른 스타일 추천받기
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Recommend;
