import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ShoppingBag, ExternalLink, Loader2, LogIn } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
import { useGuestCart, GuestCartItem } from '@/hooks/useGuestCart';
import { getProductAffiliateDisclosure } from '@/lib/affiliateDisclosure';
import { SEOHead } from '@/components/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product_source: string | null;
  product_name: string | null;
  product_brand: string | null;
  product_price: number | null;
  product_image_url: string | null;
  product_url: string | null;
  affiliate_url?: string;
}

const Cart = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const guestCart = useGuestCart();
  const { t } = useLanguage();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingItems, setPurchasingItems] = useState<Set<string>>(new Set());
  const [bulkPurchasing, setBulkPurchasing] = useState(false);

  // Merge guest cart to user cart on login
  useEffect(() => {
    const mergeGuestCart = async () => {
      if (user && guestCart.items.length > 0) {
        try {
          const insertPromises = guestCart.items.map(item =>
            supabase.from('cart_items').upsert({
              user_id: user.id,
              product_id: item.product_id,
              product_name: item.product_name,
              product_brand: item.product_brand,
              product_price: item.product_price,
              product_image_url: item.product_image_url,
              product_url: item.affiliate_url || item.product_url,
              quantity: item.quantity,
            }, { onConflict: 'user_id,product_id' })
          );

          await Promise.all(insertPromises);
          guestCart.clearCart();
          toast({
            title: '장바구니 동기화',
            description: '게스트 장바구니가 계정에 저장되었습니다.',
          });
        } catch (e) {
          console.error('Failed to merge guest cart:', e);
        }
      }
    };

    if (user && !authLoading) {
      mergeGuestCart();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      fetchCartItems();
    } else {
      // Use guest cart items
      const guestItems: CartItem[] = guestCart.items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product_source: null,
        product_name: item.product_name,
        product_brand: item.product_brand,
        product_price: item.product_price,
        product_image_url: item.product_image_url,
        product_url: item.product_url,
        affiliate_url: item.affiliate_url,
      }));
      setCartItems(guestItems);
      setLoading(false);
    }
  }, [user, authLoading, guestCart.items]);

  const fetchCartItems = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching cart:', error);
    } else {
      setCartItems(data || []);
    }
    setLoading(false);
  };

  const removeItem = async (itemId: string) => {
    if (user) {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        toast({
          title: '오류',
          description: '아이템 삭제 중 문제가 발생했습니다.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // Guest: find product_id from cartItems and remove
      const item = cartItems.find(i => i.id === itemId);
      if (item) {
        guestCart.removeItem(item.product_id);
      }
    }

    setCartItems(prev => prev.filter(item => item.id !== itemId));
    toast({
      title: '삭제됨',
      description: '장바구니에서 아이템이 삭제되었습니다.',
    });
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    if (user) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) return;
    } else {
      const item = cartItems.find(i => i.id === itemId);
      if (item) {
        guestCart.updateQuantity(item.product_id, newQuantity);
      }
    }

    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handlePurchase = async (item: CartItem) => {
    const productUrl = item.affiliate_url || item.product_url;
    
    if (!productUrl) {
      toast({
        title: '오류',
        description: '상품 URL이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setPurchasingItems(prev => new Set(prev).add(item.id));

    try {
      // If already have affiliate URL, use it directly
      if (item.affiliate_url) {
        window.open(item.affiliate_url, '_blank');
        toast({
          title: '구매 페이지 열기',
          description: `${item.product_name} 구매 페이지로 이동합니다.`,
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: item.product_url },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });

      if (error) throw error;

      if (data?.success && data?.affiliate_url) {
        window.open(data.affiliate_url, '_blank');
        toast({
          title: '구매 페이지 열기',
          description: `${item.product_name} 구매 페이지로 이동합니다.`,
        });
      } else {
        window.open(item.product_url, '_blank');
      }
    } catch (error) {
      console.error('Deeplink error:', error);
      window.open(item.product_url, '_blank');
    } finally {
      setPurchasingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + (item.product_price || 0) * item.quantity,
    0
  );

  const handleBulkPurchase = async () => {
    const itemsWithUrl = cartItems.filter(item => item.product_url || item.affiliate_url);
    
    if (itemsWithUrl.length === 0) {
      toast({
        title: '오류',
        description: '구매 가능한 상품이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setBulkPurchasing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const deeplinkPromises = itemsWithUrl.map(async item => {
        // Use existing affiliate URL if available
        if (item.affiliate_url) {
          return { item, affiliateUrl: item.affiliate_url, error: null };
        }

        const { data, error } = await supabase.functions.invoke('deeplink', {
          body: { product_url: item.product_url },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
        });

        return {
          item,
          affiliateUrl: data?.success ? data.affiliate_url : item.product_url,
          error
        };
      });

      const results = await Promise.all(deeplinkPromises);
      
      let openedCount = 0;
      for (let i = 0; i < results.length; i++) {
        const { affiliateUrl } = results[i];
        if (affiliateUrl) {
          setTimeout(() => {
            window.open(affiliateUrl, '_blank');
          }, i * 500);
          openedCount++;
        }
      }

      toast({
        title: '일괄 구매 시작',
        description: `${openedCount}개 상품의 구매 페이지가 열립니다. 팝업 차단을 해제해주세요.`,
      });
    } catch (error) {
      console.error('Bulk purchase error:', error);
      toast({
        title: '오류',
        description: '일괄 구매 처리 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setBulkPurchasing(false);
    }
  };

  const purchasableItemsCount = cartItems.filter(item => item.product_url || item.affiliate_url).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead pageKey="cart" />
      <MainNavigation showBackButton title={t('cart.title')} />

      <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-8 max-w-3xl">
        {/* Guest notice banner */}
        {!user && cartItems.length > 0 && (
          <div className="mb-4 p-4 bg-accent/10 rounded-xl border border-accent/20 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground font-korean">
                {t('cart.loginSave')}
              </p>
              <p className="text-xs text-muted-foreground font-korean">
                {t('cart.guestCart')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/auth')}
              className="font-korean"
            >
              <LogIn className="w-4 h-4 mr-1" />
              {t('cart.loginBtn')}
            </Button>
          </div>
        )}

        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground mb-4 font-korean">{t('cart.empty')}</p>
            <Button variant="hero" onClick={() => navigate('/style')} className="font-korean">
              {t('cart.goShopping')}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-xl sm:rounded-2xl border border-border"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-secondary rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.product_image_url ? (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name || '상품'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs text-accent font-medium">
                          {item.product_brand || 'SHOWMELOOK'}
                        </p>
                        <h3 className="font-medium text-foreground truncate font-korean">
                          {item.product_name || '상품명 없음'}
                        </h3>
                        <p className="text-lg font-semibold text-foreground mt-1">
                          ₩{(item.product_price || 0).toLocaleString()}
                        </p>
                        {/* 제휴 공시 문구 */}
                        <p className="text-[9px] text-muted-foreground mt-1 leading-tight">
                          {getProductAffiliateDisclosure(item.product_url)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <div className="flex items-center border border-border rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-3 py-1 text-foreground hover:bg-secondary transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="px-3 py-1 text-foreground">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-3 py-1 text-foreground hover:bg-secondary transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {(item.product_url || item.affiliate_url) && (
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={() => handlePurchase(item)}
                          disabled={purchasingItems.has(item.id)}
                          className="font-korean"
                        >
                          {purchasingItems.has(item.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <ExternalLink className="w-4 h-4 mr-1" />
                          )}
                          {t('cart.purchase')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground font-korean">{t('cart.productAmount')}</span>
                <span className="text-foreground">₩{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground font-korean">{t('cart.shipping')}</span>
                <span className="text-foreground font-korean">{t('cart.freeShipping')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground font-korean">{t('cart.totalPayment')}</span>
                <span className="text-xl font-bold text-foreground">
                  ₩{totalPrice.toLocaleString()}
                </span>
              </div>

              <Button
                variant="gold"
                size="xl"
                className="w-full mt-4 font-korean"
                onClick={handleBulkPurchase}
                disabled={bulkPurchasing || purchasableItemsCount === 0}
              >
                {bulkPurchasing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t('cart.processing')}
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5 mr-2" />
                    {t('cart.bulkPurchase')} ({purchasableItemsCount})
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2 font-korean">
                {t('cart.newTabNotice')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;
