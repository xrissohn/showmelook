import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, ExternalLink, Link2, Loader2, Database, ShoppingBag, Package, RefreshCw, Play, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeeplinkResult {
  success?: boolean;
  merchant_id?: string;
  merchant_name?: string;
  original_url?: string;
  affiliate_url?: string;
  error?: string;
  message?: string;
}

interface Merchant {
  id: string;
  name: string;
  name_ko: string;
  base_url: string;
  commission_rate: number;
  scrape_type: string;
  is_active: boolean;
  last_collected_at: string | null;
}

interface CollectResult {
  success: boolean;
  merchant_id: string;
  collected: number;
  inserted: number;
  updated: number;
  errors: number;
  error?: string;
  message?: string;
}

interface CachedProduct {
  id: string;
  merchant_id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  category: string;
  style_tags: string[] | null;
  is_in_stock: boolean;
  collected_at: string;
}


interface StyleV1Result {
  success: boolean;
  look?: {
    items: Array<{
      id: string;
      name: string;
      brand: string | null;
      price: number;
      image_url: string | null;
      product_url: string;
      category: string;
      style_tags: string[] | null;
    }>;
    totalPrice: number;
    styleTags: string[];
    occasion: string;
  };
  message?: string;
  error?: string;
}

interface StyleRecommendResult {
  success: boolean;
  cacheHit: boolean;
  look?: {
    name: string;
    items: Array<{
      category: string;
      product: {
        id: string;
        name: string;
        brand: string | null;
        price: number;
        image_url: string | null;
        product_url: string;
        category: string;
        style_tags: string[] | null;
      } | null;
      affiliateUrl: string | null;
      source: 'cache' | 'serpapi' | 'none';
    }>;
    totalPrice: number;
    stylingTips: string;
    styleTags: string[];
  };
  apiCalls?: {
    gemini: number;
    serpapi: number;
  };
  stats?: {
    requestedItems: number;
    foundInCache: number;
    foundViaSerpapi: number;
    notFound: number;
  };
  error?: string;
}

interface WebUnlockerResult {
  success: boolean;
  mode?: string;
  total_urls?: number;
  success_count?: number;
  error_count?: number;
  saved_count?: number;
  results?: Array<{
    name: string;
    brand: string | null;
    price: number;
    original_price: number | null;
    image_url: string | null;
    category: string;
    merchant_id: string;
    product_url: string;
    sizes: string[] | null;
    is_in_stock: boolean;
    color: string | null;
    html_length?: number;
  }>;
  errors?: Array<{
    url: string;
    error: string;
    html_sample?: string;
  }>;
  error?: string;
}

interface BatchCollectResult {
  success: boolean;
  merchants_processed: number;
  total_saved: number;
  results: Array<{
    merchant_id: string;
    merchant_name: string;
    urls_tried: number;
    success_count: number;
    saved_count: number;
    errors: string[];
  }>;
  error?: string;
}

const Admin = () => {
  const { toast } = useToast();
  
  // Phase 1: Deeplink test state
  const [productUrl, setProductUrl] = useState("");
  const [deeplinkResult, setDeeplinkResult] = useState<DeeplinkResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Merchants list state
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantsLoading, setMerchantsLoading] = useState(false);

  // Phase 2: Product collection state
  const [selectedMerchant, setSelectedMerchant] = useState<string>("");
  const [collectLimit, setCollectLimit] = useState("10");
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  
  // Products list state
  const [cachedProducts, setCachedProducts] = useState<CachedProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productStats, setProductStats] = useState<{ total: number; byMerchant: Record<string, number> }>({ total: 0, byMerchant: {} });


  // Style v1 test state
  const [styleOccasion, setStyleOccasion] = useState("캐주얼");
  const [styleGender, setStyleGender] = useState<"male" | "female" | "unisex">("female");
  const [styleBudgetMax, setStyleBudgetMax] = useState("300000");
  const [styleResult, setStyleResult] = useState<StyleV1Result | null>(null);
  const [isStyleLoading, setIsStyleLoading] = useState(false);

  // Style-recommend (AI) test state
  const [aiUserRequest, setAiUserRequest] = useState("");
  const [aiGender, setAiGender] = useState("여성");
  const [aiBudget, setAiBudget] = useState("200000");
  const [aiForceRefresh, setAiForceRefresh] = useState(false);
  const [aiResult, setAiResult] = useState<StyleRecommendResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Web Unlocker test state
  const [webUnlockerUrls, setWebUnlockerUrls] = useState("");
  const [webUnlockerMode, setWebUnlockerMode] = useState<"preview" | "save">("preview");
  const [webUnlockerResult, setWebUnlockerResult] = useState<WebUnlockerResult | null>(null);
  const [isWebUnlockerLoading, setIsWebUnlockerLoading] = useState(false);

  // Batch collect state
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);
  const [batchUrlsPerMerchant, setBatchUrlsPerMerchant] = useState("3");
  const [batchResult, setBatchResult] = useState<BatchCollectResult | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  useEffect(() => {
    loadMerchants();
  }, []);

  const testDeeplink = async () => {
    if (!productUrl.trim()) {
      toast({
        title: "URL 입력 필요",
        description: "상품 URL을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setDeeplinkResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: productUrl },
      });

      if (error) throw error;
      
      setDeeplinkResult(data);
      
      if (data.success) {
        toast({
          title: "딥링크 생성 성공",
          description: `${data.merchant_name} 제휴 링크가 생성되었습니다.`,
        });
      }
    } catch (error: any) {
      console.error('Deeplink test error:', error);
      setDeeplinkResult({ error: error.message || 'Unknown error' });
      toast({
        title: "딥링크 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMerchants = async () => {
    setMerchantsLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setMerchants(data || []);
    } catch (error: any) {
      toast({
        title: "머천트 로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setMerchantsLoading(false);
    }
  };

  const collectProducts = async () => {
    if (!selectedMerchant) {
      toast({
        title: "머천트 선택 필요",
        description: "상품을 수집할 머천트를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsCollecting(true);
    setCollectResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('collect-products', {
        body: { 
          merchant_id: selectedMerchant,
          limit: parseInt(collectLimit) || 10
        },
      });

      if (error) throw error;
      
      setCollectResult(data);
      
      if (data.success) {
        toast({
          title: "상품 수집 완료",
          description: `${data.collected}개 상품 중 ${data.inserted}개 저장됨`,
        });
        // Refresh merchants list to show updated last_collected_at
        loadMerchants();
        // Refresh product stats
        loadProductStats();
      } else {
        toast({
          title: "상품 수집 실패",
          description: data.error || data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Collect products error:', error);
      setCollectResult({ 
        success: false, 
        merchant_id: selectedMerchant,
        collected: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        error: error.message 
      });
      toast({
        title: "상품 수집 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const loadProductStats = async () => {
    try {
      // Get total count
      const { count: total } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true });

      // Get counts by merchant
      const { data: products } = await supabase
        .from('products_cache')
        .select('merchant_id');

      const byMerchant: Record<string, number> = {};
      products?.forEach(p => {
        byMerchant[p.merchant_id] = (byMerchant[p.merchant_id] || 0) + 1;
      });

      setProductStats({ total: total || 0, byMerchant });
    } catch (error) {
      console.error('Error loading product stats:', error);
    }
  };

  const loadCachedProducts = async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products_cache')
        .select('id, merchant_id, name, brand, price, image_url, category, style_tags, is_in_stock, collected_at')
        .order('collected_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setCachedProducts(data || []);
      loadProductStats();
    } catch (error: any) {
      toast({
        title: "상품 로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProductsLoading(false);
    }
  };

  const openAffiliateLink = () => {
    if (deeplinkResult?.affiliate_url) {
      window.open(deeplinkResult.affiliate_url, '_blank');
    }
  };


  const testStyleV1 = async () => {
    setIsStyleLoading(true);
    setStyleResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('style-v1', {
        body: {
          preferences: {
            gender: styleGender,
            style: [styleOccasion === '비즈니스' ? '포멀' : styleOccasion === '운동' ? '스포티' : '캐주얼'],
            budget: { max: parseInt(styleBudgetMax) || 300000 },
            occasion: styleOccasion,
          },
        },
      });

      if (error) throw error;
      
      setStyleResult(data);
      
      if (data.success) {
        toast({
          title: "룩 추천 완료",
          description: `${data.look.items.length}개 아이템, 총 ₩${data.look.totalPrice.toLocaleString()}`,
        });
      } else {
        toast({
          title: "룩 추천 실패",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Style v1 test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStyleResult({ success: false, error: errorMessage });
      toast({
        title: "룩 추천 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsStyleLoading(false);
    }
  };

  const testStyleRecommend = async () => {
    if (!aiUserRequest.trim()) {
      toast({
        title: "요청 입력 필요",
        description: "스타일 요청을 입력해주세요. (예: 캐주얼 데이트룩)",
        variant: "destructive",
      });
      return;
    }

    setIsAiLoading(true);
    setAiResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest: aiUserRequest,
          gender: aiGender,
          budget: parseInt(aiBudget) || 200000,
          forceRefresh: aiForceRefresh,
        },
      });

      if (error) throw error;
      
      setAiResult(data);
      
      if (data.success) {
        const cacheMsg = data.cacheHit ? '캐시 히트!' : `API: Gemini ${data.apiCalls?.gemini || 0}, SerpAPI ${data.apiCalls?.serpapi || 0}`;
        toast({
          title: "AI 추천 완료",
          description: `${data.look?.items?.filter((i: any) => i.product)?.length || 0}개 아이템 추천 (${cacheMsg})`,
        });
      } else {
        toast({
          title: "AI 추천 실패",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Style recommend error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAiResult({ success: false, cacheHit: false, error: errorMessage });
      toast({
        title: "AI 추천 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const testWebUnlocker = async () => {
    if (!webUnlockerUrls.trim()) {
      toast({
        title: "URL 입력 필요",
        description: "상품 URL을 한 줄에 하나씩 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsWebUnlockerLoading(true);
    setWebUnlockerResult(null);

    try {
      const urls = webUnlockerUrls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      const { data, error } = await supabase.functions.invoke('web-unlocker', {
        body: { urls, mode: webUnlockerMode },
      });

      if (error) throw error;
      
      setWebUnlockerResult(data);
      
      if (data.success) {
        toast({
          title: "Web Unlocker 수집 완료",
          description: webUnlockerMode === 'preview' 
            ? `${data.success_count}개 상품 추출 성공 (오류: ${data.error_count})`
            : `${data.saved_count}개 상품 저장됨`,
        });
      } else {
        toast({
          title: "수집 실패",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Web Unlocker test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setWebUnlockerResult({ success: false, error: errorMessage });
      toast({
        title: "Web Unlocker 오류",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsWebUnlockerLoading(false);
    }
  };

  const runBatchCollect = async () => {
    if (selectedMerchants.length === 0) {
      toast({
        title: "머천트 선택 필요",
        description: "수집할 머천트를 1개 이상 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsBatchLoading(true);
    setBatchResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('batch-collect', {
        body: { 
          merchantIds: selectedMerchants,
          urlsPerMerchant: parseInt(batchUrlsPerMerchant) || 3,
        },
      });

      if (error) throw error;
      
      setBatchResult(data);
      
      if (data.success) {
        toast({
          title: "배치 수집 완료",
          description: `${data.merchants_processed}개 머천트에서 ${data.total_saved}개 상품 저장됨`,
        });
        loadMerchants();
        loadProductStats();
      } else {
        toast({
          title: "배치 수집 실패",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Batch collect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBatchResult({ success: false, merchants_processed: 0, total_saved: 0, results: [], error: errorMessage });
      toast({
        title: "배치 수집 오류",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsBatchLoading(false);
    }
  };

  const toggleMerchantSelection = (merchantId: string) => {
    setSelectedMerchants(prev => 
      prev.includes(merchantId) 
        ? prev.filter(id => id !== merchantId)
        : [...prev, merchantId]
    );
  };

  const selectAllMerchants = () => {
    setSelectedMerchants(merchants.map(m => m.id));
  };

  const deselectAllMerchants = () => {
    setSelectedMerchants([]);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Admin 테스트 페이지</h1>
          <p className="text-muted-foreground">
            ShowMeLook 제휴 시스템 단계별 테스트
          </p>
        </div>

        {/* Phase Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              구현 단계 체크리스트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhaseItem 
                phase={1} 
                title="딥링크 + 인프라" 
                items={[
                  { done: true, label: "LINKPRICE_AFFILIATE_ID Secret" },
                  { done: true, label: "merchants 테이블" },
                  { done: true, label: "products_cache 테이블" },
                  { done: true, label: "8개 머천트 데이터" },
                  { done: true, label: "deeplink Edge Function" },
                  { done: true, label: "/admin 테스트 페이지" },
                ]}
              />
              <PhaseItem 
                phase={2} 
                title="상품 자동 수집" 
                items={[
                  { done: true, label: "collect-products Edge Function" },
                  { done: true, label: "web-unlocker Edge Function" },
                  { done: true, label: "스타일 태그 자동 분류" },
                  { done: false, label: "CRON 스케줄 설정" },
                ]}
              />
              <PhaseItem 
                phase={3} 
                title="규칙 기반 추천" 
                items={[
                  { done: true, label: "style_v1 Edge Function" },
                  { done: true, label: "style-recommend Edge Function (AI)" },
                  { done: false, label: "/recommend 페이지" },
                ]}
              />
              <PhaseItem 
                phase={4} 
                title="DNA + RAG 고도화" 
                items={[
                  { done: false, label: "product_dna 테이블" },
                  { done: false, label: "dna_batch Edge Function" },
                  { done: false, label: "style_v2 Edge Function" },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Tabs */}
        <Tabs defaultValue="batch-collect" className="space-y-4">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="admin-tools">관리도구</TabsTrigger>
            <TabsTrigger value="batch-collect">배치 수집</TabsTrigger>
            <TabsTrigger value="style-recommend">AI 추천</TabsTrigger>
            <TabsTrigger value="brightdata">BrightData</TabsTrigger>
            <TabsTrigger value="style-v1">규칙 추천</TabsTrigger>
            <TabsTrigger value="deeplink">딥링크</TabsTrigger>
            <TabsTrigger value="merchants">머천트</TabsTrigger>
            <TabsTrigger value="collect">상품 수집</TabsTrigger>
            <TabsTrigger value="products">수집된 상품</TabsTrigger>
          </TabsList>

          {/* Admin Tools Tab */}
          <TabsContent value="admin-tools" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  관리 도구
                </CardTitle>
                <CardDescription>
                  시스템 관리 및 테스트를 위한 도구들
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Generation Usage Reset */}
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" />
                        일일 생성 횟수 초기화
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        오늘의 스타일 생성 횟수를 0으로 리셋합니다.
                      </p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            toast({
                              title: "로그인 필요",
                              description: "로그인 후 사용해주세요.",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          const today = new Date().toISOString().split('T')[0];
                          const { error } = await supabase
                            .from('daily_generation_usage')
                            .update({ generation_count: 0, updated_at: new Date().toISOString() })
                            .eq('user_id', user.id)
                            .eq('usage_date', today);
                          
                          if (error) throw error;
                          
                          toast({
                            title: "초기화 완료",
                            description: "오늘의 생성 횟수가 0으로 초기화되었습니다.",
                          });
                        } catch (error: any) {
                          toast({
                            title: "초기화 실패",
                            description: error.message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      횟수 초기화
                    </Button>
                  </div>
                </div>

                {/* Cache Clear */}
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        추천 캐시 초기화
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        스타일 추천 캐시를 삭제합니다.
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('style_cache')
                            .delete()
                            .lt('expires_at', new Date().toISOString());
                          
                          if (error) throw error;
                          
                          toast({
                            title: "캐시 정리 완료",
                            description: "만료된 캐시가 삭제되었습니다.",
                          });
                        } catch (error: any) {
                          toast({
                            title: "캐시 정리 실패",
                            description: error.message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      만료 캐시 정리
                    </Button>
                  </div>
                </div>

                {/* Delete All Today's Usage */}
                <div className="p-4 border border-destructive/30 rounded-lg space-y-4 bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2 text-destructive">
                        <XCircle className="w-4 h-4" />
                        전체 사용자 생성 횟수 초기화
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        모든 사용자의 오늘 생성 횟수를 초기화합니다. (주의!)
                      </p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const today = new Date().toISOString().split('T')[0];
                          const { error } = await supabase
                            .from('daily_generation_usage')
                            .update({ generation_count: 0, updated_at: new Date().toISOString() })
                            .eq('usage_date', today);
                          
                          if (error) throw error;
                          
                          toast({
                            title: "전체 초기화 완료",
                            description: "모든 사용자의 오늘 생성 횟수가 초기화되었습니다.",
                          });
                        } catch (error: any) {
                          toast({
                            title: "초기화 실패",
                            description: error.message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      전체 초기화
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Collect Tab */}
          <TabsContent value="batch-collect" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  8개 머천트 배치 수집
                </CardTitle>
                <CardDescription>
                  선택한 머천트에서 Bright Data Proxy를 사용하여 상품을 일괄 수집합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Merchant Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">머천트 선택</label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllMerchants}>
                        전체 선택
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllMerchants}>
                        전체 해제
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {merchants.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMerchantSelection(m.id)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedMerchants.includes(m.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card hover:bg-muted border-border'
                        }`}
                      >
                        <p className="font-medium text-sm">{m.name_ko}</p>
                        <p className="text-xs opacity-80">{m.name}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedMerchants.length}개 머천트 선택됨
                  </p>
                </div>

                {/* URLs per merchant */}
                <div>
                  <label className="text-sm font-medium mb-2 block">머천트별 URL 수</label>
                  <Select value={batchUrlsPerMerchant} onValueChange={setBatchUrlsPerMerchant}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="URL 수 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2개</SelectItem>
                      <SelectItem value="3">3개</SelectItem>
                      <SelectItem value="5">5개</SelectItem>
                      <SelectItem value="10">10개</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={runBatchCollect} 
                  disabled={isBatchLoading || selectedMerchants.length === 0} 
                  className="w-full"
                  size="lg"
                >
                  {isBatchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isBatchLoading 
                    ? `수집 중... (${selectedMerchants.length}개 머천트)` 
                    : `${selectedMerchants.length}개 머천트에서 수집 시작`}
                </Button>

                {/* Batch Result */}
                {batchResult && (
                  <div className={`p-4 rounded-lg border ${
                    batchResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}>
                    {batchResult.success ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">
                            {batchResult.merchants_processed}개 머천트 처리 완료, 
                            총 {batchResult.total_saved}개 상품 저장
                          </span>
                        </div>
                        
                        {/* Results per merchant */}
                        <div className="space-y-2">
                          {batchResult.results.map((r) => (
                            <div key={r.merchant_id} className="p-3 bg-card rounded border">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{r.merchant_name}</span>
                                <div className="flex gap-2 text-sm">
                                  <Badge variant="outline">시도: {r.urls_tried}</Badge>
                                  <Badge variant="secondary">성공: {r.success_count}</Badge>
                                  <Badge variant="default">저장: {r.saved_count}</Badge>
                                </div>
                              </div>
                              {r.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                  {r.errors.slice(0, 2).map((e, i) => (
                                    <p key={i} className="truncate">{e}</p>
                                  ))}
                                  {r.errors.length > 2 && (
                                    <p>... +{r.errors.length - 2}개 더</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">배치 수집 실패: {batchResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Style Recommend (AI) Test Tab */}
          <TabsContent value="style-recommend" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  AI 스타일 추천 (style-recommend)
                </CardTitle>
                <CardDescription>
                  Gemini AI가 스타일을 추론하고, 캐시된 상품 또는 SerpAPI 검색 결과로 룩을 조합합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">스타일 요청</label>
                    <Input
                      placeholder="예: 캐주얼 데이트룩, 출근 비즈니스 캐주얼..."
                      value={aiUserRequest}
                      onChange={(e) => setAiUserRequest(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && testStyleRecommend()}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">성별</label>
                      <Select value={aiGender} onValueChange={setAiGender}>
                        <SelectTrigger>
                          <SelectValue placeholder="성별 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="여성">여성</SelectItem>
                          <SelectItem value="남성">남성</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">총 예산</label>
                      <Input
                        type="number"
                        placeholder="200000"
                        value={aiBudget}
                        onChange={(e) => setAiBudget(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm pb-2">
                        <input
                          type="checkbox"
                          checked={aiForceRefresh}
                          onChange={(e) => setAiForceRefresh(e.target.checked)}
                          className="rounded"
                        />
                        캐시 무시 (새로 생성)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Sample Requests */}
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">예시 요청:</p>
                  <div className="flex flex-wrap gap-2">
                    {["캐주얼 데이트룩", "비즈니스 캐주얼", "여름 휴가 스타일", "파티룩", "미니멀 데일리"].map((q) => (
                      <button 
                        key={q}
                        onClick={() => setAiUserRequest(q)}
                        className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={testStyleRecommend} disabled={isAiLoading} className="w-full">
                  {isAiLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 mr-2" />
                  )}
                  AI 추천 생성
                </Button>

                {/* Result */}
                {aiResult && (
                  <div className={`p-4 rounded-lg border ${
                    aiResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}>
                    {aiResult.success && aiResult.look ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">{aiResult.look.name}</span>
                            {aiResult.cacheHit && (
                              <Badge variant="secondary">캐시 히트!</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">₩{aiResult.look.totalPrice.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {aiResult.look.items.filter(i => i.product).length}개 아이템
                            </p>
                          </div>
                        </div>
                        
                        {/* API Calls & Stats */}
                        {aiResult.apiCalls && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">Gemini: {aiResult.apiCalls.gemini}회</Badge>
                            <Badge variant="outline">SerpAPI: {aiResult.apiCalls.serpapi}회</Badge>
                            {aiResult.stats && (
                              <>
                                <Badge variant="secondary">캐시: {aiResult.stats.foundInCache}</Badge>
                                <Badge variant="secondary">SerpAPI: {aiResult.stats.foundViaSerpapi}</Badge>
                                {aiResult.stats.notFound > 0 && (
                                  <Badge variant="destructive">미발견: {aiResult.stats.notFound}</Badge>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Style Tags */}
                        <div className="flex flex-wrap gap-1">
                          {aiResult.look.styleTags.map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>

                        {/* Styling Tips */}
                        {aiResult.look.stylingTips && (
                          <div className="p-3 bg-muted rounded-lg text-sm">
                            <p className="font-medium mb-1">💡 스타일링 팁</p>
                            <p>{aiResult.look.stylingTips}</p>
                          </div>
                        )}

                        {/* Look Items Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {aiResult.look.items.map((item, idx) => (
                            <div key={idx} className="border rounded-lg overflow-hidden bg-card">
                              <div className="aspect-square bg-muted relative">
                                {item.product?.image_url ? (
                                  <img 
                                    src={item.product.image_url} 
                                    alt={item.product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = '/placeholder.svg';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-8 h-8 text-muted-foreground" />
                                  </div>
                                )}
                                <Badge className="absolute top-1 left-1 text-xs" variant="default">
                                  {item.category}
                                </Badge>
                                <Badge className="absolute top-1 right-1 text-xs" variant={
                                  item.source === 'cache' ? 'secondary' : 
                                  item.source === 'serpapi' ? 'outline' : 'destructive'
                                }>
                                  {item.source === 'cache' ? '캐시' : 
                                   item.source === 'serpapi' ? 'SerpAPI' : '없음'}
                                </Badge>
                              </div>
                              <div className="p-2">
                                {item.product ? (
                                  <>
                                    <p className="text-xs font-medium line-clamp-2 mb-1">{item.product.name}</p>
                                    <p className="text-sm font-bold text-primary">
                                      ₩{item.product.price.toLocaleString()}
                                    </p>
                                    {item.affiliateUrl && (
                                      <a 
                                        href={item.affiliateUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        구매하기 (제휴)
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">상품 없음</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                          <XCircle className="w-5 h-5" />
                          <span className="font-medium">추천 실패: {aiResult.error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Web Unlocker Test Tab */}
          <TabsContent value="brightdata" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Bright Data Web Unlocker
                </CardTitle>
                <CardDescription>
                  Bright Data Web Unlocker API를 사용하여 봇 차단을 우회하고 상품 정보를 수집합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">상품 URL (한 줄에 하나씩, 최대 10개)</label>
                    <textarea
                      className="w-full h-40 p-3 border rounded-lg font-mono text-sm resize-none"
                      placeholder={`https://www.wconcept.co.kr/Product/300124178\nhttps://www.musinsa.com/app/goods/2994785\nhttps://www.29cm.co.kr/products/12345`}
                      value={webUnlockerUrls}
                      onChange={(e) => setWebUnlockerUrls(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">모드</label>
                      <Select value={webUnlockerMode} onValueChange={(v) => setWebUnlockerMode(v as "preview" | "save")}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="모드 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preview">미리보기 (저장 안함)</SelectItem>
                          <SelectItem value="save">저장 (DB에 저장)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 text-sm text-muted-foreground">
                      <p>• <strong>미리보기</strong>: HTML 파싱 결과 확인 (DB 저장 X)</p>
                      <p>• <strong>저장</strong>: 결과를 products_cache 테이블에 저장</p>
                    </div>
                  </div>
                </div>

                {/* Sample URLs */}
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">테스트 URL:</p>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => setWebUnlockerUrls("https://www.wconcept.co.kr/Product/300124178")}
                      className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs"
                    >
                      W Concept
                    </button>
                    <button 
                      onClick={() => setWebUnlockerUrls("https://www.musinsa.com/app/goods/2994785")}
                      className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs"
                    >
                      Musinsa
                    </button>
                    <button 
                      onClick={() => setWebUnlockerUrls("https://www.29cm.co.kr/products/2794631")}
                      className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs"
                    >
                      29CM
                    </button>
                  </div>
                </div>

                <Button onClick={testWebUnlocker} disabled={isWebUnlockerLoading} className="w-full">
                  {isWebUnlockerLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Database className="w-4 h-4 mr-2" />
                  )}
                  {webUnlockerMode === 'preview' ? 'HTML 파싱 테스트' : '수집 및 저장'}
                </Button>

                {/* Result */}
                {webUnlockerResult && (
                  <div className={`p-4 rounded-lg border ${
                    webUnlockerResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}>
                    {webUnlockerResult.success ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">
                            {webUnlockerResult.mode === 'preview' ? '파싱 완료' : '저장 완료'}
                          </span>
                          <Badge variant="secondary">성공: {webUnlockerResult.success_count}</Badge>
                          {webUnlockerResult.error_count && webUnlockerResult.error_count > 0 && (
                            <Badge variant="destructive">실패: {webUnlockerResult.error_count}</Badge>
                          )}
                        </div>
                        
                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">요청 URL</p>
                            <p className="font-bold">{webUnlockerResult.total_urls}개</p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">파싱 성공</p>
                            <p className="font-bold">{webUnlockerResult.success_count}개</p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">파싱 실패</p>
                            <p className="font-bold">{webUnlockerResult.error_count}개</p>
                          </div>
                          {webUnlockerResult.mode === 'save' && (
                            <div className="p-2 bg-muted rounded">
                              <p className="text-muted-foreground">DB 저장</p>
                              <p className="font-bold">{webUnlockerResult.saved_count}개</p>
                            </div>
                          )}
                        </div>

                        {/* Products Grid */}
                        {webUnlockerResult.results && webUnlockerResult.results.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">추출된 상품:</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                              {webUnlockerResult.results.map((product, idx) => (
                                <div key={idx} className="border rounded-lg overflow-hidden bg-card">
                                  <div className="aspect-square bg-muted relative">
                                    {product.image_url ? (
                                      <img 
                                        src={product.image_url} 
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.src = '/placeholder.svg';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-8 h-8 text-muted-foreground" />
                                      </div>
                                    )}
                                    <Badge className="absolute top-1 left-1 text-xs" variant="secondary">
                                      {product.merchant_id}
                                    </Badge>
                                    {product.is_in_stock ? (
                                      <Badge className="absolute top-1 right-1 text-xs" variant="default">재고</Badge>
                                    ) : (
                                      <Badge className="absolute top-1 right-1 text-xs" variant="destructive">품절</Badge>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="text-xs font-medium line-clamp-2 mb-1">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">{product.brand || '-'}</p>
                                    <div className="flex items-baseline gap-1 mt-1">
                                      <p className="text-sm font-bold">₩{product.price?.toLocaleString()}</p>
                                      {product.original_price && product.original_price > product.price && (
                                        <p className="text-xs text-muted-foreground line-through">
                                          ₩{product.original_price.toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                                      {product.color && (
                                        <Badge variant="secondary" className="text-xs">{product.color}</Badge>
                                      )}
                                    </div>
                                    {product.sizes && product.sizes.length > 0 && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        사이즈: {product.sizes.slice(0, 3).join(', ')}{product.sizes.length > 3 ? '...' : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Errors */}
                        {webUnlockerResult.errors && webUnlockerResult.errors.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-red-600 font-medium">
                              실패한 URL ({webUnlockerResult.errors.length}개)
                            </summary>
                            <div className="mt-2 space-y-2">
                              {webUnlockerResult.errors.map((err, idx) => (
                                <div key={idx} className="p-2 bg-red-50 dark:bg-red-950 rounded">
                                  <p className="font-mono text-xs break-all">{err.url}</p>
                                  <p className="text-red-600">{err.error}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span>{webUnlockerResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Style V1 Test Tab */}
          <TabsContent value="style-v1" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Phase 3: 규칙 기반 룩 추천 (style-v1)
                </CardTitle>
                <CardDescription>
                  products_cache의 상품으로 카테고리별 1개씩 조합하여 룩을 추천합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">TPO/상황</label>
                    <Select value={styleOccasion} onValueChange={setStyleOccasion}>
                      <SelectTrigger>
                        <SelectValue placeholder="상황 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="캐주얼">캐주얼</SelectItem>
                        <SelectItem value="비즈니스">비즈니스</SelectItem>
                        <SelectItem value="데이트">데이트</SelectItem>
                        <SelectItem value="파티">파티</SelectItem>
                        <SelectItem value="운동">운동</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">성별</label>
                    <Select value={styleGender} onValueChange={(v) => setStyleGender(v as "male" | "female" | "unisex")}>
                      <SelectTrigger>
                        <SelectValue placeholder="성별 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">여성</SelectItem>
                        <SelectItem value="male">남성</SelectItem>
                        <SelectItem value="unisex">무관</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">최대 예산</label>
                    <Input
                      type="number"
                      placeholder="300000"
                      value={styleBudgetMax}
                      onChange={(e) => setStyleBudgetMax(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={testStyleV1} disabled={isStyleLoading} className="w-full">
                  {isStyleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 mr-2" />
                  )}
                  룩 추천 생성
                </Button>

                {/* Result */}
                {styleResult && (
                  <div className={`p-4 rounded-lg border ${
                    styleResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}>
                    {styleResult.success && styleResult.look ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">{styleResult.message}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">₩{styleResult.look.totalPrice.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{styleResult.look.items.length}개 아이템</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {styleResult.look.styleTags.map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>

                        {/* Look Items Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {styleResult.look.items.map((item) => (
                            <div key={item.id} className="border rounded-lg overflow-hidden bg-card">
                              <div className="aspect-square bg-muted relative">
                                {item.image_url ? (
                                  <img 
                                    src={item.image_url} 
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = '/placeholder.svg';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-8 h-8 text-muted-foreground" />
                                  </div>
                                )}
                                <Badge className="absolute top-1 left-1 text-xs" variant="default">
                                  {item.category}
                                </Badge>
                              </div>
                              <div className="p-2">
                                <p className="text-xs font-medium line-clamp-2 mb-1">{item.name}</p>
                                <p className="text-sm font-bold text-primary">
                                  ₩{item.price.toLocaleString()}
                                </p>
                                <a 
                                  href={item.product_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  구매하기
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                          <XCircle className="w-5 h-5" />
                          <span className="font-medium">추천 실패: {styleResult.error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deeplink Test Tab */}
          <TabsContent value="deeplink" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  딥링크 변환 테스트
                </CardTitle>
                <CardDescription>
                  상품 URL을 입력하면 링크프라이스 제휴 링크로 변환합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.wconcept.co.kr/Product/12345678"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={testDeeplink} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "변환"
                    )}
                  </Button>
                </div>

                {/* Sample URLs */}
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">테스트 URL 예시:</p>
                  <div className="space-y-1">
                    <button 
                      onClick={() => setProductUrl("https://www.wconcept.co.kr/Product/307494735")}
                      className="block text-primary hover:underline text-left"
                    >
                      더블유컨셉: https://www.wconcept.co.kr/Product/307494735
                    </button>
                    <button 
                      onClick={() => setProductUrl("https://www.posty.kr/product/123456")}
                      className="block text-primary hover:underline text-left"
                    >
                      포스티: https://www.posty.kr/product/123456
                    </button>
                    <button 
                      onClick={() => setProductUrl("https://www.jestina.co.kr/product/view?productNo=12345")}
                      className="block text-primary hover:underline text-left"
                    >
                      제이에스티나: https://www.jestina.co.kr/product/view?productNo=12345
                    </button>
                  </div>
                </div>

                {/* Result */}
                {deeplinkResult && (
                  <div className={`p-4 rounded-lg border ${
                    deeplinkResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}>
                    {deeplinkResult.success ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">딥링크 생성 성공</span>
                          <Badge variant="secondary">{deeplinkResult.merchant_name}</Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">원본 URL:</span>
                            <p className="font-mono text-xs break-all">{deeplinkResult.original_url}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">제휴 URL:</span>
                            <p className="font-mono text-xs break-all">{deeplinkResult.affiliate_url}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={openAffiliateLink}
                          variant="outline" 
                          size="sm"
                          className="gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          새 탭에서 열기
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">
                          {deeplinkResult.error}: {deeplinkResult.message}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Merchants List Tab */}
          <TabsContent value="merchants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  등록된 머천트 목록
                </CardTitle>
                <CardDescription>
                  링크프라이스 제휴 머천트 8개
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={loadMerchants} disabled={merchantsLoading}>
                  {merchantsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  머천트 목록 새로고침
                </Button>

                {merchants.length > 0 && (
                  <div className="grid gap-3">
                    {merchants.map((merchant) => (
                      <div 
                        key={merchant.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={merchant.is_active ? "default" : "secondary"}>
                            {merchant.id}
                          </Badge>
                          <div>
                            <p className="font-medium">{merchant.name_ko}</p>
                            <p className="text-sm text-muted-foreground">{merchant.base_url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <div className="text-sm">
                            <Badge variant="outline">{merchant.commission_rate}%</Badge>
                            <Badge variant="secondary" className="ml-1">{merchant.scrape_type}</Badge>
                          </div>
                          {merchant.last_collected_at && (
                            <span className="text-xs text-muted-foreground">
                              최근 수집: {new Date(merchant.last_collected_at).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collect Products Tab */}
          <TabsContent value="collect" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  상품 수집 테스트
                </CardTitle>
                <CardDescription>
                  선택한 머천트에서 상품을 수집하고 products_cache에 저장합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="머천트 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {merchants.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name_ko} ({m.scrape_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    type="number"
                    placeholder="수집 개수"
                    value={collectLimit}
                    onChange={(e) => setCollectLimit(e.target.value)}
                    className="w-[120px]"
                  />
                  
                  <Button onClick={collectProducts} disabled={isCollecting || !selectedMerchant}>
                    {isCollecting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Package className="w-4 h-4 mr-2" />
                    )}
                    수집 시작
                  </Button>
                </div>

                {/* Collection Result */}
                {collectResult && (
                  <div className={`p-4 rounded-lg border ${
                    collectResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}>
                    {collectResult.success ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">상품 수집 완료</span>
                          <Badge variant="secondary">{collectResult.merchant_id}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">수집:</span>
                            <p className="font-bold text-lg">{collectResult.collected}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">저장:</span>
                            <p className="font-bold text-lg text-green-600">{collectResult.inserted}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">업데이트:</span>
                            <p className="font-bold text-lg text-blue-600">{collectResult.updated}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">에러:</span>
                            <p className="font-bold text-lg text-red-600">{collectResult.errors}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">
                          {collectResult.error}: {collectResult.message}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Product Stats */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">저장된 상품 통계</h4>
                  <div className="text-2xl font-bold mb-2">총 {productStats.total}개</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(productStats.byMerchant).map(([merchantId, count]) => (
                      <Badge key={merchantId} variant="outline">
                        {merchantId}: {count}개
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products List Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  수집된 상품 목록
                </CardTitle>
                <CardDescription>
                  products_cache에 저장된 최근 상품 50개
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={loadCachedProducts} disabled={productsLoading}>
                  {productsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  상품 목록 불러오기
                </Button>

                {cachedProducts.length > 0 && (
                  <div className="grid gap-3 max-h-[600px] overflow-y-auto">
                    {cachedProducts.map((product) => (
                      <div 
                        key={product.id}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                      >
                        <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-muted">
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                                      <circle cx="9" cy="9" r="2"/>
                                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                    </svg>
                                  </div>
                                `;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{product.merchant_id}</Badge>
                            <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                            {!product.is_in_stock && (
                              <Badge variant="destructive" className="text-xs">품절</Badge>
                            )}
                          </div>
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.brand}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold">₩{product.price.toLocaleString()}</span>
                            {product.style_tags && product.style_tags.length > 0 && (
                              <div className="flex gap-1">
                                {product.style_tags.map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cachedProducts.length === 0 && !productsLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    아직 수집된 상품이 없습니다. Phase 2 탭에서 상품을 수집해주세요.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Phase checklist item component
interface PhaseItemProps {
  phase: number;
  title: string;
  items: { done: boolean; label: string }[];
}

const PhaseItem = ({ phase, title, items }: PhaseItemProps) => {
  const completedCount = items.filter(i => i.done).length;
  const isComplete = completedCount === items.length;
  
  return (
    <div className={`p-4 rounded-lg border ${
      isComplete 
        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
        : 'bg-muted/50'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={isComplete ? "default" : "secondary"}>Phase {phase}</Badge>
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedCount}/{items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-muted-foreground" />
            )}
            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin;
