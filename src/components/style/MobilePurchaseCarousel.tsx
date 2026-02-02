import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProductAffiliateDisclosure } from '@/lib/affiliateDisclosure';

interface CachedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  original_price?: number | null;
  image_url: string | null;
  product_url: string;
  category: string;
  style_tags: string[] | null;
  affiliate_url?: string;
  isAutoSelected?: boolean;
  merchant_id?: string | null;
}

interface MobilePurchaseCarouselProps {
  products: CachedProduct[];
  onAddToCart: (product: CachedProduct) => void;
  onPurchase: (product: CachedProduct) => void;
  purchasingProductId: string | null;
}

export const MobilePurchaseCarousel = ({
  products,
  onAddToCart,
  onPurchase,
  purchasingProductId,
}: MobilePurchaseCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    
    return () => el.removeEventListener('scroll', checkScrollability);
  }, [checkScrollability, products]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 170; // card width + gap
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      {/* 스크롤 버튼 */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-background/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center border border-border"
          aria-label="이전"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
      )}
      {canScrollRight && products.length > 2 && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-background/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center border border-border"
          aria-label="다음"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      )}

      {/* 스크롤 컨테이너 */}
      <div
        ref={scrollRef}
        className="flex gap-3 pb-3 overflow-x-auto scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="flex-none bg-secondary rounded-xl p-3 flex flex-col shadow-sm border border-border/50"
            style={{
              width: '150px',
              scrollSnapAlign: 'start',
            }}
          >
            {product.image_url && (
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground font-korean text-xs line-clamp-2 mb-1">
                {product.name}
              </p>
              {product.brand && (
                <p className="text-[10px] text-accent truncate">{product.brand}</p>
              )}
              <p className="text-sm font-semibold text-foreground mt-1">
                ₩{product.price.toLocaleString()}
              </p>
              <p className="text-[8px] text-muted-foreground mt-0.5 leading-tight font-korean line-clamp-2">
                {getProductAffiliateDisclosure(product.product_url, product.merchant_id)}
              </p>
            </div>
            <div className="flex gap-1.5 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToCart(product)}
                className="flex-1 h-8 p-0"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="minimal"
                size="sm"
                onClick={() => onPurchase(product)}
                disabled={purchasingProductId === product.id}
                className="flex-1 h-8 text-xs px-1.5"
              >
                {purchasingProductId === product.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  '구매'
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 스와이프 안내 */}
      {products.length > 2 && (
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground font-korean">스와이프</p>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};
