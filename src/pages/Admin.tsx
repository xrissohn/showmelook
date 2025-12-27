import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, ExternalLink, Link2, Loader2, Database, ShoppingBag } from "lucide-react";
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

  const openAffiliateLink = () => {
    if (deeplinkResult?.affiliate_url) {
      window.open(deeplinkResult.affiliate_url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
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
                  { done: false, label: "collect-products Edge Function" },
                  { done: false, label: "스타일 태그 자동 분류" },
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deeplink">Phase 1: 딥링크</TabsTrigger>
            <TabsTrigger value="merchants">머천트 목록</TabsTrigger>
            <TabsTrigger value="products" disabled>Phase 2: 상품 수집</TabsTrigger>
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
                      onClick={() => setProductUrl("https://www.wconcept.co.kr/Product/12345678")}
                      className="block text-primary hover:underline"
                    >
                      더블유컨셉: https://www.wconcept.co.kr/Product/12345678
                    </button>
                    <button 
                      onClick={() => setProductUrl("https://www.posty.kr/product/123456")}
                      className="block text-primary hover:underline"
                    >
                      포스티: https://www.posty.kr/product/123456
                    </button>
                    <button 
                      onClick={() => setProductUrl("https://www.jestina.co.kr/product/view?productNo=12345")}
                      className="block text-primary hover:underline"
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
                  ) : null}
                  머천트 목록 불러오기
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{merchant.commission_rate}%</Badge>
                          <Badge variant="secondary">{merchant.scrape_type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab (Disabled for now) */}
          <TabsContent value="products">
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Phase 2에서 구현 예정
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
