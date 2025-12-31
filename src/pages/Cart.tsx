import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2, ShoppingBag, ExternalLink, Loader2 } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name_ko: string;
    price: number;
    brand: string | null;
    image_url: string | null;
    external_url: string | null;
    category: string;
  };
}

const Cart = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingItems, setPurchasingItems] = useState<Set<string>>(new Set());
  const [bulkPurchasing, setBulkPurchasing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCartItems();
    }
  }, [user]);

  const fetchCartItems = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        quantity,
        product:products (
          id,
          name_ko,
          price,
          brand,
          image_url,
          external_url,
          category
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching cart:', error);
    } else {
      // Transform the data to match our CartItem interface
      const transformedData = (data || []).map(item => ({
        id: item.id,
        quantity: item.quantity,
        product: item.product as unknown as CartItem['product']
      }));
      setCartItems(transformedData);
    }
    setLoading(false);
  };

  const removeItem = async (itemId: string) => {
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
    } else {
      setCartItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: '삭제됨',
        description: '장바구니에서 아이템이 삭제되었습니다.',
      });
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('id', itemId);

    if (!error) {
      setCartItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const handlePurchase = async (item: CartItem) => {
    if (!item.product?.external_url) {
      toast({
        title: '오류',
        description: '상품 URL이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setPurchasingItems(prev => new Set(prev).add(item.id));

    try {
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: item.product.external_url }
      });

      if (error) throw error;

      if (data?.success && data?.affiliate_url) {
        window.open(data.affiliate_url, '_blank');
        toast({
          title: '구매 페이지 열기',
          description: `${item.product.name_ko} 구매 페이지로 이동합니다.`,
        });
      } else {
        // 딥링크 실패 시 원본 URL로 이동
        window.open(item.product.external_url, '_blank');
      }
    } catch (error) {
      console.error('Deeplink error:', error);
      // 오류 시에도 원본 URL로 이동
      window.open(item.product.external_url, '_blank');
    } finally {
      setPurchasingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );

  const handleBulkPurchase = async () => {
    const itemsWithUrl = cartItems.filter(item => item.product?.external_url);
    
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
      // 모든 상품에 대해 딥링크 생성
      const deeplinkPromises = itemsWithUrl.map(item =>
        supabase.functions.invoke('deeplink', {
          body: { product_url: item.product.external_url }
        }).then(({ data, error }) => ({
          item,
          affiliateUrl: data?.success ? data.affiliate_url : item.product.external_url,
          error
        }))
      );

      const results = await Promise.all(deeplinkPromises);
      
      // 약간의 딜레이를 두고 각 URL 열기 (팝업 차단 방지)
      let openedCount = 0;
      for (let i = 0; i < results.length; i++) {
        const { item, affiliateUrl } = results[i];
        if (affiliateUrl) {
          // 첫 번째는 바로, 나머지는 약간의 딜레이
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

  const purchasableItemsCount = cartItems.filter(item => item.product?.external_url).length;

  if (authLoading || loading) {
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
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
              <img src={showmelookLogo} alt="쇼미룩 로고" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
              <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[60px] sm:h-[90px] object-contain -ml-2 sm:-ml-3 hidden xs:block" />
            </button>
          </div>
          <span className="font-korean text-lg sm:text-xl text-foreground">장바구니</span>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-3xl">
        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground mb-4 font-korean">장바구니가 비어있습니다</p>
            <Button variant="hero" onClick={() => navigate('/style')} className="font-korean">
              쇼핑하러 가기
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
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-secondary rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name_ko}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {item.product?.brand || 'SHOWMELOOK'}
                        </p>
                        <h3 className="font-medium text-foreground truncate font-korean">
                          {item.product?.name_ko}
                        </h3>
                        <p className="text-lg font-semibold text-foreground mt-1">
                          ₩{(item.product?.price || 0).toLocaleString()}
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

                      {item.product?.external_url && (
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
                          구매하기
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
                <span className="text-muted-foreground font-korean">상품 금액</span>
                <span className="text-foreground">₩{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground font-korean">배송비</span>
                <span className="text-foreground font-korean">무료</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground font-korean">총 결제 금액</span>
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
                    처리 중...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5 mr-2" />
                    전체 상품 구매하기 ({purchasableItemsCount}개)
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2 font-korean">
                각 상품의 구매 페이지가 새 탭으로 열립니다
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;
