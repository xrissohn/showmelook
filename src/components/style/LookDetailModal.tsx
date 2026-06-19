/**
 * LookDetailModal - Reusable 3D flip card modal for viewing look details
 * Used in: Landing gallery, Community, UserGallery, MyLooksGallery
 * Owner can edit memo/tags, delete, toggle favorite/public
 * Non-owners can view, like, and share
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, ChevronLeft, ChevronRight, Trash2, Heart, Tag, Loader2, 
  ShoppingBag, ExternalLink, Sparkles, RotateCcw, MessageCircle,
  Globe, LockKeyhole
} from 'lucide-react';
import { ModalWatermarkOverlay } from '@/components/style/WatermarkOverlay';
import { InteractiveProductTags } from '@/components/style/InteractiveProductTags';
import { ShareButtons } from '@/components/style/ShareButtons';
import { getProductAffiliateDisclosure } from '@/lib/affiliateDisclosure';
import showmelookWatermarkFull from '@/assets/showmelook-watermark-full.png';

export interface LookDetailData {
  id: string;
  image_url: string;
  is_favorite?: boolean;
  is_public?: boolean;
  created_at: string;
  memo?: string | null;
  tags?: string[] | null;
  prompt_used?: string | null;
  product_ids?: string[] | null;
  style_reasoning?: string | null;
  like_count?: number;
  caption?: string | null;
  user_id: string;
  user_name?: string | null;
  user_avatar?: string | null;
  tag_positions?: any[] | null;
}

interface CachedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  sub_category?: string | null;
  style_tags: string[] | null;
  merchant_id?: string | null;
}

interface LookDetailModalProps {
  look: LookDetailData;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
  onDelete?: (lookId: string) => void;
  onToggleFavorite?: (lookId: string, newValue: boolean) => void;
  onTogglePublic?: (lookId: string, newValue: boolean) => void;
  onUpdateMemoTags?: (lookId: string, memo: string | null, tags: string[] | null) => void;
  onToggleLike?: (lookId: string, currentCount: number) => Promise<{ liked: boolean; newCount: number } | null>;
  isLiked?: boolean;
  hasWatermark?: boolean;
}

const DEFAULT_TAG_OPTIONS = ['데일리', '특별한 날', '데이트', '출근룩', '주말', '파티', '여행', '계절감'];

export const LookDetailModal = ({
  look,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  currentIndex,
  totalCount,
  onDelete,
  onToggleFavorite,
  onTogglePublic,
  onUpdateMemoTags,
  onToggleLike,
  isLiked = false,
  hasWatermark = false,
}: LookDetailModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isOwner = user?.id === look.user_id;
  const tagOptions = (t('lookDetail.tagOptions') as unknown as string[]) || DEFAULT_TAG_OPTIONS;

  const [isFlipped, setIsFlipped] = useState(false);
  const [lookProducts, setLookProducts] = useState<CachedProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [editMemo, setEditMemo] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;
  const [localLiked, setLocalLiked] = useState(isLiked);
  const [localLikeCount, setLocalLikeCount] = useState(look.like_count ?? 0);
  const [likeAnimating, setLikeAnimating] = useState(false);

  // Sync external like state
  useEffect(() => { setLocalLiked(isLiked); }, [isLiked]);
  useEffect(() => { setLocalLikeCount(look.like_count ?? 0); }, [look.like_count]);

  // Load products
  useEffect(() => {
    if (!look.product_ids?.length) { setLookProducts([]); return; }
    const load = async () => {
      setIsLoadingProducts(true);
      try {
        const { data } = await supabase
          .from('products_cache')
          .select('*')
          .in('id', look.product_ids!)
          .eq('is_active', true);
        if (data) {
          setLookProducts(data.map(p => ({
            id: p.id, name: p.name, brand: p.brand, price: p.price,
            image_url: p.image_url, product_url: p.product_url,
            category: p.category, sub_category: p.sub_category, style_tags: p.style_tags, merchant_id: p.merchant_id,
          })));
        }
      } catch { setLookProducts([]); }
      finally { setIsLoadingProducts(false); }
    };
    load();
  }, [look.id, look.product_ids]);

  useEffect(() => { setIsFlipped(false); setIsEditingMemo(false); }, [look.id]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditingMemo) return;
      if (e.key === 'ArrowLeft' && hasPrevious) onPrevious?.();
      if (e.key === 'ArrowRight' && hasNext) onNext?.();
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrevious, hasNext, onPrevious, onNext, onClose, isEditingMemo, showDeleteConfirm]);

  // Touch
  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > minSwipeDistance && hasNext) onNext?.();
    else if (d < -minSwipeDistance && hasPrevious) onPrevious?.();
    setTouchStart(null); setTouchEnd(null);
  };

  // Product purchase - pre-open window to avoid popup blocking on mobile
  const handleProductPurchase = async (product: CachedProduct | { id: string; name: string; brand: string | null; price: number; image_url: string | null; product_url: string; category: string; affiliate_url?: string; merchant_id?: string | null }) => {
    if (!product.product_url) return;
    
    // 클릭 시점에 빈 창을 먼저 열어 팝업 차단 방지
    const newWindow = window.open('', '_blank');
    setPurchasingProductId(product.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data } = await supabase.functions.invoke('deeplink', {
        body: { product_url: product.product_url, product_name: product.name, product_price: product.price },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });
      const targetUrl = data?.affiliate_url || product.product_url;
      if (newWindow) {
        newWindow.location.href = targetUrl;
      } else {
        window.location.href = targetUrl;
      }
    } catch {
      const fallbackUrl = product.product_url;
      if (newWindow) {
        newWindow.location.href = fallbackUrl;
      } else {
        window.location.href = fallbackUrl;
      }
    } finally { setPurchasingProductId(null); }
  };

  // Like handler
  const handleLike = async () => {
    if (!onToggleLike) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 300);
    const result = await onToggleLike(look.id, localLikeCount);
    if (result) {
      setLocalLiked(result.liked);
      setLocalLikeCount(result.newCount);
    }
  };

  // Memo/tag editing
  const startEditingMemo = () => {
    setEditMemo(look.memo || '');
    setEditTags(look.tags || []);
    setIsEditingMemo(true);
  };
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !editTags.includes(t) && editTags.length < 5) { setEditTags([...editTags, t]); setNewTag(''); }
  };
  const saveMemoAndTags = async () => {
    setIsSavingMemo(true);
    try {
      const { error } = await supabase.from('generated_looks')
        .update({ memo: editMemo.trim() || null, tags: editTags.length > 0 ? editTags : null })
        .eq('id', look.id);
      if (error) throw error;
      onUpdateMemoTags?.(look.id, editMemo.trim() || null, editTags.length > 0 ? editTags : null);
      setIsEditingMemo(false);
    } catch (e: any) { console.error('Save memo error:', e); }
    finally { setIsSavingMemo(false); }
  };

  // Delete
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (look.image_url && !look.image_url.startsWith('http') && !look.image_url.startsWith('data:')) {
        await supabase.storage.from('generated-looks').remove([look.image_url]);
      }
      const { error } = await supabase.from('generated_looks').delete().eq('id', look.id);
      if (error) throw error;
      onDelete?.(look.id);
      onClose();
    } catch (e: any) { console.error('Delete error:', e); }
    finally { setIsDeleting(false); setShowDeleteConfirm(false); }
  };

  // Flip sound
  const playFlipSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const out = buf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) out[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(2500, ctx.currentTime); bp.Q.setValueAtTime(0.8, ctx.currentTime);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(800, ctx.currentTime);
      const gain = ctx.createGain(); gain.gain.setValueAtTime(0.25, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      src.connect(bp); bp.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime); src.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const handleShareResult = (_platform: string, result: { success: boolean; message?: string }) => {
    if (result.message) {
      toast({ title: result.success ? t('lookDetail.shareSuccess') : t('lookDetail.shareError'), description: result.message, variant: result.success ? 'default' : 'destructive' });
    }
  };

  const displayName = look.user_name || t('lookDetail.stylist');

  // Map products for InteractiveProductTags
  const taggedProducts = lookProducts.map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    image_url: p.image_url,
    product_url: p.product_url,
    category: p.category,
    sub_category: p.sub_category,
    merchant_id: p.merchant_id,
  }));

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      data-look-modal="true"
      onClick={() => !showDeleteConfirm && !isEditingMemo && onClose()}
    >
      {/* Close button */}
      <button className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors" onClick={onClose}>
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Delete button - owner only */}
      {isOwner && onDelete && (
        <button className="absolute top-4 left-4 z-10 w-12 h-12 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/40 transition-colors"
          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}>
          <Trash2 className="w-5 h-5 text-red-400" />
        </button>
      )}

      {/* Nav buttons - desktop */}
      {hasPrevious && (
        <button className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm items-center justify-center hover:bg-white/20 transition-colors hidden sm:flex"
          onClick={(e) => { e.stopPropagation(); onPrevious?.(); }}>
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}
      {hasNext && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm items-center justify-center hover:bg-white/20 transition-colors hidden sm:flex"
          onClick={(e) => { e.stopPropagation(); onNext?.(); }}>
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Main content */}
      <div 
        className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center touch-pan-y"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* 3D flip card */}
        <div 
          className="perspective-1000 cursor-pointer"
          onClick={() => {
            if (isEditingMemo) return;
            if ('vibrate' in navigator) navigator.vibrate(30);
            playFlipSound();
            setIsFlipped(!isFlipped);
          }}
        >
          <div className={`relative transform-style-3d transition-transform duration-600 ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transitionDuration: '0.6s' }}>
            {/* Front - Image with product tags */}
            <div className="backface-hidden relative">
              <img src={look.image_url} alt="AI가 생성한 패션 코디 룩 이미지" className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-2xl select-none" draggable={false} />
              <ModalWatermarkOverlay show={hasWatermark} />

              {/* Interactive product tags on image */}
              {!isFlipped && taggedProducts.length > 0 && (
                <InteractiveProductTags
                  products={taggedProducts}
                  onPurchase={handleProductPurchase}
                  purchasingProductId={purchasingProductId}
                  imageUrl={look.image_url}
                  enableAIPositioning={true}
                  cachedPositions={look.tag_positions as any[] || undefined}
                  isEditable={isOwner}
                  lookId={look.id}
                  onPositionsAnalyzed={async (positions) => {
                    try {
                      await supabase
                        .from('generated_looks')
                        .update({ tag_positions: positions as any })
                        .eq('id', look.id);
                    } catch (e) {
                      console.error('Failed to cache tag positions:', e);
                    }
                  }}
                  onTagPositionsSaved={(positions) => {
                    // Update parent state if needed
                  }}
                />
              )}

              {/* User info overlay - non-owner */}
              {!isOwner && (
                <button onClick={(e) => { e.stopPropagation(); navigate(`/gallery/${look.user_id}`); }}
                  className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full pl-1 pr-2.5 py-1 hover:bg-black/60 z-10">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={look.user_avatar || undefined} alt={displayName} />
                    <AvatarFallback className="text-[8px] bg-primary/20 text-primary-foreground">{displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-[10px] sm:text-xs font-medium truncate max-w-[80px]">{displayName}</span>
                </button>
              )}

              {/* Product loading indicator */}
              {isLoadingProducts && look.product_ids?.length && (
                <div className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-background/80 backdrop-blur-sm text-foreground text-xs rounded-full flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />{t('lookDetail.productLoading')}
                </div>
              )}

              {/* Flip hint */}
              {!isFlipped && (
                <div className="absolute bottom-3 left-3 z-20 text-xs bg-background/70 backdrop-blur-sm text-foreground/80 px-2.5 py-1.5 rounded-full flex items-center gap-1.5 font-korean backface-hidden">
                  <RotateCcw className="w-3.5 h-3.5" />{t('lookDetail.tapForDetails')}
                </div>
              )}
            </div>

            {/* Back - Info card */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-lg overflow-hidden shadow-2xl flex flex-col" style={{ minHeight: '300px', maxHeight: '55vh' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900" />
              <div className="absolute inset-0 bg-gradient-to-t from-accent/20 via-transparent to-primary/10" />
              
              {/* Sparkle particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-4 left-8 w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                <div className="absolute top-12 right-12 w-1 h-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                <div className="absolute bottom-24 right-8 w-1.5 h-1.5 bg-accent/80 rounded-full animate-pulse" style={{ animationDelay: '0.9s' }} />
              </div>
              
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />
              
              <div className="relative flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                {/* AI Stylist recommendation */}
                <div className="bg-gradient-to-br from-accent/25 via-primary/20 to-accent/15 rounded-xl p-5 border border-accent/40 shadow-lg">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-accent/15 to-primary/15 border border-accent/20 mb-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-accent tracking-wide">{t('lookDetail.aiStylistRecommend')}</span>
                  </div>
                  
                  {look.prompt_used && (
                    <h3 className="text-base font-bold text-white font-korean mb-3 leading-tight">
                      👗 {look.prompt_used.split(' 스타일,')[0].replace('👗 ', '')}
                    </h3>
                  )}
                  
                  <div className="relative pl-3 border-l-2 border-accent/40">
                    <p className="text-sm text-white/90 font-korean leading-relaxed whitespace-pre-wrap">
                      {look.style_reasoning || (
                        lookProducts.length > 0 
                          ? t('lookDetail.brandReasoning').replace('{brands}', lookProducts.map(p => p.brand || p.name.split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' × '))
                          : t('lookDetail.defaultReasoning')
                      )}
                    </p>
                  </div>
                </div>
                
                {/* Products */}
                {lookProducts.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <h4 className="text-sm font-semibold text-white font-korean mb-3 flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-accent" />
                      {t('lookDetail.recommendedProducts')} ({lookProducts.length})
                    </h4>
                    <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-hide">
                      {lookProducts.map((product) => (
                        <div key={product.id} className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 transition-all rounded-lg px-3 py-2.5 group">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-white/20" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-white/90 truncate block font-korean text-xs">
                              {product.brand && <span className="text-accent font-medium">{product.brand} </span>}
                              {product.name}
                            </span>
                            <span className="text-white font-semibold text-sm">{language === 'en' ? `₩${product.price?.toLocaleString()}` : `${product.price?.toLocaleString()}원`}</span>
                            <span className="text-white/50 block text-[8px] mt-0.5 leading-tight">
                              {getProductAffiliateDisclosure(product.product_url, product.merchant_id)}
                            </span>
                          </div>
                          <Button variant="outline" size="sm"
                            className="flex-shrink-0 h-8 px-2.5 text-xs bg-accent/20 border-accent/50 text-white hover:bg-accent hover:text-white transition-all opacity-80 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleProductPurchase(product); }}>
                            <ExternalLink className="w-3 h-3 mr-1" />{t('lookDetail.purchase')}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/20 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-white font-korean">{t('lookDetail.totalPrice')}</span>
                        <span className="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                          {language === 'en' ? '₩' : ''}{lookProducts.reduce((s, p) => s + (p.price || 0), 0).toLocaleString()}{language === 'ko' ? '원' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {look.tags && look.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-white font-korean mb-2">{t('lookDetail.tags')}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {look.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-gradient-to-r from-accent/30 to-primary/30 text-white border border-accent/40 px-2.5 py-1 rounded-full font-korean">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Memo */}
                {look.memo && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <h4 className="text-sm font-semibold text-white font-korean mb-1.5 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />{t('lookDetail.memo')}
                    </h4>
                    <p className="text-sm text-white/70 font-korean italic">"{look.memo}"</p>
                  </div>
                )}
              </div>

              {/* Bottom info */}
              <div className="relative border-t border-white/10 px-5 py-3 flex items-center justify-between bg-black/30 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-xs text-white/60 font-korean cursor-pointer hover:text-white/80 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />{t('lookDetail.tapForImage')}
                </div>
                <span className="text-xs text-white/60 font-korean">
                  {new Date(look.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
            </div>
          </div>
        </div>

        {/* Swipe hint - mobile */}
        {(hasPrevious || hasNext) && (
          <div className="sm:hidden text-center mt-2">
            <p className="text-white/40 text-xs font-korean">{t('lookDetail.swipeHint')}</p>
          </div>
        )}

        {/* Bottom info & actions */}
        {!isEditingMemo && (
          <>
            {/* Tags/memo display */}
            {(look.tags?.length || look.memo) && !isFlipped && (
              <div className="mt-3 text-center max-w-md">
                {look.tags && look.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mb-2">
                    {look.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-accent/80 text-accent-foreground px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                {look.memo && <p className="text-white/70 text-sm font-korean line-clamp-2">"{look.memo}"</p>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4">
              <p className="text-white/80 text-sm font-korean">
                {new Date(look.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              {currentIndex !== undefined && totalCount !== undefined && (
                <>
                  <span className="text-white/40">•</span>
                  <p className="text-white/60 text-sm">{currentIndex + 1} / {totalCount}</p>
                </>
              )}

              {/* Owner-only actions */}
              {isOwner && (
                <>
                  <span className="text-white/40 hidden sm:inline">•</span>
                  
                  {onUpdateMemoTags && (
                    <button onClick={startEditingMemo} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                      <Tag className="w-4 h-4 text-white" />
                      <span className="text-white text-sm font-korean hidden sm:inline">{look.memo || look.tags?.length ? t('lookDetail.edit') : t('lookDetail.memoTags')}</span>
                    </button>
                  )}
                  
                  {onToggleFavorite && (
                    <button onClick={() => onToggleFavorite(look.id, !look.is_favorite)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                      <Heart className={`w-4 h-4 ${look.is_favorite ? 'fill-accent text-accent' : 'text-white'}`} />
                      <span className="text-white text-sm font-korean hidden sm:inline">{look.is_favorite ? t('lookDetail.favorited') : t('lookDetail.favorite')}</span>
                    </button>
                  )}

                  {onTogglePublic && (
                    <button onClick={() => onTogglePublic(look.id, !look.is_public)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                      {look.is_public ? <Globe className="w-4 h-4 text-green-400" /> : <LockKeyhole className="w-4 h-4 text-white" />}
                      <span className="text-white text-sm font-korean hidden sm:inline">{look.is_public ? t('lookDetail.public') : t('lookDetail.private')}</span>
                    </button>
                  )}
                </>
              )}

              {/* Like button - non-owner (replaces favorite) */}
              {!isOwner && onToggleLike && (
                <>
                  <span className="text-white/40">•</span>
                  <button onClick={handleLike} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <Heart className={`w-4 h-4 transition-transform duration-300 ${localLiked ? 'fill-red-500 text-red-500' : 'text-white'} ${likeAnimating ? 'scale-125' : 'scale-100'}`} />
                    <span className="text-white text-sm">{localLikeCount > 0 ? localLikeCount : ''}</span>
                  </button>
                </>
              )}

              {/* Like count display only (when no toggle handler) */}
              {!isOwner && !onToggleLike && localLikeCount > 0 && (
                <>
                  <span className="text-white/40">•</span>
                  <div className="flex items-center gap-1 text-white/60">
                    <Heart className="w-3.5 h-3.5" />
                    <span className="text-sm">{localLikeCount}</span>
                  </div>
                </>
              )}

              {/* SNS Share buttons */}
              <span className="text-white/40">•</span>
              <div onClick={(e) => e.stopPropagation()}>
                <ShareButtons
                  imageUrl={look.image_url}
                  onShare={handleShareResult}
                  compact
                  hasWatermark={hasWatermark}
                  logoUrl={showmelookWatermarkFull}
                  lookId={look.id}
                  prompt={look.prompt_used || undefined}
                  tags={look.tags || undefined}
                  showDownload={isOwner}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Memo/tag edit modal - owner only */}
      {isEditingMemo && isOwner && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setIsEditingMemo(false); }}>
          <div className="bg-card rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground font-korean mb-4">{t('lookDetail.editMemoTags')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground font-korean mb-2 block">{t('lookDetail.memoLabel')}</label>
                <Textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder={t('lookDetail.memoPlaceholder')} className="resize-none h-20 font-korean" maxLength={200} />
                <p className="text-xs text-muted-foreground mt-1 text-right">{editMemo.length}/200</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground font-korean mb-2 block">{t('lookDetail.tagsLabel')}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
                      {tag}
                      <button onClick={() => setEditTags(editTags.filter(t => t !== tag))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(newTag))} placeholder={t('lookDetail.tagPlaceholder')} className="flex-1 h-8 text-sm" maxLength={20} />
                  <Button size="sm" variant="outline" onClick={() => addTag(newTag)} disabled={!newTag.trim()}>{t('lookDetail.add')}</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tagOptions.filter(t => !editTags.includes(t)).map((tag) => (
                    <button key={tag} onClick={() => addTag(tag)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors font-korean">+ {tag}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1 font-korean" onClick={() => setIsEditingMemo(false)}>{t('lookDetail.cancel')}</Button>
              <Button className="flex-1 font-korean" onClick={saveMemoAndTags} disabled={isSavingMemo}>
                {isSavingMemo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{t('lookDetail.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && isOwner && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-center font-korean mb-2">{t('lookDetail.deleteTitle')}</h3>
            <p className="text-sm text-muted-foreground text-center font-korean mb-6 whitespace-pre-line">{t('lookDetail.deleteConfirm')}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 font-korean" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>{t('lookDetail.cancel')}</Button>
              <Button variant="destructive" className="flex-1 font-korean" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('lookDetail.deleting')}</> : <><Trash2 className="w-4 h-4 mr-2" />{t('lookDetail.delete')}</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
