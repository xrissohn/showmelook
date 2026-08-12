import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { History, Trash2, ExternalLink, ShoppingBag, Loader2, Sparkles, Heart, ShoppingCart, Crown, Users, Settings, User, Gift, Copy, Check, Link, TrendingUp, ArrowUp, ArrowDown, Image } from "lucide-react";
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
import { PLAN_CONFIG } from "@/lib/planConfig";
import { usePurchaseStats } from "@/hooks/usePurchaseStats";
import { TierStatusCard } from "@/components/mypage/TierStatusCard";
import { TierHistorySection } from "@/components/mypage/TierHistorySection";
import { CreditHistoryCard } from "@/components/mypage/CreditHistoryCard";
import { TIER_CONFIG, TierType, getTierName } from "@/lib/tierConfig";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t, language } = useLanguage();
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

  const { data: recommendations = [], isLoading: isLoadingRecs } = useRecommendationHistory();
  const { data: likedProducts = [], isLoading: isLoadingLikes } = useLikedProducts();
  
  const deleteRecommendation = useDeleteRecommendation();
  const unlikeProduct = useUnlikeProduct();
  const addToCart = useAddToCart();

  const isLoading = isLoadingRecs || isLoadingLikes || profileLoading;

  useEffect(() => {
    if (purchaseStats.recentTierChange) {
      const { previousTier, newTier, changeReason } = purchaseStats.recentTierChange;
      const prevName = getTierName(previousTier, language);
      const newName = getTierName(newTier, language);

      if (changeReason === 'purchase' || changeReason === 'admin') {
        toast({
          title: `🎉 ${newName} ${t('mypage.tierUpgrade')}`,
          description: `${prevName} → ${newName} ${t('mypage.tierUpgradeDesc')}`,
          duration: 5000,
        });
      } else if (changeReason === 'refund') {
        toast({
          title: t('mypage.tierDowngrade'),
          description: `${prevName} → ${newName} ${t('mypage.tierDowngradeDesc')}`,
          variant: "destructive",
          duration: 5000,
        });
      }

      purchaseStats.clearRecentTierChange();
    }
  }, [purchaseStats.recentTierChange, purchaseStats.clearRecentTierChange, toast, t, language]);

  const formatPrice = (price: number) => {
    if (language === 'en') {
      return `₩${new Intl.NumberFormat('en-US').format(price)}`;
    }
    return new Intl.NumberFormat('ko-KR').format(price) + t('common.won');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR', {
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
      toast({ title: t('mypage.deleteComplete'), description: t('mypage.historyDeleted') });
    } catch (error: any) {
      toast({ title: t('mypage.deleteFailed'), description: error.message, variant: "destructive" });
    }
  };

  const handleUnlike = async (productId: string) => {
    try {
      await unlikeProduct.mutateAsync(productId);
      toast({ title: t('mypage.unliked'), description: t('mypage.removedFromLikes') });
    } catch (error: any) {
      toast({ title: t('mypage.deleteFailed'), description: error.message, variant: "destructive" });
    }
  };

  const handleAddToCart = async (product: any) => {
    try {
      await addToCart.mutateAsync(product);
      toast({ title: t('mypage.addedToCart'), description: `${product.product_name} ${t('mypage.addedToCartDesc')}` });
    } catch (error: any) {
      toast({ title: t('mypage.addFailed'), description: error.message, variant: "destructive" });
    }
  };

  const handlePurchase = async (url: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: url },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
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
      <SEOHead pageKey="mypage" />
      <MainNavigation showBackButton />

      <main className="container max-w-4xl mx-auto px-4 pt-20 sm:pt-24 pb-6 space-y-6">
        <h1 className="font-korean text-xl sm:text-2xl font-bold text-foreground break-keep">
          마이페이지 - 내 등급·크레딧·스타일 관리
        </h1>
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => navigate('/style?tab=mylooks')}>
            <Image className="w-6 h-6 text-primary" />
            <span>{t('mypage.myGallery')}</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => navigate('/cart')}>
            <ShoppingBag className="w-6 h-6 text-primary" />
            <span>{t('mypage.cart')}</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="subscription" className="flex items-center gap-1 text-xs sm:text-sm">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mypage.subscription')}</span>
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex items-center gap-1 text-xs sm:text-sm">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mypage.likes')}</span> ({likedProducts.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mypage.history')}</span>
            </TabsTrigger>
            <TabsTrigger value="family" className="flex items-center gap-1 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mypage.model')}</span>
              {!subscription.canUseFamilyProfiles && <Crown className="w-3 h-3 text-amber-500" />}
            </TabsTrigger>
          </TabsList>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="mt-4 space-y-4">
            <TierStatusCard
              stats={purchaseStats.stats}
              progressToNextTier={purchaseStats.progressToNextTier}
              nextTierInfo={purchaseStats.nextTierInfo}
              tierHistory={purchaseStats.tierHistory}
              isLoading={purchaseStats.isLoading}
            />
            <TierHistorySection tierHistory={purchaseStats.tierHistory} isLoading={purchaseStats.isLoading} />
            <CreditHistoryCard
              total={referral.bonusCredits.total}
              details={referral.bonusCredits.details as any}
              currentUserId={user?.id}
            />

            {/* Referral Card */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" />
                  <CardTitle className="font-korean text-lg">{t('mypage.friendReferral')}</CardTitle>
                </div>
                <CardDescription className="font-korean">{t('mypage.inviteFriends')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {referral.referralCode && (
                  <div className="p-4 rounded-lg bg-background border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-2 font-korean">{t('mypage.myReferralLink')}</p>
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
                            toast({ title: t('mypage.copied'), description: t('mypage.copiedDesc') });
                            setTimeout(() => setLinkCopied(false), 2000);
                          }
                        }}
                      >
                        {linkCopied ? <Check className="w-4 h-4 mr-1" /> : <Link className="w-4 h-4 mr-1" />}
                        {t('mypage.copyLink')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const success = await referral.copyReferralCode();
                          if (success) {
                            setCodeCopied(true);
                            toast({ title: t('mypage.copied'), description: t('mypage.codeCopiedDesc') });
                            setTimeout(() => setCodeCopied(false), 2000);
                          }
                        }}
                      >
                        {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {t('mypage.copyCode')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 font-korean">
                      {referral.referralCode.used_count}/{referral.referralCode.max_uses}{t('mypage.referralComplete')}
                    </p>
                  </div>
                )}

                {referral.bonusCredits.total > 0 && (
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 font-korean">{t('mypage.activeBonus')}</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">+{referral.bonusCredits.total}</p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 font-korean">{t('mypage.afterDailyLimit')}</p>
                  </div>
                )}

                <div className="text-sm text-muted-foreground font-korean space-y-1">
                  <p>{t('mypage.referralInfo1')}</p>
                  <p>{t('mypage.referralInfo2')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Button variant="outline" className="w-full font-korean" onClick={() => navigate('/profile-edit')}>
                  <Settings className="w-4 h-4 mr-2" />{t('mypage.profileSettings')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Likes Tab */}
          <TabsContent value="likes" className="mt-4">
            {likedProducts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-30 text-muted-foreground" />
                  <p className="text-muted-foreground">{t('mypage.noLikedProducts')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('mypage.likeFromStyle')}</p>
                  <Button variant="link" className="mt-2" onClick={() => navigate('/style')}>
                    {t('mypage.goToStyle')}
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
                      {product.product_category && (
                        <span className="absolute top-2 left-2 text-xs bg-background/90 backdrop-blur px-2 py-0.5 rounded-full z-10">
                          {product.product_category}
                        </span>
                      )}
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
                      
                      {product.style_tags && product.style_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {product.style_tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${getTagColor(tag)}`}>{tag}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => handleAddToCart(product)} disabled={addToCart.isPending}>
                          <ShoppingCart className="w-3 h-3 mr-1" />{t('mypage.addToCart')}
                        </Button>
                        <Button variant="default" size="sm" className="flex-1 text-xs h-8" onClick={() => handlePurchase(product.product_url)}>
                          <ExternalLink className="w-3 h-3 mr-1" />{t('mypage.purchase')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="w-5 h-5" />{t('mypage.historyTitle')}
                </CardTitle>
                <CardDescription>{t('mypage.historyList')}</CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>{t('mypage.noHistory')}</p>
                    <Button variant="link" className="mt-2" onClick={() => navigate('/style')}>
                      {t('mypage.goFirstRecommend')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recommendations.map((rec) => (
                      <Card key={rec.id} className="overflow-hidden">
                        <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">{rec.style_concept || rec.prompt}</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(rec.created_at)} · {rec.gender === 'female' ? t('profileSetup.genderOptions.female') : t('profileSetup.genderOptions.male')}
                              </p>
                              <p className="text-sm font-medium text-primary mt-1">
                                {formatPrice(rec.total_price)} ({rec.items.length} {t('mypage.items')})
                              </p>
                              {rec.style_reasoning && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">💡 {rec.style_reasoning}</p>
                              )}
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('mypage.deleteHistory')}</AlertDialogTitle>
                                  <AlertDialogDescription>{t('mypage.deleteConfirm')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('mypage.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(rec.id)}>{t('mypage.delete')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {expandedId === rec.id && (
                          <div className="px-4 pb-4 border-t border-border pt-4 animate-in fade-in-50 duration-200">
                            {rec.style_reasoning && <p className="text-sm text-muted-foreground mb-4">💡 {rec.style_reasoning}</p>}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {rec.items.map((item, index) => (
                                <div key={index} className="space-y-2">
                                  <div className="aspect-square relative overflow-hidden bg-muted rounded-lg">
                                    <LazyImage src={item.image_url} alt={item.name} className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
                                    <span className="absolute top-1 left-1 text-xs bg-background/90 px-1.5 py-0.5 rounded z-10">{item.category}</span>
                                  </div>
                                  <p className="text-xs font-medium line-clamp-1">{item.name}</p>
                                  <p className="text-xs text-primary font-semibold">{formatPrice(item.price)}</p>
                                  <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => handlePurchase(item.product_url)}>
                                    <ExternalLink className="w-3 h-3 mr-1" />{t('mypage.purchase')}
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

          {/* Model Profiles Tab */}
          <TabsContent value="family" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle className="font-korean text-base">{t('mypage.myProfile')}</CardTitle>
                  <Badge variant="default" className="bg-primary text-primary-foreground">{t('mypage.main')}</Badge>
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
                        {userProfile?.full_name || user?.email?.split('@')[0] || 'Me'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground font-korean">
                      {userProfile?.gender && <span>{
                        userProfile.gender === 'male' || userProfile.gender === '남성' ? t('profileSetup.genderOptions.male') :
                        userProfile.gender === 'female' || userProfile.gender === '여성' ? t('profileSetup.genderOptions.female') :
                        userProfile.gender === 'unisex' || userProfile.gender === '유니섹스' ? t('profileSetup.genderOptions.unisex') :
                        userProfile.gender
                      }</span>}
                      {userProfile?.height && <span> · {userProfile.height}cm</span>}
                      {userProfile?.weight && <span> · {userProfile.weight}kg</span>}
                      {userProfile?.body_type && <span> · {
                        userProfile.body_type === 'slim' ? t('profileSetup.bodyTypes.slim') :
                        userProfile.body_type === 'average' ? t('profileSetup.bodyTypes.average') :
                        userProfile.body_type === 'muscular' ? t('profileSetup.bodyTypes.muscular') :
                        userProfile.body_type === 'curvy' ? t('profileSetup.bodyTypes.curvy') :
                        userProfile.body_type
                      }</span>}
                    </div>
                    {userProfile?.style_preferences && userProfile.style_preferences.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {userProfile.style_preferences.slice(0, 3).map((pref, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{pref}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/profile-edit')} className="text-xs">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {subscription.canUseFamilyProfiles ? (
              <FamilyProfileManager userId={user?.id || ''} maxProfiles={5} />
            ) : (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="font-korean text-base">{t('mypage.additionalModel')}</CardTitle>
                    <Badge variant="outline" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                      <Crown className="w-3 h-3 mr-1" />{t('mypage.platinumModel')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4 font-korean text-sm whitespace-pre-line">{t('mypage.platinumModelDesc')}</p>
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Crown className="w-4 h-4 text-amber-500" />{t('mypage.perMillion')}</span>
                      <span className="flex items-center gap-1"><Sparkles className="w-4 h-4 text-primary" />{t('mypage.faceMerge')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('mypage.achievePlatinum')}</p>
                    <Button variant="hero" onClick={() => navigate('/pricing')} className="font-korean">
                      <Crown className="w-4 h-4 mr-2" />{t('mypage.viewTierBenefits')}
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
