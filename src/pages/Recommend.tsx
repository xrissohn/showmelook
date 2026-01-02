import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ShoppingBag, ExternalLink, Loader2, Plus, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface RecommendedItem {
  category: string;
  name: string;
  price: number;
  image_url: string;
  product_url: string;
  affiliate_url?: string;
  brand?: string;
  addedToCart?: boolean;
}

interface RecommendationResult {
  items: RecommendedItem[];
  totalPrice: number;
  styleGuide: {
    concept: string;
    reasoning: string;
  };
}

const Recommend = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [stylePrompt, setStylePrompt] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [budget, setBudget] = useState([200000]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [addingToCart, setAddingToCart] = useState<Set<number>>(new Set());

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원';
  };

  const handleSubmit = async () => {
    if (!stylePrompt.trim()) {
      toast({
        title: "스타일 프롬프트를 입력해주세요",
        variant: "destructive",
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
          forceRefresh: false
        }
      });

      if (error) throw error;

      if (data.success && data.look) {
        // Generate affiliate URLs for each item
        const itemsWithAffiliateUrls = await Promise.all(
          data.look.items.map(async (item: RecommendedItem) => {
            try {
              const { data: deeplinkData } = await supabase.functions.invoke('deeplink', {
                body: { product_url: item.product_url }
              });
              return {
                ...item,
                affiliate_url: deeplinkData?.affiliate_url || item.product_url
              };
            } catch {
              return { ...item, affiliate_url: item.product_url };
            }
          })
        );

        setResult({
          items: itemsWithAffiliateUrls,
          totalPrice: data.look.totalPrice,
          styleGuide: data.look.styleGuide
        });

        // Save to history if user is logged in
        if (user) {
          try {
            await supabase.from('recommendation_history').insert({
              user_id: user.id,
              prompt: stylePrompt,
              gender,
              budget: budget[0],
              style_concept: data.look.styleGuide?.concept || '',
              style_reasoning: data.look.styleGuide?.reasoning || '',
              items: itemsWithAffiliateUrls,
              total_price: data.look.totalPrice
            });
          } catch (saveError) {
            console.error('Failed to save to history:', saveError);
          }
        }

        toast({
          title: "스타일 추천 완료!",
          description: `${itemsWithAffiliateUrls.length}개의 아이템을 추천해드렸어요.`,
        });
      } else {
        throw new Error(data.error || '추천 실패');
      }
    } catch (error: any) {
      console.error('Recommendation error:', error);
      toast({
        title: "추천 실패",
        description: error.message || "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAddToCart = async (item: RecommendedItem, index: number) => {
    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "장바구니 기능을 사용하려면 로그인해주세요.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    setAddingToCart(prev => new Set(prev).add(index));

    try {
      // First, check if product exists in products table, if not create it
      let productId: string;
      
      // Try to find existing product by URL
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('external_url', item.product_url)
        .maybeSingle();

      if (existingProduct) {
        productId = existingProduct.id;
      } else {
        // Create new product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            name: item.name,
            name_ko: item.name,
            price: item.price,
            category: item.category,
            brand: item.brand || null,
            image_url: item.image_url,
            external_url: item.product_url,
            is_active: true
          })
          .select('id')
          .single();

        if (productError) throw productError;
        productId = newProduct.id;
      }

      // Add to cart
      const { error: cartError } = await supabase
        .from('cart_items')
        .insert({
          user_id: user.id,
          product_id: productId,
          quantity: 1
        });

      if (cartError) {
        if (cartError.code === '23505') {
          toast({
            title: "이미 장바구니에 있어요",
            description: "해당 상품은 이미 장바구니에 담겨있습니다.",
          });
        } else {
          throw cartError;
        }
      } else {
        // Mark as added
        if (result) {
          const updatedItems = [...result.items];
          updatedItems[index] = { ...updatedItems[index], addedToCart: true };
          setResult({ ...result, items: updatedItems });
        }

        toast({
          title: "장바구니에 담겼어요",
          description: `${item.name}이(가) 장바구니에 추가되었습니다.`,
        });
      }
    } catch (error: any) {
      console.error('Add to cart error:', error);
      toast({
        title: "장바구니 추가 실패",
        description: error.message || "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setAddingToCart(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">AI 스타일 추천</h1>
            <p className="text-sm text-muted-foreground">당신만의 완벽한 룩을 찾아드려요</p>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              스타일 정보 입력
            </CardTitle>
            <CardDescription>
              원하는 스타일을 자세히 설명해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Style Prompt */}
            <div className="space-y-2">
              <Label htmlFor="stylePrompt">스타일 프롬프트</Label>
              <Textarea
                id="stylePrompt"
                placeholder="예: 봄 데이트룩, 화사하고 로맨틱한 느낌으로 원피스나 블라우스 위주로 추천해줘"
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isLoading}
              />
            </div>

            {/* Gender Selection */}
            <div className="space-y-3">
              <Label>성별</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as "female" | "male")}
                className="flex gap-4"
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="cursor-pointer">여성</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="cursor-pointer">남성</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Budget Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>예산</Label>
                <span className="text-lg font-semibold text-primary">
                  {formatPrice(budget[0])}
                </span>
              </div>
              <Slider
                value={budget}
                onValueChange={setBudget}
                min={50000}
                max={1000000}
                step={10000}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5만원</span>
                <span>100만원</span>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit} 
              className="w-full" 
              size="lg"
              disabled={isLoading || !stylePrompt.trim()}
            >
              {isLoading ? (
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
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            {/* Style Concept */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">🎨 {result.styleGuide.concept}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{result.styleGuide.reasoning}</p>
              </CardContent>
            </Card>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {result.items.map((item, index) => (
                <Card key={index} className="overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="text-xs bg-background/90 px-2 py-1 rounded-full font-medium">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    {item.brand && (
                      <p className="text-xs text-muted-foreground">{item.brand}</p>
                    )}
                    <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
                      {item.name}
                    </p>
                    <p className="text-base font-bold text-primary">
                      {formatPrice(item.price)}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant={item.addedToCart ? "secondary" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAddToCart(item, index)}
                        disabled={addingToCart.has(index) || item.addedToCart}
                      >
                        {addingToCart.has(index) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : item.addedToCart ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            담김
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 mr-1" />
                            담기
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePurchase(item.affiliate_url || item.product_url)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        구매
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Total Price */}
            <Card>
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">총 예상 금액</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(result.totalPrice)}
                  </span>
                </div>
                {result.totalPrice > budget[0] && (
                  <p className="text-sm text-destructive mt-2">
                    ⚠️ 예산을 {formatPrice(result.totalPrice - budget[0])} 초과했어요
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setResult(null);
                  setStylePrompt("");
                }}
              >
                다시 추천받기
              </Button>
              <Button 
                variant="default"
                className="flex-1"
                onClick={() => navigate('/cart')}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                장바구니 보기
              </Button>
            </div>
            {user && (
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate('/mypage')}
              >
                <User className="w-4 h-4 mr-2" />
                마이페이지에서 히스토리 보기
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Recommend;
