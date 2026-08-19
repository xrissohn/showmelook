import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShoppingBag, ShoppingCart, ExternalLink, Check, Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useGuestCart";
import MainNavigation from "@/components/MainNavigation";
import { getProductAffiliateDisclosure } from "@/lib/affiliateDisclosure";
import { WatermarkOverlay } from "@/components/style/WatermarkOverlay";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdsContentReady } from "@/hooks/useAdsContentReady";
import LookEditorialNotes from "@/components/style/LookEditorialNotes";


// 카카오톡 인앱 브라우저 감지
const isKakaoInAppBrowser = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('kakaotalk');
};

// iOS 감지
const isIOS = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

// Android 감지
const isAndroid = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
};

// 외부 브라우저로 열기 시도
const openInExternalBrowser = (url: string): void => {
  if (isAndroid()) {
    // Android: Chrome Intent로 열기
    const intentUrl = `intent://${url.replace('https://', '')}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
  } else if (isIOS()) {
    // iOS: 다양한 방법 시도
    // 1. x-safari-https 스키마 시도 (일부 앱에서 지원)
    window.location.href = url;
  }
};

interface Product {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  product_url: string;
  category: string;
  affiliate_url?: string;
  merchant_id?: string | null;
}

interface LookData {
  id: string;
  image_url: string;
  prompt_used: string | null;
  created_at: string;
  tags: string[] | null;
  product_ids: string[] | null;
  products?: Product[];
}

// Helper to update document meta tags dynamically
const updateMetaTags = (metadata: {
  title: string;
  description: string;
  image: string;
  url: string;
}) => {
  // Update title
  document.title = metadata.title;

  // Helper to set meta content
  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) {
      el.setAttribute("content", content);
    }
  };

  // Update OG tags
  setMeta('meta[property="og:title"]', metadata.title);
  setMeta('meta[property="og:description"]', metadata.description);
  setMeta('meta[property="og:image"]', metadata.image);
  setMeta('meta[property="og:url"]', metadata.url);

  // Update Twitter tags
  setMeta('meta[name="twitter:title"]', metadata.title);
  setMeta('meta[name="twitter:description"]', metadata.description);
  setMeta('meta[name="twitter:image"]', metadata.image);
  setMeta('meta[name="twitter:url"]', metadata.url);

  // Update description
  setMeta('meta[name="description"]', metadata.description);

  // Self-referencing canonical for this look page
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = metadata.url;
};

// Inject / remove Product JSON-LD for the shared look
const LOOK_JSONLD_ID = 'shared-look-jsonld';
const setLookJsonLd = (data: Record<string, unknown> | null) => {
  document.getElementById(LOOK_JSONLD_ID)?.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = LOOK_JSONLD_ID;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
};

const SharedLook = () => {
  const { t } = useLanguage();
  const { lookId } = useParams<{ lookId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const guestCart = useGuestCart();
  const [look, setLook] = useState<LookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());
  const [showKakaoRedirectUI, setShowKakaoRedirectUI] = useState(false);
  useAdsContentReady(!loading && !error && Boolean(look));
  const [isKakaoWebView, setIsKakaoWebView] = useState(false);

  // 카카오톡 인앱 브라우저 감지 및 외부 브라우저 열기 시도
  useEffect(() => {
    if (isKakaoInAppBrowser()) {
      setIsKakaoWebView(true);
      
      // Android에서는 자동 리다이렉트 시도
      if (isAndroid()) {
        openInExternalBrowser(window.location.href);
        // 리다이렉트가 실패하면 UI 표시
        setTimeout(() => {
          setShowKakaoRedirectUI(true);
        }, 500);
      } else {
        // iOS에서는 바로 UI 표시 (자동 리다이렉트가 어려움)
        setShowKakaoRedirectUI(true);
      }
    }
  }, []);

  useEffect(() => {
    const fetchLook = async () => {
      if (!lookId) {
        setError(t('sharedLook.styleNotFound'));
        setLoading(false);
        return;
      }

      try {
        // Fetch the look
        const { data: rawLookData, error: lookError } = await supabase
          .from("generated_looks_public" as any)
          .select("*")
          .eq("id", lookId)
          .single();

        if (lookError || !rawLookData) {
          setError(t('sharedLook.notFoundDesc'));
          setLoading(false);
          return;
        }

        const lookData = rawLookData as any;

        // Get signed URL for the image
        let imageUrl = lookData.image_url;
        if (imageUrl && imageUrl.includes("generated-looks/")) {
          const path = imageUrl.split("generated-looks/").pop();
          if (path) {
            const { data: signedData } = await supabase.storage
              .from("generated-looks")
              .createSignedUrl(path, 3600);
            if (signedData?.signedUrl) {
              imageUrl = signedData.signedUrl;
            }
          }
        }

        // Update OG meta tags dynamically
        const description = lookData.prompt_used 
          ? lookData.prompt_used.slice(0, 100) + (lookData.prompt_used.length > 100 ? "..." : "")
          : "AI Style Recommendation";
        
        const tagStr = lookData.tags?.slice(0, 3).map((t: string) => `#${t}`).join(" ") || "";

        const titleCore = (lookData.tags?.slice(0, 2).join(", ")
          || (lookData.prompt_used ? lookData.prompt_used.slice(0, 24) : ""))
          .trim();
        const dynamicTitle = titleCore
          ? `${titleCore} 코디 | 쇼미룩 AI 스타일`
          : "AI 스타일 코디 | 쇼미룩";

        updateMetaTags({
          title: dynamicTitle.slice(0, 60),
          description: `${description} ${tagStr}`.trim(),
          image: imageUrl,
          url: `https://showmelook.com/look/${lookId}`,
        });

        // Fetch products if product_ids exist
        let products: Product[] = [];
        if (lookData.product_ids && lookData.product_ids.length > 0) {
          const { data: productsData } = await supabase
            .from("products_cache")
            .select("*")
            .in("id", lookData.product_ids);

          if (productsData) {
            // Generate affiliate URLs for products
            const { data: { session } } = await supabase.auth.getSession();
            products = await Promise.all(
              productsData.map(async (product) => {
                let affiliate_url = product.product_url;
                try {
                  const response = await supabase.functions.invoke("deeplink", {
                    body: { product_url: product.product_url, product_name: product.name, product_price: product.price },
                    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
                  });
                  if (response.data?.affiliate_url) {
                    affiliate_url = response.data.affiliate_url;
                  }
                } catch (e) {
                  console.error("Deeplink error:", e);
                }
                return { ...product, affiliate_url };
              })
            );
          }
        }

        setLook({
          ...lookData,
          image_url: imageUrl,
          products,
        } as LookData);

        setLookJsonLd({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: dynamicTitle,
          url: `https://showmelook.com/look/${lookId}`,
          numberOfItems: products.length,
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Product',
              name: p.name,
              image: p.image_url || imageUrl,
              url: `https://showmelook.com/look/${lookId}`,
              ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
              ...(p.price
                ? {
                    offers: {
                      '@type': 'Offer',
                      price: p.price,
                      priceCurrency: 'KRW',
                      availability: 'https://schema.org/InStock',
                    },
                  }
                : {}),
            },
          })),
        });
      } catch (e) {
        console.error("Error fetching look:", e);
        setError(t('sharedLook.styleNotFound'));
      } finally {
        setLoading(false);
      }
    };

    fetchLook();

    // Cleanup: restore original meta tags on unmount
    return () => {
      document.title = "ShowMeLook - AI Fashion Styling";
      setLookJsonLd(null);
    };
  }, [lookId, t]);

  const handleProductClick = (product: Product) => {
    const url = product.affiliate_url || product.product_url;
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();

    if (user) {
      // Logged in: add to Supabase cart
      try {
        const { error } = await supabase.from("cart_items").insert({
          user_id: user.id,
          product_id: product.id,
          product_name: product.name,
          product_brand: product.brand,
          product_price: product.price,
          product_image_url: product.image_url,
          product_url: product.affiliate_url || product.product_url,
          quantity: 1,
        });

        if (error) throw error;
        
        setAddedToCart((prev) => new Set(prev).add(product.id));
        toast.success(t('sharedLook.addedToCart'));
      } catch (err) {
        console.error("Cart error:", err);
        toast.error(t('sharedLook.cartAddFailed'));
      }
    } else {
      // Guest: add to localStorage cart
      guestCart.addItem({
        product_id: product.id,
        product_name: product.name,
        product_brand: product.brand,
        product_price: product.price,
        product_image_url: product.image_url,
        product_url: product.product_url,
        affiliate_url: product.affiliate_url,
      });

      setAddedToCart((prev) => new Set(prev).add(product.id));
      toast.success(t('sharedLook.addedToCart'));
    }
  };

  const handleTryStyle = () => navigate("/style");
  const handleViewCart = () => navigate("/cart");

  // 링크 복사 핸들러
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('sharedLook.linkCopied'), { description: t('sharedLook.linkCopiedDesc') });
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error(t('sharedLook.linkCopyFailed'));
    }
  };

  // 카카오톡 인앱 브라우저 리다이렉트 UI
  if (showKakaoRedirectUI && isKakaoWebView) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <Smartphone className="w-10 h-10 text-accent" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold">{t('sharedLook.openExternal')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('sharedLook.kakaoLimited')}<br />
              {t('sharedLook.openExternalDesc')}
            </p>
          </div>

          <div className="space-y-3">
            {isAndroid() && (
              <Button 
                className="w-full" 
                onClick={() => openInExternalBrowser(window.location.href)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('sharedLook.openInChrome')}
              </Button>
            )}
            
            <Button 
              variant={isAndroid() ? "outline" : "default"}
              className="w-full" 
              onClick={handleCopyLink}
            >
              <Copy className="w-4 h-4 mr-2" />
              {t('sharedLook.copyLink')}
            </Button>
            
            {isIOS() && (
              <p className="text-xs text-muted-foreground">
                {t('sharedLook.pasteInSafari')}
              </p>
            )}

            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground" 
              onClick={() => setShowKakaoRedirectUI(false)}
            >
              {t('sharedLook.viewAsIs')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">{t('sharedLook.loadingStyle')}</p>
        </div>
      </div>
    );
  }

  if (error || !look) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('sharedLook.styleNotFound')}</h2>
            <p className="text-muted-foreground mb-6">
              {error || t('sharedLook.notFoundDesc')}
            </p>
            <Button onClick={handleTryStyle} className="w-full">
              {t('sharedLook.createMyStyle')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cartItemCount = user ? 0 : guestCart.getItemCount();

  return (
    <div className="min-h-screen bg-background">
      {/* Header - using shared navigation */}
      <MainNavigation 
        rightContent={
          <div className="flex items-center gap-2">
            {/* Cart button with count */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewCart}
              aria-label="장바구니 보기"
              className="relative"
            >

              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-xs rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Button>
            <Button variant="hero" size="sm" onClick={handleTryStyle} className="font-korean rounded-full">
              {t('sharedLook.tryMake')}
            </Button>
          </div>
        }
      />

      <main className="container mx-auto px-4 pt-20 sm:pt-24 pb-6 max-w-4xl">
        <h1 className="sr-only">
          {look.tags && look.tags.length > 0
            ? `${look.tags.slice(0, 3).join(", ")} 스타일 - 쇼미룩 AI 코디`
            : look.prompt_used
              ? `${look.prompt_used} - 쇼미룩 AI 코디`
              : "쇼미룩 AI가 완성한 전신 코디 룩"}
        </h1>
        {/* Style Image - 전신이 다 보이도록 */}
        <div className="rounded-2xl overflow-hidden shadow-xl mb-4 relative">

          <img
            src={look.image_url}
            alt="AI가 완성한 전신 코디 착장"
            className="w-full object-contain bg-muted"
          />
          {/* 무료 플랜 워터마크 - 공유 페이지에서는 항상 표시 */}
          <WatermarkOverlay show={true} size="medium" />
        </div>

        {/* AI 추천 요약 - 이미지와 상품 사이에 배치 */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-accent/20 text-accent">
              {t('sharedLook.aiStyle')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(look.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          {look.prompt_used && (
            <p className="text-sm text-foreground">
              {look.prompt_used}
            </p>
          )}
          {look.tags && look.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {look.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <LookEditorialNotes
          tags={look.tags}
          prompt={look.prompt_used}
          categories={(look.products ?? []).map((p) => p.category)}
        />

        {/* Products */}
        {look.products && look.products.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              {t('sharedLook.styleProducts')}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {look.products.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleProductClick(product)}
                >
                  <div className="aspect-square relative bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 text-[10px] sm:text-xs px-1.5 py-0.5">
                      {product.category}
                    </Badge>
                  </div>
                  <CardContent className="p-2 sm:p-3">
                    {product.brand && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {product.brand}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm font-medium truncate mb-1">
                      {product.name}
                    </p>
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-bold text-accent text-xs sm:text-sm">
                        {product.price.toLocaleString()}{t('common.won')}
                      </span>
                      {product.original_price && product.original_price > product.price && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                          {product.original_price.toLocaleString()}{t('common.won')}
                        </span>
                      )}
                    </div>
                    {/* 제휴 공시 문구 */}
                    <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-1 leading-tight">
                      {getProductAffiliateDisclosure(product.product_url, product.merchant_id)}
                    </p>
                    {/* Mobile: Stack buttons vertically */}
                    <div className="flex flex-col gap-1.5 mt-2 sm:flex-row sm:gap-2">
                      <Button
                        size="sm"
                        variant={addedToCart.has(product.id) ? "secondary" : "outline"}
                        className="w-full h-8 text-[10px] sm:text-xs px-2"
                        onClick={(e) => handleAddToCart(product, e)}
                        disabled={addedToCart.has(product.id)}
                      >
                        {addedToCart.has(product.id) ? (
                          <>
                            <Check className="w-3 h-3 mr-1 shrink-0" />
                            ✓
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3 h-3 mr-1 shrink-0" />
                            {t('mypage.addToCart')}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full h-8 text-[10px] sm:text-xs px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product);
                        }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1 shrink-0" />
                        {t('mypage.purchase')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 p-6 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl text-center">
          <h3 className="text-xl font-bold mb-2">{t('sharedLook.createMyStyle')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('auth.experienceFashion')}
          </p>
          <Button size="lg" onClick={handleTryStyle}>
            {t('landing.freeStart')}
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 ShowMeLook. AI Fashion Styling Service</p>
        </div>
      </footer>
    </div>
  );
};

export default SharedLook;
