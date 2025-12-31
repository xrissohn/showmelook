import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Trash2, ExternalLink, ShoppingBag, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const MyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [recommendations, setRecommendations] = useState<RecommendationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      fetchRecommendations();
    }
  }, [user, authLoading, navigate]);

  const fetchRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('recommendation_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse items from JSONB
      const parsed = (data || []).map((rec: any) => ({
        ...rec,
        items: typeof rec.items === 'string' ? JSON.parse(rec.items) : rec.items
      }));

      setRecommendations(parsed);
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      toast({
        title: "히스토리 로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  const handlePurchase = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
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
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">마이페이지</h1>
            <p className="text-sm text-muted-foreground">추천 히스토리 및 설정</p>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/recommend')}
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

        {/* Recommendation History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                  onClick={() => navigate('/recommend')}
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
      </main>
    </div>
  );
};

export default MyPage;
