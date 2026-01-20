import { useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ExternalLink, ImageOff } from 'lucide-react';
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
  affiliate_url?: string;
  merchant_id?: string | null;
}

interface LoadingProductAdsProps {
  products: CachedProduct[];
  onProductClick: (product: CachedProduct) => void;
}

const ProductSlide = ({ 
  product, 
  onClick 
}: { 
  product: CachedProduct; 
  onClick: () => void;
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  return (
    <div 
      className="relative bg-background/80 backdrop-blur-sm rounded-xl border border-border/50 p-3 cursor-pointer hover:border-accent/50 transition-all duration-300 group"
      onClick={onClick}
    >
      {/* 광고 라벨 */}
      <div className="absolute top-2 right-2 z-10">
        <span className="text-[9px] px-1.5 py-0.5 bg-muted/80 text-muted-foreground rounded">
          광고
        </span>
      </div>

      <div className="flex gap-3">
        {/* 상품 이미지 */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
          {imageError || !product.image_url ? (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="w-6 h-6 text-muted-foreground/30" />
            </div>
          ) : (
            <img
              src={product.image_url}
              alt={product.name}
              className={`w-full h-full object-cover transition-all duration-500 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* 상품 정보 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {product.brand && (
            <p className="text-[10px] text-muted-foreground truncate">
              {product.brand}
            </p>
          )}
          <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 leading-tight">
            {product.name}
          </p>
          <p className="text-sm sm:text-base font-bold text-accent mt-1">
            ₩{formatPrice(product.price)}
          </p>
          {/* 제휴 공시 문구 */}
          <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
            {getProductAffiliateDisclosure(product.product_url, product.merchant_id)}
          </p>
        </div>

        {/* 외부 링크 아이콘 */}
        <div className="flex items-center">
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
        </div>
      </div>
    </div>
  );
};

export const LoadingProductAds = ({ products, onProductClick }: LoadingProductAdsProps) => {
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: 'center' },
    [Autoplay({ delay: 3000, stopOnInteraction: false })]
  );

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-xs sm:max-w-sm mt-6 sm:mt-8 z-10 px-4">
      <p className="text-xs text-muted-foreground text-center mb-2 font-korean">
        ✨ 이런 상품은 어떠세요?
      </p>
      
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {products.map((product) => (
            <div key={product.id} className="flex-[0_0_100%] min-w-0 px-1">
              <ProductSlide
                product={product}
                onClick={() => onProductClick(product)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 인디케이터 */}
      <div className="flex justify-center gap-1 mt-2">
        {products.slice(0, 5).map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
          />
        ))}
        {products.length > 5 && (
          <span className="text-[10px] text-muted-foreground ml-1">+{products.length - 5}</span>
        )}
      </div>
    </div>
  );
};
