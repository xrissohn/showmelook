import { useState, useRef, useEffect, useMemo } from 'react';
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
  // 상의 계열
  'top': { x: 50, y: 30, category: 'top' },
  '상의': { x: 50, y: 30, category: '상의' },
  '여성의류': { x: 50, y: 30, category: '여성의류' },
  '패션의류': { x: 50, y: 30, category: '패션의류' },
  // 아우터 계열
  'outer': { x: 50, y: 28, category: 'outer' },
  '아우터': { x: 50, y: 28, category: '아우터' },
  '재킷': { x: 50, y: 28, category: '재킷' },
  // 하의 계열
  'bottom': { x: 50, y: 62, category: 'bottom' },
  '하의': { x: 50, y: 62, category: '하의' },
  // 원피스/점프수트 계열
  '원피스': { x: 50, y: 45, category: '원피스' },
  '점프수트': { x: 50, y: 45, category: '점프수트' },
  // 신발 계열
  'shoes': { x: 50, y: 88, category: 'shoes' },
  '신발': { x: 50, y: 88, category: '신발' },
  '운동화/스니커즈/슬립온': { x: 50, y: 88, category: '운동화/스니커즈/슬립온' },
  // 가방 계열
  'bag': { x: 25, y: 55, category: 'bag' },
  '가방': { x: 25, y: 55, category: '가방' },
  '숄더백': { x: 25, y: 45, category: '숄더백' },
  '크로스백': { x: 25, y: 50, category: '크로스백' },
  '쇼퍼백': { x: 25, y: 50, category: '쇼퍼백' },
  '지갑': { x: 75, y: 55, category: '지갑' },
  // 액세서리 계열
  'accessory': { x: 30, y: 20, category: 'accessory' },
  '액세서리': { x: 30, y: 20, category: '액세서리' },
  '귀걸이': { x: 35, y: 12, category: '귀걸이' },
  '펜던트': { x: 50, y: 18, category: '펜던트' },
  '피어싱': { x: 38, y: 12, category: '피어싱' },
  '장갑': { x: 20, y: 65, category: '장갑' },
  // 모자/헤어 계열
  '모자': { x: 50, y: 8, category: '모자' },
  'hat': { x: 50, y: 8, category: 'hat' },
  '헤어': { x: 50, y: 8, category: '헤어' },
  // 패션잡화/기타
  '패션잡화': { x: 70, y: 50, category: '패션잡화' },
  '기타': { x: 70, y: 45, category: '기타' },
  '홈웨어': { x: 50, y: 40, category: '홈웨어' },
};

// 카테고리 매핑 (다양한 표현을 통일)
const normalizeCategory = (category: string): string => {
  const lower = category.toLowerCase();
  if (['top', '상의', 'shirt', 'blouse', 'sweater', '여성의류', '패션의류'].some(k => lower.includes(k))) return '상의';
  if (['outer', '아우터', 'jacket', 'coat', '재킷'].some(k => lower.includes(k))) return '아우터';
  if (['bottom', '하의', 'pants', 'skirt', 'jeans'].some(k => lower.includes(k))) return '하의';
  if (['dress', '원피스', '점프수트', 'jumpsuit'].some(k => lower.includes(k))) return '원피스';
  if (['shoes', '신발', 'sneaker', 'boot', '운동화', '스니커즈', '슬립온'].some(k => lower.includes(k))) return '신발';
  if (['숄더백', '크로스백', '쇼퍼백', 'bag', '가방', 'backpack', 'clutch', 'tote'].some(k => lower.includes(k))) return '가방';
  if (['지갑', 'wallet'].some(k => lower.includes(k))) return '지갑';
  if (['모자', 'hat', 'cap', '헤어'].some(k => lower.includes(k))) return '모자';
  if (['귀걸이', 'earring'].some(k => lower.includes(k))) return '귀걸이';
  if (['펜던트', 'pendant', 'necklace', '목걸이'].some(k => lower.includes(k))) return '펜던트';
  if (['피어싱', 'piercing'].some(k => lower.includes(k))) return '피어싱';
  if (['장갑', 'glove'].some(k => lower.includes(k))) return '장갑';
  if (['accessory', '액세서리', 'jewelry', 'watch', '패션잡화'].some(k => lower.includes(k))) return '액세서리';
  return category;
};

// 최소 태그 간 거리 (%)
const MIN_TAG_DISTANCE = 10;

// 두 위치 간 거리 계산
const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// 충돌을 피해 위치 조정
const adjustPositionToAvoidCollision = (
  position: ProductTagPosition,
  existingPositions: ProductTagPosition[],
  attempt: number = 0
): ProductTagPosition => {
  // 최대 시도 횟수 초과 시 원래 위치 반환
  if (attempt > 8) return position;

  // 기존 위치들과 충돌 확인
  const hasCollision = existingPositions.some(
    existing => getDistance(position, existing) < MIN_TAG_DISTANCE
  );

  if (!hasCollision) return position;

  // 충돌 시 나선형으로 위치 조정
  const spiralOffsets = [
    { x: 18, y: 0 },    // 오른쪽
    { x: -18, y: 0 },   // 왼쪽
    { x: 0, y: 15 },    // 아래
    { x: 0, y: -15 },   // 위
    { x: 14, y: 12 },   // 오른쪽 아래
    { x: -14, y: 12 },  // 왼쪽 아래
    { x: 14, y: -12 },  // 오른쪽 위
    { x: -14, y: -12 }, // 왼쪽 위
    { x: 25, y: 0 },    // 더 오른쪽
  ];

  const offset = spiralOffsets[attempt % spiralOffsets.length];
  const newPosition: ProductTagPosition = {
    ...position,
    x: Math.min(88, Math.max(12, position.x + offset.x)),
    y: Math.min(92, Math.max(8, position.y + offset.y)),
  };

  // 재귀적으로 다시 충돌 확인
  return adjustPositionToAvoidCollision(newPosition, existingPositions, attempt + 1);
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

  // 캐시된 위치가 있으면 즉시 적용
  useEffect(() => {
    if (cachedPositions?.length && aiPositions.length === 0) {
      setAiPositions(cachedPositions);
    }
  }, [cachedPositions]);

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

  // 카테고리별로 상품 그룹화하고 위치 계산 (충돌 방지 적용)
  const productsWithPositions = useMemo(() => {
    const assignedPositions: ProductTagPosition[] = [];
    const categoryCount: Record<string, number> = {};
    
    return products.map((product) => {
      const normalizedCategory = normalizeCategory(product.category);
      const categoryIndex = categoryCount[normalizedCategory] || 0;
      categoryCount[normalizedCategory] = categoryIndex + 1;
      
      // AI 분석 위치가 있으면 우선 사용 (낮은 threshold로 AI 결과 적극 활용)
      const aiPos = aiPositions.find(p => normalizeCategory(p.category) === normalizedCategory);
      let basePosition: ProductTagPosition;
      
      if (aiPos && aiPos.confidence > 0.2) {
        // AI 위치를 안전 범위 내로 클램핑
        basePosition = { 
          x: Math.min(90, Math.max(10, aiPos.x)), 
          y: Math.min(92, Math.max(8, aiPos.y)), 
          category: normalizedCategory 
        };
      } else {
        basePosition = DEFAULT_POSITIONS[normalizedCategory] || 
                       DEFAULT_POSITIONS[product.category] || 
                       { x: 50, y: 50, category: 'default' };
      }
      
      // 같은 카테고리 내에서 약간의 오프셋 적용
      const categoryOffsets = [
        { x: 0, y: 0 },
        { x: 16, y: 6 },
        { x: -16, y: 6 },
        { x: 12, y: -10 },
        { x: -12, y: -10 },
      ];
      const categoryOffset = categoryOffsets[categoryIndex % categoryOffsets.length];
      const offsetPosition: ProductTagPosition = {
        ...basePosition,
        x: Math.min(88, Math.max(12, basePosition.x + categoryOffset.x)),
        y: Math.min(92, Math.max(8, basePosition.y + categoryOffset.y)),
      };
      
      // 충돌 방지: 기존 위치들과 겹치지 않도록 조정
      const finalPosition = adjustPositionToAvoidCollision(offsetPosition, assignedPositions);
      assignedPositions.push(finalPosition);
      
      return { product, position: finalPosition };
    });
  }, [products, aiPositions]);

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

      {/* 상품 상세 팝업 - 모바일 최적화 */}
      {selectedProduct && (
        <div 
          className="absolute inset-x-0 bottom-0 z-30 pointer-events-none"
          style={{ top: 'auto', height: 'auto' }}
        >
          {/* 백드롭 - 터치 시 닫기 */}
          <div 
            className="fixed inset-0 bg-black/30 pointer-events-auto"
            onClick={closePopup}
          />
          
          {/* 팝업 컨테이너 - 하단에서 슬라이드업 */}
          <div 
            ref={popupRef}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full bg-card rounded-t-2xl shadow-2xl overflow-hidden pointer-events-auto animate-slide-up"
            style={{ maxHeight: '55vh' }}
          >
            {/* 모바일 드래그 핸들 - 터치로 닫기 */}
            <div 
              className="flex justify-center pt-3 pb-2 cursor-pointer"
              onClick={closePopup}
            >
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
            </div>
            
            {/* 헤더 - 네비게이션 + 닫기 */}
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm text-muted-foreground font-korean">
                {selectedIndex + 1} / {products.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateProduct('prev')}
                  className="p-2 hover:bg-secondary rounded-full transition-colors"
                  aria-label="이전 상품"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateProduct('next')}
                  className="p-2 hover:bg-secondary rounded-full transition-colors"
                  aria-label="다음 상품"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={closePopup}
                  className="p-2 hover:bg-secondary rounded-full transition-colors ml-1"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 상품 콘텐츠 - 가로 레이아웃 */}
            <div className="flex gap-3 px-4 pb-3">
              {/* 상품 이미지 - 작게 */}
              {selectedProduct.image_url && (
                <div className="relative w-24 h-24 flex-shrink-0 bg-secondary rounded-xl overflow-hidden">
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain"
                  />
                  {/* 카테고리 배지 */}
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded-full font-korean">
                    {selectedProduct.category}
                  </span>
                </div>
              )}

              {/* 상품 정보 */}
              <div className="flex-1 min-w-0">
                {selectedProduct.brand && (
                  <span className="inline-block px-2 py-0.5 bg-accent/10 text-accent text-[10px] font-medium rounded-full mb-1">
                    {selectedProduct.brand}
                  </span>
                )}
                <h3 className="font-semibold text-foreground font-korean text-sm leading-tight line-clamp-2">
                  {selectedProduct.name}
                </h3>
                <p className="text-lg font-bold text-foreground mt-1">
                  ₩{selectedProduct.price.toLocaleString()}
                </p>
                {/* 제휴 공시 문구 */}
                <p className="text-[9px] text-muted-foreground leading-tight mt-1 line-clamp-2">
                  {getProductAffiliateDisclosure(selectedProduct.product_url, selectedProduct.merchant_id)}
                </p>
              </div>
            </div>

            {/* 액션 버튼 - 하단 고정 */}
            <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-border/50">
              {onLike && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLike(selectedProduct)}
                  className={`w-11 h-11 p-0 ${likedProducts.has(selectedProduct.id) ? 'text-red-500 border-red-500' : ''}`}
                >
                  <Heart className={`w-5 h-5 ${likedProducts.has(selectedProduct.id) ? 'fill-current' : ''}`} />
                </Button>
              )}
              {onAddToCart && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToCart(selectedProduct)}
                  className="w-11 h-11 p-0"
                >
                  <ShoppingBag className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="gold"
                size="sm"
                onClick={() => onPurchase(selectedProduct)}
                disabled={purchasingProductId === selectedProduct.id}
                className="flex-1 h-11 font-korean text-sm"
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
