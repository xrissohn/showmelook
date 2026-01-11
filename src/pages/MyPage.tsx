import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Trash2, ExternalLink, ShoppingBag, Loader2, Sparkles, Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RecommendationItem {
  category: string;
  name: string;
  price: number;
  image_url: string;
  product_url: string;
  brand?: string;
}

interface RecommendationHistory {
  id: string;
  prompt: string;
  gender: string;
  budget: number;
  style_concept: string;
  style_reasoning: string;
  items: RecommendationItem[];
  total_price: number;
  created_at: string;
}

interface LikedProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_price: number;
  product_image_url: string | null;
  product_url: string;
  product_category: string | null;
  style_tags: string[] | null;
  created_at: string;
}

const MyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [recommendations, setRecommendations] = useState<RecommendationHistory[]>([]);
  const [likedProducts, setLikedProducts] = useState<LikedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("likes");

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchData();
    }
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchRecommendations(), fetchLikedProducts()]);
    setIsLoading(false);
  };

  const fetchRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('recommendation_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const parsed = (data || []).map((rec: any) => ({
        ...rec,
        items: typeof rec.items === 'string' ? JSON.parse(rec.items) : rec.items
      }));

      setRecommendations(parsed);
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const fetchLikedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('liked_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLikedProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching liked products:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recommendation_history')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecommendations(prev => prev.filter(r => r.id !== id));
      toast({
        title: "삭제 완료",
        description: "추천 히스토리가 삭제되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnlike = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('liked_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setLikedProducts(prev => prev.filter(p => p.id !== productId));
      toast({
        title: "좋아요 취소",
        description: "관심 상품에서 제거되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddToCart = async (product: LikedProduct) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('cart_items').upsert({
        user_id: user.id,
        product_id: product.product_id,
        quantity: 1,
        product_source: 'cache',
        product_name: product.product_name,
        product_brand: product.product_brand,
        product_price: product.product_price,
        product_image_url: product.product_image_url,
        product_url: product.product_url,
      }, {
        onConflict: 'user_id,product_id'
      });

      if (error) throw error;

      toast({
        title: "장바구니에 추가됨",
        description: `${product.product_name}이(가) 장바구니에 추가되었습니다.`,
      });
    } catch (error: any) {
      toast({
        title: "추가 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePurchase = async (url: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: url }
      });

      if (error) throw error;

      if (data?.success && data?.affiliate_url) {
        window.open(data.affiliate_url, '_blank', 'noopener,noreferrer');
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getTagColor = (tag: string): string => {
    const colorMap: Record<string, string> = {
      '캐주얼': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      '미니멀': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      '스트릿': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      '클래식': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      '스포티': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      '페미닌': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    };
    return colorMap[tag] || 'bg-secondary text-muted-foreground';
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">마이페이지</h1>
              <p className="text-sm text-muted-foreground">관심 상품 및 추천 히스토리</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigate('/cart')}>
            <ShoppingBag className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/style')}
          >
            <Sparkles className="w-6 h-6 text-primary" />
            <span>새 추천받기</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/cart')}
          >
            <ShoppingBag className="w-6 h-6 text-primary" />
            <span>장바구니</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="likes" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              관심 상품 ({likedProducts.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              추천 히스토리
            </TabsTrigger>
          </TabsList>

          {/* 관심 상품 탭 */}
          <TabsContent value="likes" className="mt-4">
            {likedProducts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-30 text-muted-foreground" />
                  <p className="text-muted-foreground">아직 관심 상품이 없어요</p>
                  <p className="text-sm text-muted-foreground mt-1">스타일 추천에서 마음에 드는 상품에 좋아요를 눌러보세요!</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => navigate('/style')}
                  >
                    스타일 추천받으러 가기
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {likedProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden group">
                    <div className="aspect-square relative bg-muted">
                      {product.product_image_url ? (
                        <img
                          src={product.product_image_url}
                          alt={product.product_name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Category Badge */}
                      {product.product_category && (
                        <span className="absolute top-2 left-2 text-xs bg-background/90 backdrop-blur px-2 py-0.5 rounded-full">
                          {product.product_category}
                        </span>
                      )}
                      {/* Unlike Button */}
                      <button
                        onClick={() => handleUnlike(product.id)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                      >
                        <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                      </button>
                    </div>
                    <CardContent className="p-3 space-y-2">
                      {product.product_brand && (
                        <p className="text-xs text-accent font-medium truncate">{product.product_brand}</p>
                      )}
                      <p className="text-sm font-medium line-clamp-2 leading-tight">{product.product_name}</p>
                      <p className="text-sm font-bold text-primary">{formatPrice(product.product_price)}</p>
                      
                      {/* Style Tags */}
                      {product.style_tags && product.style_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {product.style_tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${getTagColor(tag)}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => handleAddToCart(product)}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          담기
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => handlePurchase(product.product_url)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          구매
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 추천 히스토리 탭 */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="w-5 h-5" />
                  추천 히스토리
                </CardTitle>
                <CardDescription>
                  지금까지 받은 스타일 추천 목록
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>아직 추천 받은 스타일이 없어요</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => navigate('/style')}
                    >
                      첫 추천 받으러 가기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recommendations.map((rec) => (
                      <Card key={rec.id} className="overflow-hidden">
                        <div
                          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">
                                {rec.style_concept || rec.prompt}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(rec.created_at)} · {rec.gender === 'female' ? '여성' : '남성'} · 예산 {formatPrice(rec.budget)}
                              </p>
                              <p className="text-sm font-medium text-primary mt-1">
                                총 {formatPrice(rec.total_price)} ({rec.items.length}개 아이템)
                              </p>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>히스토리 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    이 추천 히스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(rec.id)}>
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedId === rec.id && (
                          <div className="px-4 pb-4 border-t border-border pt-4 animate-in fade-in-50 duration-200">
                            {rec.style_reasoning && (
                              <p className="text-sm text-muted-foreground mb-4">
                                {rec.style_reasoning}
                              </p>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {rec.items.map((item, index) => (
                                <div key={index} className="space-y-2">
                                  <div className="aspect-square relative overflow-hidden bg-muted rounded-lg">
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                                      </div>
                                    )}
                                    <span className="absolute top-1 left-1 text-xs bg-background/90 px-1.5 py-0.5 rounded">
                                      {item.category}
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium line-clamp-1">{item.name}</p>
                                  <p className="text-xs text-primary font-semibold">{formatPrice(item.price)}</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs h-7"
                                    onClick={() => handlePurchase(item.product_url)}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    구매
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MyPage;