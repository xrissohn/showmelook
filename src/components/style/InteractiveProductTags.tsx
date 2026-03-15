import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, ExternalLink, ShoppingBag, Heart, ChevronLeft, ChevronRight, Loader2, Move, Save, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getProductAffiliateDisclosure } from '@/lib/affiliateDisclosure';
import { useToast } from '@/hooks/use-toast';

interface TaggedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  sub_category?: string | null;
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
  source?: 'ai' | 'manual' | 'generation';
}

// 카테고리별 기본 위치 (이미지 내 상대 위치 %)
const DEFAULT_POSITIONS: Record<string, ProductTagPosition> = {
  'top': { x: 50, y: 30, category: 'top' },
  '상의': { x: 50, y: 30, category: '상의' },
  '여성의류': { x: 50, y: 30, category: '여성의류' },
  '패션의류': { x: 50, y: 30, category: '패션의류' },
  'outer': { x: 50, y: 28, category: 'outer' },
  '아우터': { x: 50, y: 28, category: '아우터' },
  '재킷': { x: 50, y: 28, category: '재킷' },
  'bottom': { x: 50, y: 62, category: 'bottom' },
  '하의': { x: 50, y: 62, category: '하의' },
  '원피스': { x: 50, y: 45, category: '원피스' },
  '점프수트': { x: 50, y: 45, category: '점프수트' },
  'shoes': { x: 50, y: 88, category: 'shoes' },
  '신발': { x: 50, y: 88, category: '신발' },
  '운동화/스니커즈/슬립온': { x: 50, y: 88, category: '운동화/스니커즈/슬립온' },
  'bag': { x: 25, y: 55, category: 'bag' },
  '가방': { x: 25, y: 55, category: '가방' },
  '숄더백': { x: 25, y: 45, category: '숄더백' },
  '크로스백': { x: 25, y: 50, category: '크로스백' },
  '쇼퍼백': { x: 25, y: 50, category: '쇼퍼백' },
  '지갑': { x: 75, y: 55, category: '지갑' },
  'accessory': { x: 30, y: 20, category: 'accessory' },
  '액세서리': { x: 30, y: 20, category: '액세서리' },
  '귀걸이': { x: 35, y: 12, category: '귀걸이' },
  '펜던트': { x: 50, y: 18, category: '펜던트' },
  '피어싱': { x: 38, y: 12, category: '피어싱' },
  '장갑': { x: 20, y: 65, category: '장갑' },
  '마스크': { x: 50, y: 18, category: '마스크' },
  '모자': { x: 50, y: 5, category: '모자' },
  'hat': { x: 50, y: 5, category: 'hat' },
  '헤어': { x: 50, y: 5, category: '헤어' },
  '패션잡화': { x: 70, y: 50, category: '패션잡화' },
  '기타': { x: 70, y: 45, category: '기타' },
  '홈웨어': { x: 50, y: 40, category: '홈웨어' },
};

const normalizeCategory = (category: string, subCategory?: string | null, productName?: string | null): string => {
  const lower = category.toLowerCase();
  const subLower = (subCategory || '').toLowerCase();
  const nameLower = (productName || '').toLowerCase();
  
  if (['마스크', 'mask', '바라클라바', '넥워머'].some(k => nameLower.includes(k) || subLower.includes(k) || lower.includes(k))) return '마스크';
  if (['모자', 'hat', 'cap', 'beanie', '버킷햇', '비니', '헤어'].some(k => subLower.includes(k) || lower.includes(k))) return '모자';
  if (['top', '상의', 'shirt', 'blouse', 'sweater', '여성의류', '패션의류', '티셔츠', '니트'].some(k => lower.includes(k))) return '상의';
  if (['outer', '아우터', 'jacket', 'coat', '재킷', '점퍼', '패딩'].some(k => lower.includes(k))) return '아우터';
  if (['bottom', '하의', 'pants', 'skirt', 'jeans', '바지', '스커트'].some(k => lower.includes(k))) return '하의';
  if (['dress', '원피스', '점프수트', 'jumpsuit'].some(k => lower.includes(k))) return '원피스';
  if (['shoes', '신발', 'sneaker', 'boot', '운동화', '스니커즈', '슬립온', '샌들', '로퍼'].some(k => lower.includes(k) || subLower.includes(k))) return '신발';
  if (['숄더백', '크로스백', '쇼퍼백', 'bag', '가방', 'backpack', 'clutch', 'tote', '백팩', '토트'].some(k => lower.includes(k) || subLower.includes(k))) return '가방';
  if (['지갑', 'wallet'].some(k => lower.includes(k) || subLower.includes(k))) return '지갑';
  if (['귀걸이', 'earring'].some(k => lower.includes(k) || subLower.includes(k))) return '귀걸이';
  if (['펜던트', 'pendant', 'necklace', '목걸이'].some(k => lower.includes(k) || subLower.includes(k))) return '펜던트';
  if (['피어싱', 'piercing'].some(k => lower.includes(k) || subLower.includes(k))) return '피어싱';
  if (['장갑', 'glove'].some(k => lower.includes(k) || subLower.includes(k))) return '장갑';
  if (['accessory', '액세서리', 'jewelry', 'watch', '패션잡화', '시계', '팔찌', '반지'].some(k => lower.includes(k) || subLower.includes(k))) return '액세서리';
  return category;
};

const MIN_TAG_DISTANCE = 10;

const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const adjustPositionToAvoidCollision = (
  position: ProductTagPosition,
  existingPositions: ProductTagPosition[],
  attempt: number = 0
): ProductTagPosition => {
  if (attempt > 8) return position;
  const hasCollision = existingPositions.some(
    existing => getDistance(position, existing) < MIN_TAG_DISTANCE
  );
  if (!hasCollision) return position;

  const spiralOffsets = [
    { x: 18, y: 0 }, { x: -18, y: 0 }, { x: 0, y: 15 }, { x: 0, y: -15 },
    { x: 14, y: 12 }, { x: -14, y: 12 }, { x: 14, y: -12 }, { x: -14, y: -12 },
    { x: 25, y: 0 },
  ];
  const offset = spiralOffsets[attempt % spiralOffsets.length];
  const newPosition: ProductTagPosition = {
    ...position,
    x: Math.min(88, Math.max(12, position.x + offset.x)),
    y: Math.min(92, Math.max(4, position.y + offset.y)),
  };
  return adjustPositionToAvoidCollision(newPosition, existingPositions, attempt + 1);
};

interface InteractiveProductTagsProps {
  products: TaggedProduct[];
  onPurchase: (product: TaggedProduct) => void;
  onAddToCart?: (product: TaggedProduct) => void;
  onLike?: (product: TaggedProduct) => void;
  likedProducts?: Set<string>;
  purchasingProductId?: string | null;
  imageUrl?: string;
  enableAIPositioning?: boolean;
  cachedPositions?: AIAnalyzedPosition[];
  onPositionsAnalyzed?: (positions: AIAnalyzedPosition[]) => void;
  isEditable?: boolean;
  lookId?: string;
  onTagPositionsSaved?: (positions: AIAnalyzedPosition[]) => void;
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
  isEditable = false,
  lookId,
  onTagPositionsSaved,
}: InteractiveProductTagsProps) {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<TaggedProduct | null>(null);
  const [showAllTags, setShowAllTags] = useState(true);
  const [aiPositions, setAiPositions] = useState<AIAnalyzedPosition[]>(cachedPositions || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const hasAnalyzed = useRef(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPositions, setEditedPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 이미 캐시된 위치 데이터가 있으면 AI 재분석 스킵 (source 무관)
  const hasExistingPositions = useMemo(() => {
    return (cachedPositions?.length ?? 0) > 0;
  }, [cachedPositions]);

  // AI 위치 분석 실행 - 캐시된 위치가 없는 경우에만
  useEffect(() => {
    if (enableAIPositioning && imageUrl && products.length > 0 && !hasExistingPositions && !hasAnalyzed.current) {
      hasAnalyzed.current = true;
      analyzeImagePositions();
    }
  }, [enableAIPositioning, imageUrl, products.length, hasExistingPositions]);

  useEffect(() => {
    if (cachedPositions?.length && aiPositions.length === 0) {
      setAiPositions(cachedPositions);
    }
  }, [cachedPositions]);

  const analyzeImagePositions = async () => {
    if (!imageUrl || products.length === 0) return;
    setIsAnalyzing(true);
    try {
      const categories = [...new Set(products.map(p => normalizeCategory(p.category, p.sub_category, p.name)))];
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
  const productsWithPositions = useMemo(() => {
    const assignedPositions: ProductTagPosition[] = [];
    const categoryCount: Record<string, number> = {};
    
    return products.map((product) => {
      const normalizedCategory = normalizeCategory(product.category, product.sub_category, product.name);
      const categoryIndex = categoryCount[normalizedCategory] || 0;
      categoryCount[normalizedCategory] = categoryIndex + 1;
      
      // Check if there's a manual edit for this product
      const editedPos = editedPositions.get(product.id);
      if (editedPos) {
        const pos: ProductTagPosition = { x: editedPos.x, y: editedPos.y, category: normalizedCategory };
        assignedPositions.push(pos);
        return { product, position: pos };
      }

      // Check cached positions for manual source
      const cachedManual = cachedPositions?.find(
        p => normalizeCategory(p.category) === normalizedCategory && p.source === 'manual'
      );
      if (cachedManual) {
        const pos: ProductTagPosition = { 
          x: Math.min(90, Math.max(10, cachedManual.x)), 
          y: Math.min(92, Math.max(4, cachedManual.y)), 
          category: normalizedCategory 
        };
        assignedPositions.push(pos);
        return { product, position: pos };
      }

      const aiPos = aiPositions.find(p => normalizeCategory(p.category) === normalizedCategory);
      let basePosition: ProductTagPosition;
      
      if (aiPos && aiPos.confidence > 0.2) {
        basePosition = { 
          x: Math.min(90, Math.max(10, aiPos.x)), 
          y: Math.min(92, Math.max(4, aiPos.y)), 
          category: normalizedCategory 
        };
      } else {
        basePosition = DEFAULT_POSITIONS[normalizedCategory] || 
                       DEFAULT_POSITIONS[product.category] || 
                       { x: 50, y: 50, category: 'default' };
      }
      
      const categoryOffsets = [
        { x: 0, y: 0 }, { x: 16, y: 6 }, { x: -16, y: 6 }, { x: 12, y: -10 }, { x: -12, y: -10 },
      ];
      const categoryOffset = categoryOffsets[categoryIndex % categoryOffsets.length];
      const offsetPosition: ProductTagPosition = {
        ...basePosition,
        x: Math.min(88, Math.max(12, basePosition.x + categoryOffset.x)),
        y: Math.min(92, Math.max(4, basePosition.y + categoryOffset.y)),
      };
      
      const finalPosition = adjustPositionToAvoidCollision(offsetPosition, assignedPositions);
      assignedPositions.push(finalPosition);
      return { product, position: finalPosition };
    });
  }, [products, aiPositions, editedPositions, cachedPositions]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent, productId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingProductId(productId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isEditMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingProductId || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const clampedX = Math.min(95, Math.max(5, x));
    const clampedY = Math.min(97, Math.max(3, y));
    
    setEditedPositions(prev => {
      const next = new Map(prev);
      next.set(draggingProductId, { x: clampedX, y: clampedY });
      return next;
    });
  }, [draggingProductId]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingProductId) {
      e.preventDefault();
      e.stopPropagation();
      setDraggingProductId(null);
    }
  }, [draggingProductId]);

  // Enter edit mode
  const enterEditMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setSelectedProduct(null);
    // Initialize with current positions
    const initial = new Map<string, { x: number; y: number }>();
    productsWithPositions.forEach(({ product, position }) => {
      initial.set(product.id, { x: position.x, y: position.y });
    });
    setEditedPositions(initial);
  };

  // Cancel edit mode
  const cancelEditMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(false);
    setEditedPositions(new Map());
  };

  // Save edited positions
  const savePositions = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lookId) return;
    
    setIsSaving(true);
    try {
      // Build new positions array with source field
      const newPositions: AIAnalyzedPosition[] = productsWithPositions.map(({ product, position }) => {
        const normalizedCategory = normalizeCategory(product.category, product.sub_category, product.name);
        const edited = editedPositions.get(product.id);
        const originalAi = aiPositions.find(p => normalizeCategory(p.category) === normalizedCategory);
        
        return {
          category: normalizedCategory,
          x: position.x,
          y: position.y,
          confidence: originalAi?.confidence || 0.5,
          source: edited ? 'manual' as const : (originalAi?.source || 'ai' as const),
        };
      });

      // Save to generated_looks.tag_positions
      const { error } = await supabase
        .from('generated_looks')
        .update({ tag_positions: newPositions as any })
        .eq('id', lookId);

      if (error) throw error;

      // Record corrections in tag_corrections for learning
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const corrections: any[] = [];
        productsWithPositions.forEach(({ product, position }) => {
          const normalizedCategory = normalizeCategory(product.category, product.sub_category, product.name);
          const originalAi = aiPositions.find(p => normalizeCategory(p.category) === normalizedCategory);
          const edited = editedPositions.get(product.id);
          
          if (edited && originalAi) {
            const distance = getDistance(
              { x: originalAi.x, y: originalAi.y },
              { x: position.x, y: position.y }
            );
            // Only record if moved >= 5%
            if (distance >= 5) {
              corrections.push({
                look_id: lookId,
                user_id: session.user.id,
                category: normalizedCategory,
                ai_x: originalAi.x,
                ai_y: originalAi.y,
                manual_x: position.x,
                manual_y: position.y,
                image_url: imageUrl,
              });
            }
          }
        });

        if (corrections.length > 0) {
          await supabase.from('tag_corrections').insert(corrections);
        }
      }

      // Update local state
      setAiPositions(newPositions);
      onTagPositionsSaved?.(newPositions);
      setIsEditMode(false);
      setEditedPositions(new Map());
      
      toast({
        title: '태그 위치 저장 완료',
        description: '수동 보정된 태그 위치가 저장되었습니다.',
      });
    } catch (error) {
      console.error('Failed to save tag positions:', error);
      toast({
        title: '저장 실패',
        description: '태그 위치 저장에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagClick = (product: TaggedProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditMode) return; // In edit mode, clicks are for dragging
    setSelectedProduct(product);
  };

  const closePopup = () => setSelectedProduct(null);

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
    <div 
      ref={containerRef}
      className="absolute inset-0"
      onPointerMove={isEditMode ? handlePointerMove : undefined}
      onPointerUp={isEditMode ? handlePointerUp : undefined}
      style={{ touchAction: isEditMode ? 'none' : undefined }}
    >
      {/* 태그 토글 / 편집 모드 버튼 */}
      {!isEditMode ? (
        <div className="absolute top-3 right-3 z-20 flex gap-1.5">
          {isEditable && (
            <button
              onClick={enterEditMode}
              className="px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1.5 hover:bg-black/80 transition-colors"
            >
              <Move className="w-3 h-3" />
              태그 위치 조정
            </button>
          )}
          <button
            onClick={() => setShowAllTags(!showAllTags)}
            className="px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1.5 hover:bg-black/80 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            {showAllTags ? '태그 숨기기' : `태그 보기 (${products.length})`}
          </button>
        </div>
      ) : (
        <div className="absolute top-3 right-3 z-20 flex gap-1.5">
          <button
            onClick={cancelEditMode}
            className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1.5 hover:bg-white/30 transition-colors"
          >
            <X className="w-3 h-3" />
            취소
          </button>
          <button
            onClick={savePositions}
            disabled={isSaving}
            className="px-3 py-1.5 bg-accent/80 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1.5 hover:bg-accent transition-colors"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            저장
          </button>
        </div>
      )}

      {/* Edit mode indicator */}
      {isEditMode && (
        <div className="absolute top-3 left-3 z-20 px-3 py-1.5 bg-accent/80 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1.5 animate-pulse">
          <GripVertical className="w-3 h-3" />
          태그를 드래그하여 이동하세요
        </div>
      )}

      {/* 상품 태그들 */}
      {showAllTags && productsWithPositions.map(({ product, position }) => (
        <button
          key={product.id}
          onClick={(e) => handleTagClick(product, e)}
          onPointerDown={(e) => handlePointerDown(e, product.id)}
          className={`absolute z-10 group transition-all duration-300 hover:z-20 ${
            selectedProduct?.id === product.id ? 'z-20 scale-110' : ''
          } ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
          ${draggingProductId === product.id ? 'z-30 scale-125' : ''}`}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* 펄스 효과 - 편집 모드에서는 다른 색상 */}
          <span className={`absolute inset-0 w-10 h-10 -m-2 rounded-full animate-ping ${
            isEditMode ? 'bg-accent/50' : 'bg-accent/30'
          }`} style={{ animationDuration: isEditMode ? '1.5s' : '2s' }} />
          
          {/* 태그 포인트 */}
          <span className={`relative flex items-center justify-center w-6 h-6 rounded-full shadow-lg border-2 transition-transform ${
            isEditMode 
              ? 'bg-accent border-white group-hover:scale-150' 
              : 'bg-white border-accent group-hover:scale-125'
          } ${draggingProductId === product.id ? 'scale-150 ring-2 ring-white/50' : ''}`}>
            {isEditMode ? (
              <GripVertical className="w-3 h-3 text-white" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-accent" />
            )}
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

      {/* 상품 상세 팝업 - 편집 모드에서는 숨김 */}
      {selectedProduct && !isEditMode && (
        <div 
          className="absolute inset-x-0 bottom-0 z-30 pointer-events-none"
          style={{ top: 'auto', height: 'auto' }}
        >
          <div className="fixed inset-0 bg-black/30 pointer-events-auto" onClick={closePopup} />
          <div 
            ref={popupRef}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full bg-card rounded-t-2xl shadow-2xl overflow-hidden pointer-events-auto animate-slide-up"
            style={{ maxHeight: '55vh' }}
          >
            <div className="flex justify-center pt-3 pb-2 cursor-pointer" onClick={closePopup}>
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
            </div>
            
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm text-muted-foreground font-korean">
                {selectedIndex + 1} / {products.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => navigateProduct('prev')} className="p-2 hover:bg-secondary rounded-full transition-colors" aria-label="이전 상품">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => navigateProduct('next')} className="p-2 hover:bg-secondary rounded-full transition-colors" aria-label="다음 상품">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={closePopup} className="p-2 hover:bg-secondary rounded-full transition-colors ml-1" aria-label="닫기">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-4 pb-3">
              {selectedProduct.image_url && (
                <div className="relative w-24 h-24 flex-shrink-0 bg-secondary rounded-xl overflow-hidden">
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-contain" />
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded-full font-korean">
                    {selectedProduct.category}
                  </span>
                </div>
              )}
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
                <p className="text-[9px] text-muted-foreground leading-tight mt-1 line-clamp-2">
                  {getProductAffiliateDisclosure(selectedProduct.product_url, selectedProduct.merchant_id)}
                </p>
              </div>
            </div>

            <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-border/50">
              {onLike && (
                <Button variant="outline" size="sm" onClick={() => onLike(selectedProduct)}
                  className={`w-11 h-11 p-0 ${likedProducts.has(selectedProduct.id) ? 'text-red-500 border-red-500' : ''}`}>
                  <Heart className={`w-5 h-5 ${likedProducts.has(selectedProduct.id) ? 'fill-current' : ''}`} />
                </Button>
              )}
              {onAddToCart && (
                <Button variant="outline" size="sm" onClick={() => onAddToCart(selectedProduct)} className="w-11 h-11 p-0">
                  <ShoppingBag className="w-5 h-5" />
                </Button>
              )}
              <Button variant="gold" size="sm" onClick={() => onPurchase(selectedProduct)}
                disabled={purchasingProductId === selectedProduct.id} className="flex-1 h-11 font-korean text-sm">
                {purchasingProductId === selectedProduct.id ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />이동 중...
                  </span>
                ) : (
                  <><ExternalLink className="w-4 h-4 mr-2" />구매하러 가기</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
