import { useState, useRef, useEffect } from 'react';
import { X, ExternalLink, ShoppingBag, Heart, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getProductAffiliateDisclosure } from '@/lib/affiliateDisclosure';

interface TaggedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  affiliate_url?: string;
  merchant_id?: string | null;
}

interface ProductTagPosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  category: string;
}

interface AIAnalyzedPosition {
  category: string;
  x: number;
  y: number;
  confidence: number;
}

// 카테고리별 기본 위치 (이미지 내 상대 위치 %)
const DEFAULT_POSITIONS: Record<string, ProductTagPosition> = {
  'top': { x: 50, y: 25, category: 'top' },
  '상의': { x: 50, y: 25, category: '상의' },
  'outer': { x: 50, y: 20, category: 'outer' },
  '아우터': { x: 50, y: 20, category: '아우터' },
  'bottom': { x: 50, y: 60, category: 'bottom' },
  '하의': { x: 50, y: 60, category: '하의' },
  '원피스': { x: 50, y: 45, category: '원피스' },
  'shoes': { x: 50, y: 90, category: 'shoes' },
  '신발': { x: 50, y: 90, category: '신발' },
  'accessory': { x: 20, y: 30, category: 'accessory' },
  '액세서리': { x: 20, y: 30, category: '액세서리' },
  'bag': { x: 80, y: 50, category: 'bag' },
  '가방': { x: 80, y: 50, category: '가방' },
};

// 여러 상품이 같은 카테고리인 경우 위치 오프셋
const getOffsetPosition = (basePos: ProductTagPosition, index: number): ProductTagPosition => {
  const offsets = [
    { x: 0, y: 0 },
    { x: 15, y: 5 },
    { x: -15, y: 5 },
    { x: 10, y: -8 },
    { x: -10, y: -8 },
  ];
  const offset = offsets[index % offsets.length];
  return {
    ...basePos,
    x: Math.min(90, Math.max(10, basePos.x + offset.x)),
    y: Math.min(95, Math.max(5, basePos.y + offset.y)),
  };
};

// 카테고리 매핑 (다양한 표현을 통일)
const normalizeCategory = (category: string): string => {
  const lower = category.toLowerCase();
  if (['top', '상의', 'shirt', 'blouse', 'sweater'].some(k => lower.includes(k))) return '상의';
  if (['outer', '아우터', 'jacket', 'coat'].some(k => lower.includes(k))) return '아우터';
  if (['bottom', '하의', 'pants', 'skirt', 'jeans'].some(k => lower.includes(k))) return '하의';
  if (['dress', '원피스'].some(k => lower.includes(k))) return '원피스';
  if (['shoes', '신발', 'sneaker', 'boot'].some(k => lower.includes(k))) return '신발';
  if (['bag', '가방', 'backpack', 'clutch'].some(k => lower.includes(k))) return '가방';
  if (['accessory', '액세서리', 'jewelry', 'watch', 'necklace'].some(k => lower.includes(k))) return '액세서리';
  return category;
};

interface InteractiveProductTagsProps {
  products: TaggedProduct[];
  onPurchase: (product: TaggedProduct) => void;
  onAddToCart?: (product: TaggedProduct) => void;
  onLike?: (product: TaggedProduct) => void;
  likedProducts?: Set<string>;
  purchasingProductId?: string | null;
  imageUrl?: string; // AI 분석을 위한 이미지 URL
  enableAIPositioning?: boolean; // AI 위치 분석 활성화
  cachedPositions?: AIAnalyzedPosition[]; // 캐시된 AI 분석 위치
  onPositionsAnalyzed?: (positions: AIAnalyzedPosition[]) => void; // 분석 완료 콜백
}

export function InteractiveProductTags({
  products,
  onPurchase,
  onAddToCart,
  onLike,
  likedProducts = new Set(),
  purchasingProductId,
  imageUrl,
  enableAIPositioning = false,
  cachedPositions,
  onPositionsAnalyzed,
}: InteractiveProductTagsProps) {
  const [selectedProduct, setSelectedProduct] = useState<TaggedProduct | null>(null);
  const [showAllTags, setShowAllTags] = useState(true);
  const [aiPositions, setAiPositions] = useState<AIAnalyzedPosition[]>(cachedPositions || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const hasAnalyzed = useRef(false);

  // AI 위치 분석 실행
  useEffect(() => {
    if (
      enableAIPositioning && 
      imageUrl && 
      products.length > 0 && 
      !cachedPositions?.length && 
      !hasAnalyzed.current
    ) {
      hasAnalyzed.current = true;
      analyzeImagePositions();
    }
  }, [enableAIPositioning, imageUrl, products.length, cachedPositions]);

  const analyzeImagePositions = async () => {
    if (!imageUrl || products.length === 0) return;

    setIsAnalyzing(true);
    try {
      const categories = [...new Set(products.map(p => normalizeCategory(p.category)))];
      
      const { data, error } = await supabase.functions.invoke('analyze-image-positions', {
        body: { image_url: imageUrl, categories }
      });

      if (error) throw error;

      if (data?.success && data?.positions?.length > 0) {
        setAiPositions(data.positions);
        onPositionsAnalyzed?.(data.positions);
      }
    } catch (error) {
      console.error('Failed to analyze image positions:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 카테고리별로 상품 그룹화하고 위치 계산
  const categoryCount: Record<string, number> = {};
  const productsWithPositions = products.map((product) => {
    const normalizedCategory = normalizeCategory(product.category);
    const categoryIndex = categoryCount[normalizedCategory] || 0;
    categoryCount[normalizedCategory] = categoryIndex + 1;
    
    // AI 분석 위치가 있으면 우선 사용
    const aiPos = aiPositions.find(p => normalizeCategory(p.category) === normalizedCategory);
    let position: ProductTagPosition;
    
    if (aiPos && aiPos.confidence > 0.3) {
      position = getOffsetPosition({ x: aiPos.x, y: aiPos.y, category: normalizedCategory }, categoryIndex);
    } else {
      const basePosition = DEFAULT_POSITIONS[normalizedCategory] || 
                          DEFAULT_POSITIONS[product.category] || 
                          { x: 50, y: 50, category: 'default' };
      position = getOffsetPosition(basePosition, categoryIndex);
    }
    
    return { product, position };
  });

  const handleTagClick = (product: TaggedProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(product);
  };

  const closePopup = () => {
    setSelectedProduct(null);
  };

  // 현재 선택된 상품의 인덱스
  const selectedIndex = selectedProduct 
    ? products.findIndex(p => p.id === selectedProduct.id) 
    : -1;

  const navigateProduct = (direction: 'prev' | 'next') => {
    if (!selectedProduct) return;
    const newIndex = direction === 'prev' 
      ? (selectedIndex - 1 + products.length) % products.length
      : (selectedIndex + 1) % products.length;
    setSelectedProduct(products[newIndex]);
  };

  if (products.length === 0) return null;

  return (
    <>
      {/* 태그 토글 버튼 */}
      <button
        onClick={() => setShowAllTags(!showAllTags)}
        className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1.5 hover:bg-black/80 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        {showAllTags ? '태그 숨기기' : `태그 보기 (${products.length})`}
      </button>

      {/* 상품 태그들 */}
      {showAllTags && productsWithPositions.map(({ product, position }, index) => (
        <button
          key={product.id}
          onClick={(e) => handleTagClick(product, e)}
          className={`absolute z-10 group transition-all duration-300 hover:z-20 ${
            selectedProduct?.id === product.id ? 'z-20 scale-110' : ''
          }`}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* 펄스 효과 */}
          <span className="absolute inset-0 w-10 h-10 -m-2 rounded-full bg-accent/30 animate-ping" style={{ animationDuration: '2s' }} />
          
          {/* 태그 포인트 */}
          <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-lg border-2 border-accent group-hover:scale-125 transition-transform">
            <span className="w-2 h-2 rounded-full bg-accent" />
          </span>
          
          {/* 호버 시 간단 정보 */}
          <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="block whitespace-nowrap px-2 py-1 bg-black/80 text-white text-xs rounded-lg font-korean">
              {product.brand && <span className="text-accent">{product.brand} </span>}
              {product.name.length > 15 ? product.name.slice(0, 15) + '...' : product.name}
            </span>
          </span>
        </button>
      ))}

      {/* 상품 상세 팝업 */}
      {selectedProduct && (
        <div 
          className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={closePopup}
        >
          <div 
            ref={popupRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-auto sm:min-w-[320px] sm:max-w-[400px] bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in"
          >
            {/* 모바일 핸들 바 */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-sm text-muted-foreground font-korean">
                {selectedIndex + 1} / {products.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateProduct('prev')}
                  className="p-1.5 hover:bg-secondary rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateProduct('next')}
                  className="p-1.5 hover:bg-secondary rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={closePopup}
                  className="p-1.5 hover:bg-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 상품 이미지 */}
            {selectedProduct.image_url && (
              <div className="relative aspect-square max-h-[200px] sm:max-h-[250px] bg-secondary overflow-hidden">
                <img 
                  src={selectedProduct.image_url} 
                  alt={selectedProduct.name}
                  className="w-full h-full object-contain"
                />
                {/* 카테고리 배지 */}
                <span className="absolute top-3 left-3 px-2 py-1 bg-black/60 text-white text-xs rounded-full font-korean">
                  {selectedProduct.category}
                </span>
              </div>
            )}

            {/* 상품 정보 */}
            <div className="p-4 space-y-3">
              {selectedProduct.brand && (
                <span className="inline-block px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full">
                  {selectedProduct.brand}
                </span>
              )}
              <h3 className="font-semibold text-foreground font-korean text-base leading-tight">
                {selectedProduct.name}
              </h3>
              <p className="text-xl font-bold text-foreground">
                ₩{selectedProduct.price.toLocaleString()}
              </p>
              {/* 제휴 공시 문구 */}
              <p className="text-[10px] text-muted-foreground leading-tight">
                {getProductAffiliateDisclosure(selectedProduct.product_url, selectedProduct.merchant_id)}
              </p>
            </div>

            {/* 액션 버튼 */}
            <div className="p-4 pt-0 flex gap-2">
              {onLike && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLike(selectedProduct)}
                  className={`w-10 h-10 p-0 ${likedProducts.has(selectedProduct.id) ? 'text-red-500 border-red-500' : ''}`}
                >
                  <Heart className={`w-5 h-5 ${likedProducts.has(selectedProduct.id) ? 'fill-current' : ''}`} />
                </Button>
              )}
              {onAddToCart && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToCart(selectedProduct)}
                  className="w-10 h-10 p-0"
                >
                  <ShoppingBag className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="gold"
                size="sm"
                onClick={() => onPurchase(selectedProduct)}
                disabled={purchasingProductId === selectedProduct.id}
                className="flex-1 h-10 font-korean"
              >
                {purchasingProductId === selectedProduct.id ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    이동 중...
                  </span>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    구매하러 가기
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
