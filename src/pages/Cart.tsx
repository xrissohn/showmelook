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

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );

  const handleCheckout = () => {
    toast({
      title: '결제 페이지로 이동',
      description: '외부 결제 시스템으로 연결됩니다.',
    });
    // In a real app, this would redirect to actual checkout
  };

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
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
              <img src={showmelookLogo} alt="쇼미룩 로고" className="w-10 h-10 object-contain" />
              <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[90px] object-contain -ml-3" />
            </button>
          </div>
          <span className="font-display text-xl text-foreground">장바구니</span>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground mb-4">장바구니가 비어있습니다</p>
            <Button variant="hero" onClick={() => navigate('/style')}>
              쇼핑하러 가기
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 bg-card rounded-2xl border border-border"
                >
                  <div className="w-24 h-24 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
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
                        <h3 className="font-medium text-foreground truncate">
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

                    <div className="flex items-center gap-3 mt-3">
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
                        <a
                          href={item.product.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-accent hover:underline"
                        >
                          상품 보기
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">상품 금액</span>
                <span className="text-foreground">₩{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">배송비</span>
                <span className="text-foreground">무료</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">총 결제 금액</span>
                <span className="text-xl font-bold text-foreground">
                  ₩{totalPrice.toLocaleString()}
                </span>
              </div>

              <Button
                variant="gold"
                size="xl"
                className="w-full mt-4"
                onClick={handleCheckout}
              >
                결제하기
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;
