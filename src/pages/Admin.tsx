import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, ExternalLink, Link2, Loader2, Database, ShoppingBag, Package, RefreshCw } from "lucide-react";
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

  // Load merchants on mount
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
                  { done: true, label: "스타일 태그 자동 분류" },
                  { done: false, label: "CRON 스케줄 설정" },
                ]}
              />
              <PhaseItem 
                phase={3} 
                title="규칙 기반 추천" 
                items={[
                  { done: false, label: "style_v1 Edge Function" },
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
        <Tabs defaultValue="deeplink" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="deeplink">Phase 1: 딥링크</TabsTrigger>
            <TabsTrigger value="merchants">머천트 목록</TabsTrigger>
            <TabsTrigger value="collect">Phase 2: 상품 수집</TabsTrigger>
            <TabsTrigger value="products">수집된 상품</TabsTrigger>
          </TabsList>

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
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-16 h-20 object-cover rounded"
                          />
                        )}
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
