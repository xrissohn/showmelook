import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { History, Trash2, ExternalLink, ShoppingBag, Loader2, Sparkles, Heart, ShoppingCart, Crown, Users, Settings, User, Gift, Copy, Check, Link, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useReferral } from "@/hooks/useReferral";
import { supabase } from "@/integrations/supabase/client";
import { LazyImage } from "@/components/LazyImage";
import MainNavigation from "@/components/MainNavigation";
import { FamilyProfileManager } from "@/components/profile/FamilyProfileManager";
import { PLAN_CONFIG, formatPrice } from "@/lib/planConfig";
import { usePurchaseStats } from "@/hooks/usePurchaseStats";
import { TierStatusCard } from "@/components/mypage/TierStatusCard";
import { TierHistorySection } from "@/components/mypage/TierHistorySection";
import { TIER_CONFIG, TierType } from "@/lib/tierConfig";
import { 
  useRecommendationHistory, 
  useLikedProducts, 
  useDeleteRecommendation, 
  useUnlikeProduct, 
  useAddToCart 
} from "@/hooks/useMyPageData";
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

const MyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const subscription = useSubscription(user?.id);
  const { profile: userProfile, isLoading: profileLoading } = useUserProfile();
  const referral = useReferral(user?.id);
  const purchaseStats = usePurchaseStats(user?.id);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("subscription");
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // React Query 훅 사용 (5분 캐싱)
  const { data: recommendations = [], isLoading: isLoadingRecs } = useRecommendationHistory();
  const { data: likedProducts = [], isLoading: isLoadingLikes } = useLikedProducts();
  
  // Mutations
  const deleteRecommendation = useDeleteRecommendation();
  const unlikeProduct = useUnlikeProduct();
  const addToCart = useAddToCart();

  const isLoading = isLoadingRecs || isLoadingLikes || profileLoading;

  // 등급 변동 토스트 알림
  useEffect(() => {
    if (purchaseStats.recentTierChange) {
      const { previousTier, newTier, changeReason } = purchaseStats.recentTierChange;
      const prevConfig = TIER_CONFIG[previousTier];
      const newConfig = TIER_CONFIG[newTier];
      
      if (changeReason === 'purchase' || changeReason === 'admin') {
        // 업그레이드
        toast({
          title: `🎉 ${newConfig.nameKo} 등급 달성!`,
          description: `축하합니다! ${prevConfig.nameKo}에서 ${newConfig.nameKo}로 업그레이드되었습니다.`,
          duration: 5000,
        });
      } else if (changeReason === 'refund') {
        // 다운그레이드
        toast({
          title: `등급이 변경되었습니다`,
          description: `환불 반영으로 ${prevConfig.nameKo}에서 ${newConfig.nameKo}로 변경되었습니다.`,
          variant: "destructive",
          duration: 5000,
        });
      }
      
      purchaseStats.clearRecentTierChange();
    }
  }, [purchaseStats.recentTierChange, purchaseStats.clearRecentTierChange, toast]);

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

  const handleDelete = async (id: string) => {
    try {
      await deleteRecommendation.mutateAsync(id);
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
      await unlikeProduct.mutateAsync(productId);
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

  const handleAddToCart = async (product: any) => {
    try {
      await addToCart.mutateAsync(product);
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

  // 인증 리다이렉트
  if (!authLoading && !user) {
    navigate('/auth');
    return null;
  }

  if (authLoading || isLoading || subscription.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const planConfig = PLAN_CONFIG[subscription.plan];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - using shared navigation */}
      <MainNavigation showBackButton />

      <main className="container max-w-4xl mx-auto px-4 pt-20 sm:pt-24 pb-6 space-y-6">
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="subscription" className="flex items-center gap-1 text-xs sm:text-sm">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">구독</span>
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex items-center gap-1 text-xs sm:text-sm">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">관심</span> ({likedProducts.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">히스토리</span>
            </TabsTrigger>
            <TabsTrigger value="family" className="flex items-center gap-1 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">모델</span>
              {!subscription.canUseFamilyProfiles && (
                <Crown className="w-3 h-3 text-amber-500" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* 구독 상태 탭 */}
          <TabsContent value="subscription" className="mt-4 space-y-4">
            {/* 구매 기반 등급 카드 */}
            <TierStatusCard
              stats={purchaseStats.stats}
              progressToNextTier={purchaseStats.progressToNextTier}
              nextTierInfo={purchaseStats.nextTierInfo}
              tierHistory={purchaseStats.tierHistory}
              isLoading={purchaseStats.isLoading}
            />

            {/* 등급 변동 이력 */}
            <TierHistorySection
              tierHistory={purchaseStats.tierHistory}
              isLoading={purchaseStats.isLoading}
            />

            {/* 친구 추천 카드 */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" />
                  <CardTitle className="font-korean text-lg">친구 추천</CardTitle>
                </div>
                <CardDescription className="font-korean">
                  친구를 초대하고 보너스를 받으세요!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 내 추천 링크 */}
                {referral.referralCode && (
                  <div className="p-4 rounded-lg bg-background border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-2 font-korean">내 추천 링크</p>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="flex-1 text-sm text-primary truncate">
                        showmelook.com/auth?ref={referral.referralCode.code}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="flex-1 font-korean"
                        onClick={async () => {
                          const success = await referral.copyReferralLink();
                          if (success) {
                            setLinkCopied(true);
                            toast({ title: '복사됨!', description: '추천 링크가 클립보드에 복사되었습니다.' });
                            setTimeout(() => setLinkCopied(false), 2000);
                          }
                        }}
                      >
                        {linkCopied ? <Check className="w-4 h-4 mr-1" /> : <Link className="w-4 h-4 mr-1" />}
                        링크 복사
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const success = await referral.copyReferralCode();
                          if (success) {
                            setCodeCopied(true);
                            toast({ title: '복사됨!', description: '추천 코드가 클립보드에 복사되었습니다.' });
                            setTimeout(() => setCodeCopied(false), 2000);
                          }
                        }}
                      >
                        {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        코드
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 font-korean">
                      {referral.referralCode.used_count}/{referral.referralCode.max_uses}명 추천 완료
                    </p>
                  </div>
                )}

                {/* 보너스 크레딧 */}
                {referral.bonusCredits.total > 0 && (
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 font-korean">활성 보너스</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">
                      +{referral.bonusCredits.total}회
                    </p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 font-korean">
                      일일 한도 소진 후 사용 가능
                    </p>
                  </div>
                )}

                {/* 리워드 안내 */}
                <div className="text-sm text-muted-foreground font-korean space-y-1">
                  <p>• Free/Pro: 추천 시 보너스 5회 (30일간 유효)</p>
                  <p>• Premium: 추천 시 프로필 슬롯 +1 (영구)</p>
                </div>
              </CardContent>
            </Card>

            {/* 프로필 설정 링크 */}
            <Card>
              <CardContent className="p-4">
                <Button
                  variant="outline"
                  className="w-full font-korean"
                  onClick={() => navigate('/profile-edit')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  프로필 설정
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

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
                      <LazyImage
                        src={product.product_image_url}
                        alt={product.product_name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        fallbackClassName="w-full h-full"
                      />
                      {/* Category Badge */}
                      {product.product_category && (
                        <span className="absolute top-2 left-2 text-xs bg-background/90 backdrop-blur px-2 py-0.5 rounded-full z-10">
                          {product.product_category}
                        </span>
                      )}
                      {/* Unlike Button */}
                      <button
                        onClick={() => handleUnlike(product.id)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 z-10"
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
                          disabled={addToCart.isPending}
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
                                {formatDate(rec.created_at)} · {rec.gender === 'female' ? '여성' : '남성'}
                              </p>
                              <p className="text-sm font-medium text-primary mt-1">
                                총 {formatPrice(rec.total_price)} ({rec.items.length}개 아이템)
                              </p>
                              {/* AI 스타일 추천 설명 */}
                              {rec.style_reasoning && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                  💡 {rec.style_reasoning}
                                </p>
                              )}
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
                                💡 {rec.style_reasoning}
                              </p>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {rec.items.map((item, index) => (
                                <div key={index} className="space-y-2">
                                  <div className="aspect-square relative overflow-hidden bg-muted rounded-lg">
                                    <LazyImage
                                      src={item.image_url}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      fallbackClassName="w-full h-full"
                                    />
                                    <span className="absolute top-1 left-1 text-xs bg-background/90 px-1.5 py-0.5 rounded z-10">
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

          {/* 모델 프로필 탭 */}
          <TabsContent value="family" className="mt-4 space-y-4">
            {/* 내 프로필 (항상 표시) */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle className="font-korean text-base">내 프로필</CardTitle>
                  <Badge variant="default" className="bg-primary text-primary-foreground">메인</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={userProfile?.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-lg">
                      {userProfile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-korean">
                        {userProfile?.full_name || user?.email?.split('@')[0] || '나'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground font-korean">
                      {userProfile?.gender && <span>{userProfile.gender}</span>}
                      {userProfile?.height && <span> · {userProfile.height}cm</span>}
                      {userProfile?.weight && <span> · {userProfile.weight}kg</span>}
                      {userProfile?.body_type && <span> · {userProfile.body_type === 'slim' ? '마른 체형' : userProfile.body_type === 'average' ? '보통 체형' : userProfile.body_type === 'muscular' ? '근육질' : userProfile.body_type === 'curvy' ? '볼륨 체형' : userProfile.body_type}</span>}
                    </div>
                    {userProfile?.style_preferences && userProfile.style_preferences.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {userProfile.style_preferences.slice(0, 3).map((pref, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {pref}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/profile-edit')}
                    className="text-xs"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 추가 모델 섹션 - Premium만 */}
            {subscription.canUseFamilyProfiles ? (
              <FamilyProfileManager 
                userId={user?.id || ''} 
                maxProfiles={5}
              />
            ) : (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="font-korean text-base">추가 모델</CardTitle>
                    <Badge variant="outline" className="text-amber-500 border-amber-500">
                      <Crown className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4 font-korean text-sm">
                    Premium 플랜에서 최대 5명의 추가 모델을 등록하고,<br />
                    그들을 위한 스타일 룩을 생성할 수 있어요.
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Crown className="w-4 h-4 text-amber-500" />
                        최대 5명
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-primary" />
                        얼굴 합성
                      </span>
                    </div>
                    <Button
                      variant="hero"
                      onClick={() => navigate('/pricing')}
                      className="font-korean"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Premium으로 업그레이드
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MyPage;
