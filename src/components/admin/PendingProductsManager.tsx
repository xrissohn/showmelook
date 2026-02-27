import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, XCircle, RefreshCw, Trash2, ExternalLink, Play, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface RawProductData {
  name: string;
  product_url: string;
  price: number;
  image_url?: string;
  category: string;
  merchant_id?: string;
  [key: string]: unknown;
}

interface PendingProduct {
  id: string;
  source: string;
  error_type: string;
  error_message: string | null;
  raw_data: RawProductData;
  created_at: string | null;
  retry_count: number | null;
}

interface Merchant {
  id: string;
  name: string;
  name_ko: string;
}

const PendingProductsManager = () => {
  const { toast } = useToast();
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMerchantFix, setSelectedMerchantFix] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [processResults, setProcessResults] = useState<{ success: number; failed: number; skipped: number; errors: string[] }>({ success: 0, failed: 0, skipped: 0, errors: [] });
  const [isBatchReprocessing, setIsBatchReprocessing] = useState(false);
  const [batchReprocessProgress, setBatchReprocessProgress] = useState({ current: 0, total: 0, success: 0, failed: 0, skipped: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load pending products (머천트 오류만, 이미지 관련 에러 제외)
      const { data: pending, error: pendingError } = await supabase
        .from('pending_products')
        .select('*')
        .is('resolved_at', null)
        .not('error_type', 'in', '("missing_image","image_download_failed")')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Load merchants
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('id, name, name_ko')
        .eq('is_active', true);

      if (merchantError) throw merchantError;

      // Cast pending data to our type
      const typedPending: PendingProduct[] = (pending || []).map(p => ({
        id: p.id,
        source: p.source,
        error_type: p.error_type,
        error_message: p.error_message,
        raw_data: p.raw_data as RawProductData,
        created_at: p.created_at,
        retry_count: p.retry_count,
      }));

      setPendingProducts(typedPending);
      setMerchants(merchantData || []);

      // Initialize merchant fix selections
      const initialFix: Record<string, string> = {};
      typedPending.forEach(p => {
        // Try to guess the correct merchant from the source
        const source = p.source?.toLowerCase() || '';
        const matched = merchantData?.find(m => 
          source.includes(m.id.toLowerCase()) || 
          m.id.toLowerCase().includes(source)
        );
        initialFix[p.id] = matched?.id || '';
      });
      setSelectedMerchantFix(initialFix);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "로드 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerchantChange = (productId: string, merchantId: string) => {
    setSelectedMerchantFix(prev => ({
      ...prev,
      [productId]: merchantId
    }));
  };

  const processSelectedProducts = async (productIds: string[]) => {
    const productsToProcess = pendingProducts.filter(p => productIds.includes(p.id));
    
    if (productsToProcess.length === 0) {
      toast({
        title: "처리할 제품 없음",
        description: "머천트를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: productsToProcess.length });
    setProcessResults({ success: 0, failed: 0, skipped: 0, errors: [] });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < productsToProcess.length; i++) {
      const pending = productsToProcess[i];
      const newMerchantId = selectedMerchantFix[pending.id];
      
      if (!newMerchantId) {
        failed++;
        errors.push(`${pending.raw_data.name}: 머천트 미선택`);
        setProcessProgress({ current: i + 1, total: productsToProcess.length });
        continue;
      }

      try {
        // Update raw_data with correct merchant_id
        const updatedProduct = {
          ...pending.raw_data,
          merchant_id: newMerchantId
        };

        // Call register-product edge function (expects products array)
        const { data, error } = await supabase.functions.invoke('register-product', {
          body: { products: [updatedProduct] }
        });

        if (error) throw error;

        // Check if first result in array succeeded
        const result = data?.results?.[0];
        if (result?.success) {
          // Mark as resolved
          await supabase
            .from('pending_products')
            .update({ 
              resolved_at: new Date().toISOString(),
              resolved_by: 'admin_manual'
            })
            .eq('id', pending.id);
          
          success++;
        } else {
          failed++;
          errors.push(`${pending.raw_data.name}: ${result?.error || data?.error || '등록 실패'}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed++;
        errors.push(`${pending.raw_data.name}: ${errorMessage}`);
      }

      setProcessProgress({ current: i + 1, total: productsToProcess.length });
      setProcessResults({ success, failed, skipped: 0, errors });
    }

    setIsProcessing(false);
    
    toast({
      title: "처리 완료",
      description: `성공: ${success}개, 실패: ${failed}개`,
      variant: failed > 0 ? "destructive" : "default",
    });

    // Reload list
    if (success > 0) {
      loadData();
    }
  };

  const deleteResolved = async () => {
    try {
      const { error } = await supabase
        .from('pending_products')
        .delete()
        .not('resolved_at', 'is', null);

      if (error) throw error;

      toast({
        title: "삭제 완료",
        description: "해결된 대기열 항목이 삭제되었습니다.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "삭제 실패",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const deletePendingItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pending_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPendingProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "삭제됨" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "삭제 실패",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // URL에서 merchant_id 추론
  const inferMerchantFromUrl = (url: string): string | null => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('wconcept')) return 'wconcept';
    if (urlLower.includes('hfashionmall')) return 'hfashion';
    if (urlLower.includes('paulsmith')) return 'paulsmith';
    if (urlLower.includes('stories')) return 'stories';
    if (urlLower.includes('posty')) return 'posty';
    if (urlLower.includes('benettonmall')) return 'benetton1';
    if (urlLower.includes('stockx')) return 'stockx';
    if (urlLower.includes('arket')) return 'arket';
    if (urlLower.includes('jestina') || urlLower.includes('j-estina')) return 'jestina';
    if (urlLower.includes('29cm')) return '29cm';
    if (urlLower.includes('musinsa')) return 'musinsa';
    if (urlLower.includes('lfmall')) return 'lfmall';
    if (urlLower.includes('ssfshop')) return 'ssfshop';
    if (urlLower.includes('sivillage')) return 'sivillage';
    return null;
  };

  // 배치 실패(both_failed) 일괄 재처리
  const batchReprocessAll = async () => {
    setIsBatchReprocessing(true);
    setBatchReprocessProgress({ current: 0, total: 0, success: 0, failed: 0, skipped: 0 });

    try {
      // 모든 both_failed 항목 가져오기 (1000개 단위)
      let allPending: PendingProduct[] = [];
      let offset = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('pending_products')
          .select('*')
          .is('resolved_at', null)
          .eq('error_type', 'both_failed')
          .range(offset, offset + pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        const typed = data.map(p => ({
          id: p.id,
          source: p.source,
          error_type: p.error_type,
          error_message: p.error_message,
          raw_data: p.raw_data as RawProductData,
          created_at: p.created_at,
          retry_count: p.retry_count,
        }));
        allPending = [...allPending, ...typed];
        offset += pageSize;
        if (data.length < pageSize) break;
      }

      const total = allPending.length;
      setBatchReprocessProgress(prev => ({ ...prev, total }));

      if (total === 0) {
        toast({ title: "재처리할 항목 없음", description: "both_failed 대기열이 비어 있습니다." });
        setIsBatchReprocessing(false);
        return;
      }

      let success = 0;
      let failed = 0;
      let skipped = 0;
      const BATCH_SIZE = 10;

      for (let i = 0; i < allPending.length; i += BATCH_SIZE) {
        const batch = allPending.slice(i, i + BATCH_SIZE);
        const productsToRegister = [];
        const pendingIds: string[] = [];
        const skippedIds: string[] = [];

        for (const p of batch) {
          const url = p.raw_data.product_url || '';
          const currentMerchant = p.raw_data.merchant_id || '';
          const inferredMerchant = inferMerchantFromUrl(url);
          
          // merchant_id가 unknown이거나 없으면 URL에서 추론
          const finalMerchant = (currentMerchant === 'unknown' || !currentMerchant) 
            ? inferredMerchant 
            : currentMerchant;
          
          if (!finalMerchant) {
            skipped++;
            skippedIds.push(p.id);
            continue;
          }

          productsToRegister.push({
            ...p.raw_data,
            merchant_id: finalMerchant,
          });
          pendingIds.push(p.id);
        }

        if (productsToRegister.length > 0) {
          try {
            const { data, error } = await supabase.functions.invoke('register-product', {
              body: { products: productsToRegister },
            });

            if (error) throw error;

            if (data?.results) {
              for (let j = 0; j < data.results.length; j++) {
                const r = data.results[j];
                if (r.success || r.duplicate) {
                  success++;
                  // 중복이면 아예 삭제, 성공이면 resolved 마킹
                  if (r.duplicate) {
                    await supabase
                      .from('pending_products')
                      .delete()
                      .eq('id', pendingIds[j]);
                  } else {
                    await supabase
                      .from('pending_products')
                      .update({ resolved_at: new Date().toISOString(), resolved_by: 'batch_reprocess' })
                      .eq('id', pendingIds[j]);
                  }
                } else {
                  failed++;
                }
              }
            } else {
              failed += productsToRegister.length;
            }
          } catch {
            failed += productsToRegister.length;
          }
        }

        setBatchReprocessProgress({ current: Math.min(i + BATCH_SIZE, total), total, success, failed, skipped });

        // Rate limit
        if (i + BATCH_SIZE < allPending.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      toast({
        title: "배치 재처리 완료",
        description: `성공: ${success}개, 실패: ${failed}개, 스킵: ${skipped}개`,
        variant: failed > success ? "destructive" : "default",
      });

      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "배치 재처리 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsBatchReprocessing(false);
    }
  };

  // Group by source
  const groupedProducts = pendingProducts.reduce((acc, product) => {
    const source = product.source || 'unknown';
    if (!acc[source]) acc[source] = [];
    acc[source].push(product);
    return acc;
  }, {} as Record<string, PendingProduct[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          등록 대기 제품 관리
        </CardTitle>
        <CardDescription>
          머천트 ID 오류로 대기 중인 제품들입니다. 머천트를 수정 후 재등록하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats & Actions */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="destructive">{pendingProducts.length}</Badge>
            <span className="font-medium">대기 중인 제품</span>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={deleteResolved}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              해결된 항목 삭제
            </Button>
          </div>
        </div>

        {/* Batch Reprocess both_failed */}
        <div className="p-4 border-2 border-orange-500/30 rounded-lg space-y-3 bg-orange-500/5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                배치 실패(both_failed) 일괄 재처리
              </h4>
              <p className="text-sm text-muted-foreground">
                URL에서 올바른 머천트를 자동 추론하여 register-product로 재등록합니다.
              </p>
            </div>
            <Button 
              onClick={batchReprocessAll} 
              disabled={isBatchReprocessing || isProcessing}
              variant="default"
            >
              {isBatchReprocessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              전체 재처리 시작
            </Button>
          </div>

          {isBatchReprocessing && batchReprocessProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>재처리 중...</span>
                <span>{batchReprocessProgress.current} / {batchReprocessProgress.total}</span>
              </div>
              <Progress value={(batchReprocessProgress.current / batchReprocessProgress.total) * 100} />
              <div className="flex gap-4 text-sm">
                <span className="text-primary">✅ 성공: {batchReprocessProgress.success}</span>
                <span className="text-destructive">❌ 실패: {batchReprocessProgress.failed}</span>
                <span className="text-muted-foreground">⏭️ 스킵: {batchReprocessProgress.skipped}</span>
              </div>
            </div>
          )}

          {!isBatchReprocessing && batchReprocessProgress.total > 0 && batchReprocessProgress.current === batchReprocessProgress.total && (
            <div className="p-3 bg-card rounded-lg text-sm">
              <p className="font-medium">재처리 완료!</p>
              <p>성공: {batchReprocessProgress.success}개 / 실패: {batchReprocessProgress.failed}개 / 스킵(머천트 불명): {batchReprocessProgress.skipped}개</p>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="p-4 border rounded-lg space-y-2 bg-background">
            <div className="flex items-center justify-between text-sm">
              <span>처리 중...</span>
              <span>{processProgress.current} / {processProgress.total}</span>
            </div>
            <Progress value={(processProgress.current / processProgress.total) * 100} />
            <div className="flex gap-4 text-sm">
              <span className="text-primary">성공: {processResults.success}</span>
              <span className="text-destructive">실패: {processResults.failed}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {processResults.errors.length > 0 && !isProcessing && (
          <div className="p-4 border border-destructive/20 rounded-lg space-y-2 max-h-[150px] overflow-y-auto bg-destructive/5">
            <p className="font-medium text-sm text-destructive">실패 목록:</p>
            {processResults.errors.map((err, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-destructive">
                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {/* Products by Source */}
        {!isLoading && Object.entries(groupedProducts).map(([source, sourceProducts]) => (
          <div key={source} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">{source}</Badge>
              <span className="text-sm text-muted-foreground">{sourceProducts.length}개</span>
              
              {/* Bulk action for this source */}
              <div className="ml-auto flex items-center gap-2">
                <Select 
                  onValueChange={(value) => {
                    const updates: Record<string, string> = {};
                    sourceProducts.forEach(p => {
                      updates[p.id] = value;
                    });
                    setSelectedMerchantFix(prev => ({ ...prev, ...updates }));
                  }}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="머천트 일괄 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name_ko} ({m.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => {
                    const ids = sourceProducts.map(p => p.id);
                    processSelectedProducts(ids);
                  }}
                  disabled={isProcessing || !sourceProducts.some(p => selectedMerchantFix[p.id])}
                >
                  <Play className="w-4 h-4 mr-1" />
                  {sourceProducts.length}개 일괄 등록
                </Button>
              </div>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">상품명</TableHead>
                    <TableHead className="w-[100px]">에러 타입</TableHead>
                    <TableHead className="w-[150px]">머천트 수정</TableHead>
                    <TableHead className="w-[100px]">가격</TableHead>
                    <TableHead className="w-[120px]">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceProducts.slice(0, 20).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[230px]" title={product.raw_data.name}>
                          {product.raw_data.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[230px]">
                          {product.error_message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.error_type === 'invalid_merchant' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {product.error_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={selectedMerchantFix[product.id] || ''} 
                          onValueChange={(value) => handleMerchantChange(product.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="머천트 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {merchants.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name_ko} ({m.id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">
                        ₩{product.raw_data.price?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(product.raw_data.product_url, '_blank')}
                            title="상품 페이지 열기"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePendingItem(product.id)}
                            className="text-destructive hover:text-destructive"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sourceProducts.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-2">
                        ... 외 {sourceProducts.length - 20}개 더 있음
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}

        {!isLoading && pendingProducts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-primary" />
            <p>대기 중인 제품이 없습니다!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingProductsManager;
