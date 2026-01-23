import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, XCircle, ExternalLink, Link2, Loader2, Database, ShoppingBag, 
  Package, RefreshCw, RotateCcw, Zap, Dna, Trash2, ImageOff, Upload, 
  AlertTriangle, FileSpreadsheet, Eye, RotateCw, Users, AlertCircle, Activity, 
  Clock, Play, CheckCircle, XOctagon, BarChart3, Gauge, CloudDownload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Checkbox } from "@/components/ui/checkbox";
import MissingImagesManager from "@/components/admin/MissingImagesManager";
import { UserManagementPanel } from "@/components/admin/UserManagementPanel";
import { ThroughputAnalytics } from "@/components/admin/ThroughputAnalytics";
import { TokenBucketMonitor } from "@/components/admin/TokenBucketMonitor";
import { LoadTestPanel } from "@/components/admin/LoadTestPanel";
import { BrightDataFetchPanel } from "@/components/admin/BrightDataFetchPanel";
import * as XLSX from 'xlsx';

interface DeeplinkResult {
  success?: boolean;
  merchant_id?: string;
  merchant_name?: string;
  original_url?: string;
  affiliate_url?: string;
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
  is_active: boolean;
  collected_at: string;
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
  apiCalls?: { gemini: number; serpapi: number };
  stats?: { requestedItems: number; foundInCache: number; foundViaSerpapi: number; notFound: number };
  error?: string;
}

interface PendingProduct {
  id: string;
  source: string;
  raw_data: unknown;
  error_type: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  resolved_at: string | null;
}

interface ExcelProduct {
  merchant_id: string;
  product_url: string;
  name: string;
  price: number;
  image_url?: string;
  original_price?: number;
  category?: string;
  brand?: string;
  gender?: string;
  color?: string;
}

interface ErrorLog {
  id: string;
  function_name: string;
  error_code: string | null;
  error_message: string | null;
  user_id: string | null;
  request_payload: unknown;
  execution_time_ms: number | null;
  created_at: string;
}

interface GenerationJob {
  id: string;
  user_id: string;
  status: string;
  progress: number;
  priority: number;
  request_payload: unknown;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useAdminRole(user?.id);
  
  // Deeplink test state
  const [productUrl, setProductUrl] = useState("");
  const [deeplinkResult, setDeeplinkResult] = useState<DeeplinkResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Products list state
  const [cachedProducts, setCachedProducts] = useState<CachedProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productStats, setProductStats] = useState<{ total: number; byMerchant: Record<string, number> }>({ total: 0, byMerchant: {} });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isDeletingProducts, setIsDeletingProducts] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Style-recommend (AI) test state
  const [aiUserRequest, setAiUserRequest] = useState("");
  const [aiGender, setAiGender] = useState("여성");
  const [aiForceRefresh, setAiForceRefresh] = useState(false);
  const [aiResult, setAiResult] = useState<StyleRecommendResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // DNA management state
  const [dnaStats, setDnaStats] = useState<{
    total: number;
    withDna: number;
    withoutDna: number;
    byTarget: Record<string, number>;
    bySlot: Record<string, number>;
    byConcept: Record<string, number>;
  } | null>(null);
  const [isDnaLoading, setIsDnaLoading] = useState(false);
  const [dnaBatchResult, setDnaBatchResult] = useState<{
    success: boolean;
    processed?: number;
    updated?: number;
    remaining?: number;
    errors?: number;
    timeMs?: number;
    error?: string;
  } | null>(null);
  const [dnaBatchSize, setDnaBatchSize] = useState("50");

  // Feedback stats state (v4.0)
  const [feedbackStats, setFeedbackStats] = useState<{
    totalProducts: number;
    withFeedback: number;
    topLiked: Array<{ id: string; name: string; score: number; likeCount: number }>;
    topDisliked: Array<{ id: string; name: string; score: number; dislikeCount: number }>;
    styleWeights: Record<string, { positive: number; negative: number }>;
  } | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  // Pending products state
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Excel upload state
  const [excelProducts, setExcelProducts] = useState<ExcelProduct[]>([]);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [excelUploadResult, setExcelUploadResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Error logs state
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [errorLogStats, setErrorLogStats] = useState<{
    total: number;
    byFunction: Record<string, number>;
    byCode: Record<string, number>;
  }>({ total: 0, byFunction: {}, byCode: {} });

  // Generation jobs state
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobStats, setJobStats] = useState<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  }>({ queued: 0, processing: 0, completed: 0, failed: 0 });

  // Queue monitoring state (Phase 3)
  const [queueMonitor, setQueueMonitor] = useState<{
    totalQueued: number;
    totalProcessing: number;
    queueByPriority: Record<number, number>;
    recentThroughput: number;
    estimatedWaitByTier: Record<string, number>;
  } | null>(null);
  const [isMonitorLoading, setIsMonitorLoading] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  useEffect(() => {
    loadDnaStats();
    loadProductStats();
    loadPendingCount();
    loadErrorLogStats();
    loadJobStats();
    loadFeedbackStats();
  }, []);

  // Auto-refresh queue monitoring every 10 seconds
  useEffect(() => {
    if (!isAutoRefresh) return;

    // Initial load
    loadQueueMonitor();
    loadJobStats();

    const interval = setInterval(() => {
      loadQueueMonitor();
      loadJobStats();
    }, 10000); // 10초마다

    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // Error logs functions
  const loadErrorLogStats = async () => {
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('function_name, error_code')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      
      const byFunction: Record<string, number> = {};
      const byCode: Record<string, number> = {};
      
      data?.forEach(log => {
        byFunction[log.function_name] = (byFunction[log.function_name] || 0) + 1;
        const code = log.error_code || 'UNKNOWN';
        byCode[code] = (byCode[code] || 0) + 1;
      });
      
      setErrorLogStats({ total: data?.length || 0, byFunction, byCode });
    } catch (error) {
      console.error('Error loading error log stats:', error);
    }
  };

  const loadErrorLogs = async () => {
    setErrorLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setErrorLogs(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "에러 로그 로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setErrorLogsLoading(false);
    }
  };

  const clearOldErrorLogs = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('error_logs').delete().lt('created_at', thirtyDaysAgo);
      toast({ title: "정리 완료", description: "30일 이전 에러 로그가 삭제되었습니다." });
      loadErrorLogStats();
      loadErrorLogs();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "정리 실패", description: errorMessage, variant: "destructive" });
    }
  };

  // Generation jobs functions
  const loadJobStats = async () => {
    try {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const stats = { queued: 0, processing: 0, completed: 0, failed: 0 };
      data?.forEach(job => {
        if (job.status === 'queued') stats.queued++;
        else if (['processing', 'generating_style', 'generating_image'].includes(job.status)) stats.processing++;
        else if (job.status === 'completed') stats.completed++;
        else if (job.status === 'failed') stats.failed++;
      });
      
      setJobStats(stats);
    } catch (error) {
      console.error('Error loading job stats:', error);
    }
  };

  // Queue monitoring (Phase 3)
  const loadQueueMonitor = async () => {
    setIsMonitorLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('queue-status', {
        body: {},
      });

      if (!error && data?.success) {
        setQueueMonitor({
          totalQueued: data.totalQueued,
          totalProcessing: data.totalProcessing,
          queueByPriority: data.queueByPriority || {},
          recentThroughput: data.recentThroughput,
          estimatedWaitByTier: data.estimatedWaitByTier || {},
        });
      }
    } catch (error) {
      console.error('Error loading queue monitor:', error);
    } finally {
      setIsMonitorLoading(false);
    }
  };

  const loadGenerationJobs = async () => {
    setJobsLoading(true);
    try {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setGenerationJobs(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "작업 목록 로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setJobsLoading(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: 'Cancelled by admin' })
        .eq('id', jobId);
      
      toast({ title: "작업 취소됨", description: "작업이 취소되었습니다." });
      loadGenerationJobs();
      loadJobStats();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "취소 실패", description: errorMessage, variant: "destructive" });
    }
  };

  const loadPendingCount = async () => {
    try {
      const { count } = await supabase
        .from('pending_products')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null);
      setPendingCount(count || 0);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const loadPendingProducts = async () => {
    setPendingLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_products')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setPendingProducts(data || []);
      setPendingCount(data?.length || 0);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setPendingLoading(false);
    }
  };

  const retryPendingProduct = async (pending: PendingProduct) => {
    try {
      const { data, error } = await supabase.functions.invoke('register-product', {
        body: { products: [pending.raw_data] },
      });

      if (error) throw error;

      if (data.success && data.results?.[0]?.success) {
        // 성공 시 pending에서 제거
        await supabase
          .from('pending_products')
          .update({ resolved_at: new Date().toISOString(), resolved_by: 'auto_retry' })
          .eq('id', pending.id);
        
        toast({ title: "등록 성공", description: "제품이 성공적으로 등록되었습니다." });
        loadPendingProducts();
      } else {
        // 실패 시 retry_count 증가
        await supabase
          .from('pending_products')
          .update({ 
            retry_count: pending.retry_count + 1,
            error_message: data.results?.[0]?.error || data.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', pending.id);
        
        toast({ title: "등록 실패", description: data.results?.[0]?.error || data.error, variant: "destructive" });
        loadPendingProducts();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "재시도 실패", description: errorMessage, variant: "destructive" });
    }
  };

  const deletePendingProduct = async (id: string) => {
    try {
      await supabase
        .from('pending_products')
        .update({ resolved_at: new Date().toISOString(), resolved_by: 'deleted' })
        .eq('id', id);
      
      toast({ title: "삭제됨", description: "등록 대기 항목이 삭제되었습니다." });
      loadPendingProducts();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "삭제 실패", description: errorMessage, variant: "destructive" });
    }
  };

  const handleExcelUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setExcelUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

        // 컬럼 매핑
        const products: ExcelProduct[] = jsonData.map((row) => ({
          merchant_id: String(row['merchant_id'] || row['머천트'] || row['Merchant'] || 'unknown'),
          product_url: String(row['product_url'] || row['URL'] || row['url'] || row['상품URL'] || ''),
          name: String(row['name'] || row['상품명'] || row['Name'] || row['title'] || ''),
          price: Number(row['price'] || row['가격'] || row['Price'] || 0),
          image_url: row['image_url'] || row['이미지'] || row['Image'] ? String(row['image_url'] || row['이미지'] || row['Image']) : undefined,
          original_price: row['original_price'] || row['원가'] ? Number(row['original_price'] || row['원가']) : undefined,
          category: row['category'] || row['카테고리'] ? String(row['category'] || row['카테고리']) : undefined,
          brand: row['brand'] || row['브랜드'] ? String(row['brand'] || row['브랜드']) : undefined,
          gender: row['gender'] || row['성별'] ? String(row['gender'] || row['성별']) : undefined,
          color: row['color'] || row['색상'] ? String(row['color'] || row['색상']) : undefined,
        })).filter(p => p.product_url && p.name && p.price > 0);

        setExcelProducts(products);
        toast({ title: "파일 파싱 완료", description: `${products.length}개 제품 발견` });
      } catch (error) {
        toast({ title: "파일 파싱 실패", description: "올바른 엑셀 파일인지 확인해주세요.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const registerExcelProducts = async () => {
    if (excelProducts.length === 0) return;

    setIsExcelUploading(true);
    setExcelUploadResult(null);

    const BATCH_SIZE = 10;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < excelProducts.length; i += BATCH_SIZE) {
      const batch = excelProducts.slice(i, i + BATCH_SIZE);
      
      try {
        const { data, error } = await supabase.functions.invoke('register-product', {
          body: { products: batch },
        });

        if (error) throw error;

        if (data.success && data.results) {
          for (const r of data.results) {
            if (r.success) {
              success++;
            } else {
              failed++;
              errors.push(`${r.product_url?.slice(0, 50)}...: ${r.error}`);
            }
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed += batch.length;
        errors.push(`배치 오류: ${errorMessage}`);
      }
    }

    setExcelUploadResult({ success, failed, errors: errors.slice(0, 10) });
    setIsExcelUploading(false);
    
    if (success > 0) {
      toast({ title: "등록 완료", description: `${success}개 성공, ${failed}개 실패` });
      loadProductStats();
      loadDnaStats();
      loadPendingCount();
    }
  };

  const testDeeplink = async () => {
    if (!productUrl.trim()) {
      toast({ title: "URL 입력 필요", description: "상품 URL을 입력해주세요.", variant: "destructive" });
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
        toast({ title: "딥링크 생성 성공", description: `${data.merchant_name} 제휴 링크가 생성되었습니다.` });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setDeeplinkResult({ error: errorMessage });
      toast({ title: "딥링크 생성 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openAffiliateLink = () => {
    if (deeplinkResult?.affiliate_url) {
      window.open(deeplinkResult.affiliate_url, '_blank');
    }
  };

  const loadProductStats = async () => {
    try {
      const { count: total } = await supabase.from('products_cache').select('*', { count: 'exact', head: true });
      const { data: products } = await supabase.from('products_cache').select('merchant_id');

      const byMerchant: Record<string, number> = {};
      products?.forEach(p => {
        byMerchant[p.merchant_id || 'unknown'] = (byMerchant[p.merchant_id || 'unknown'] || 0) + 1;
      });

      setProductStats({ total: total || 0, byMerchant });
    } catch (error) {
      console.error('Error loading product stats:', error);
    }
  };

  const loadCachedProducts = async (filter: 'all' | 'active' | 'inactive' = 'active', loadAll: boolean = false) => {
    setProductsLoading(true);
    setSelectedProductIds([]);
    try {
      let query = supabase.from('products_cache')
        .select('id, merchant_id, name, brand, price, image_url, category, style_tags, is_in_stock, is_active, collected_at');
      
      if (filter === 'active') query = query.eq('is_active', true);
      else if (filter === 'inactive') query = query.eq('is_active', false);
      
      query = query.order('collected_at', { ascending: false });
      if (!loadAll) query = query.limit(100);
      
      const { data, error } = await query;
      if (error) throw error;
      setCachedProducts(data || []);
      loadProductStats();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "상품 로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setProductsLoading(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const selectAllProducts = () => setSelectedProductIds(cachedProducts.map(p => p.id));
  const deselectAllProducts = () => setSelectedProductIds([]);

  const deleteSelectedProducts = async () => {
    if (selectedProductIds.length === 0) {
      toast({ title: "선택된 상품 없음", description: "삭제할 상품을 선택해주세요.", variant: "destructive" });
      return;
    }

    if (!confirm(`${selectedProductIds.length}개 상품을 삭제하시겠습니까?`)) return;

    setIsDeletingProducts(true);
    try {
      console.log('[Admin] Deleting products:', selectedProductIds);
      
      // 각 상품을 개별적으로 삭제하여 정확한 결과 확인
      let deletedCount = 0;
      const errors: string[] = [];
      
      for (const productId of selectedProductIds) {
        const { error, count } = await supabase
          .from('products_cache')
          .delete()
          .eq('id', productId)
          .select();
        
        if (error) {
          console.error(`[Admin] Failed to delete product ${productId}:`, error);
          errors.push(`${productId}: ${error.message}`);
        } else {
          console.log(`[Admin] Deleted product ${productId}`);
          deletedCount++;
        }
      }
      
      if (errors.length > 0) {
        console.error('[Admin] Delete errors:', errors);
        toast({ 
          title: "일부 삭제 실패", 
          description: `${deletedCount}개 삭제됨, ${errors.length}개 실패. 콘솔에서 상세 확인하세요.`, 
          variant: "destructive" 
        });
      } else {
        toast({ title: "삭제 완료", description: `${deletedCount}개 상품이 삭제되었습니다.` });
      }
      
      setSelectedProductIds([]);
      loadCachedProducts(productFilter, showAllProducts);
      loadProductStats();
    } catch (error: unknown) {
      console.error('[Admin] Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "삭제 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsDeletingProducts(false);
    }
  };

  const deactivateSelectedProducts = async () => {
    if (selectedProductIds.length === 0) {
      toast({ title: "선택된 상품 없음", description: "비활성화할 상품을 선택해주세요.", variant: "destructive" });
      return;
    }

    setIsDeletingProducts(true);
    try {
      const { error } = await supabase.from('products_cache')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', selectedProductIds);
      
      if (error) throw error;
      
      toast({ title: "비활성화 완료", description: `${selectedProductIds.length}개 상품이 비활성화되었습니다.` });
      setSelectedProductIds([]);
      loadCachedProducts(productFilter, showAllProducts);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "비활성화 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsDeletingProducts(false);
    }
  };

  const testStyleRecommend = async () => {
    if (!aiUserRequest.trim()) {
      toast({ title: "요청 입력 필요", description: "스타일 요청을 입력해주세요.", variant: "destructive" });
      return;
    }

    setIsAiLoading(true);
    setAiResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: { userRequest: aiUserRequest, gender: aiGender, forceRefresh: aiForceRefresh },
      });

      if (error) throw error;
      setAiResult(data);
      
      if (data.success) {
        const cacheMsg = data.cacheHit ? '캐시 히트!' : `API: Gemini ${data.apiCalls?.gemini || 0}`;
        toast({ title: "AI 추천 완료", description: `${data.look?.items?.filter((i: { product: unknown }) => i.product)?.length || 0}개 아이템 추천 (${cacheMsg})` });
      } else {
        toast({ title: "AI 추천 실패", description: data.error, variant: "destructive" });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAiResult({ success: false, cacheHit: false, error: errorMessage });
      toast({ title: "AI 추천 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const loadDnaStats = async () => {
    try {
      const { data: products } = await supabase
        .from('products_cache')
        .select('id, dna_meta, category')
        .eq('is_active', true);

      if (!products) return;

      const total = products.length;
      const withDna = products.filter(p => p.dna_meta).length;
      const withoutDna = total - withDna;

      const byTarget: Record<string, number> = {};
      const bySlot: Record<string, number> = {};
      const byConcept: Record<string, number> = {};
      products.forEach(p => {
        if (p.dna_meta) {
          const meta = p.dna_meta as { target?: string; item_slot?: string; concepts?: string[] };
          if (meta.target) byTarget[meta.target] = (byTarget[meta.target] || 0) + 1;
          if (meta.item_slot) bySlot[meta.item_slot] = (bySlot[meta.item_slot] || 0) + 1;
          if (meta.concepts) {
            meta.concepts.forEach(c => {
              byConcept[c] = (byConcept[c] || 0) + 1;
            });
          }
        }
      });

      setDnaStats({ total, withDna, withoutDna, byTarget, bySlot, byConcept });
    } catch (error) {
      console.error('Error loading DNA stats:', error);
    }
  };

  const loadFeedbackStats = async () => {
    setIsFeedbackLoading(true);
    try {
      // Load product feedback scores
      const { data: scores } = await supabase
        .from('product_feedback_scores')
        .select('*')
        .order('overall_score', { ascending: false })
        .limit(200);

      // Load product names for top items
      const topLiked: Array<{ id: string; name: string; score: number; likeCount: number }> = [];
      const topDisliked: Array<{ id: string; name: string; score: number; dislikeCount: number }> = [];
      const allStyleWeights: Record<string, { positive: number; negative: number }> = {};

      if (scores && scores.length > 0) {
        // Get product names
        const productIds = scores.slice(0, 50).map(s => s.product_id);
        const { data: products } = await supabase
          .from('products_cache')
          .select('id, name')
          .in('id', productIds);

        const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

        // Top liked (high score)
        scores
          .filter(s => s.like_count > 0)
          .sort((a, b) => b.overall_score - a.overall_score)
          .slice(0, 10)
          .forEach(s => {
            topLiked.push({
              id: s.product_id,
              name: productMap.get(s.product_id) || 'Unknown',
              score: s.overall_score,
              likeCount: s.like_count
            });
          });

        // Top disliked (high dislike count)
        scores
          .filter(s => s.dislike_count > 0)
          .sort((a, b) => b.dislike_count - a.dislike_count)
          .slice(0, 10)
          .forEach(s => {
            topDisliked.push({
              id: s.product_id,
              name: productMap.get(s.product_id) || 'Unknown',
              score: s.overall_score,
              dislikeCount: s.dislike_count
            });
          });

        // Aggregate style weights
        scores.forEach(s => {
          if (s.style_weights && typeof s.style_weights === 'object') {
            const weights = s.style_weights as Record<string, { positive?: number; negative?: number }>;
            Object.entries(weights).forEach(([style, data]) => {
              if (!allStyleWeights[style]) {
                allStyleWeights[style] = { positive: 0, negative: 0 };
              }
              allStyleWeights[style].positive += data?.positive || 0;
              allStyleWeights[style].negative += data?.negative || 0;
            });
          }
        });
      }

      setFeedbackStats({
        totalProducts: scores?.length || 0,
        withFeedback: scores?.filter(s => s.like_count > 0 || s.dislike_count > 0 || s.cart_count > 0).length || 0,
        topLiked,
        topDisliked,
        styleWeights: allStyleWeights
      });
    } catch (error) {
      console.error('Error loading feedback stats:', error);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const runDnaBatch = async () => {
    setIsDnaLoading(true);
    setDnaBatchResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('dna-batch', {
        body: { batchSize: parseInt(dnaBatchSize) || 50 },
      });

      if (error) throw error;
      setDnaBatchResult(data);
      
      if (data.success) {
        toast({ title: "DNA 2.0 생성 완료", description: `${data.updated}개 상품 처리됨, ${data.remaining}개 남음` });
        loadDnaStats();
      } else {
        toast({ title: "DNA 생성 실패", description: data.error, variant: "destructive" });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setDnaBatchResult({ success: false, error: errorMessage });
      toast({ title: "DNA 배치 오류", description: errorMessage, variant: "destructive" });
    } finally {
      setIsDnaLoading(false);
    }
  };

  const dnaPercentage = dnaStats ? Math.round((dnaStats.withDna / dnaStats.total) * 100) : 0;

  // 인증/권한 체크
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">접근 권한 없음</h1>
          <p className="text-muted-foreground">관리자만 접근할 수 있는 페이지입니다.</p>
          <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Admin 관리 페이지</h1>
          <p className="text-muted-foreground">ShowMeLook 시스템 관리 및 테스트</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{productStats.total}</div>
              <p className="text-sm text-muted-foreground">전체 상품</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{dnaStats?.withDna || 0}</div>
              <p className="text-sm text-muted-foreground">DNA 완료</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{dnaStats?.withoutDna || 0}</div>
              <p className="text-sm text-muted-foreground">DNA 미생성</p>
            </CardContent>
          </Card>
          <Card className={pendingCount > 0 ? 'border-yellow-500' : ''}>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-yellow-600' : ''}`}>
                {pendingCount}
                {pendingCount > 0 && <AlertTriangle className="w-4 h-4 inline ml-1" />}
              </div>
              <p className="text-sm text-muted-foreground">등록 대기</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{Object.keys(productStats.byMerchant).length}</div>
              <p className="text-sm text-muted-foreground">머천트</p>
            </CardContent>
          </Card>
        </div>

        {/* Test Tabs */}
        <Tabs defaultValue="register" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="register">
              <Upload className="w-4 h-4 mr-1" />
              제품 등록
            </TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              <AlertTriangle className="w-4 h-4 mr-1" />
              등록 대기
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dna">
              <Dna className="w-4 h-4 mr-1" />
              DNA 관리
            </TabsTrigger>
            <TabsTrigger value="recommend">
              <ShoppingBag className="w-4 h-4 mr-1" />
              AI 추천
            </TabsTrigger>
            <TabsTrigger value="deeplink">
              <Link2 className="w-4 h-4 mr-1" />
              딥링크
            </TabsTrigger>
            <TabsTrigger value="images">
              <ImageOff className="w-4 h-4 mr-1" />
              이미지 관리
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="w-4 h-4 mr-1" />
              상품 관리
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-1" />
              사용자 관리
            </TabsTrigger>
            <TabsTrigger value="errors" className="relative">
              <AlertCircle className="w-4 h-4 mr-1" />
              에러 로그
              {errorLogStats.total > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{errorLogStats.total}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="jobs" className="relative">
              <Activity className="w-4 h-4 mr-1" />
              생성 큐
              {(jobStats.queued + jobStats.processing) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">{jobStats.queued + jobStats.processing}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-1" />
              처리량 분석
            </TabsTrigger>
            <TabsTrigger value="ratelimit">
              <Gauge className="w-4 h-4 mr-1" />
              Rate Limiter
            </TabsTrigger>
            <TabsTrigger value="loadtest">
              <Zap className="w-4 h-4 mr-1" />
              부하 테스트
            </TabsTrigger>
            <TabsTrigger value="brightdata">
              <CloudDownload className="w-4 h-4 mr-1" />
              Bright Data
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Zap className="w-4 h-4 mr-1" />
              관리도구
            </TabsTrigger>
          </TabsList>

          {/* Product Registration Tab */}
          <TabsContent value="register" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  엑셀 제품 일괄 등록
                </CardTitle>
                <CardDescription>
                  xlsx/xls 파일을 업로드하여 제품을 일괄 등록합니다. 이미지 저장 + DNA 생성이 자동으로 수행됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Column guide */}
                <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
                  <p className="font-medium">📋 필수 컬럼</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Badge variant="outline">merchant_id / 머천트</Badge>
                    <Badge variant="outline">product_url / URL</Badge>
                    <Badge variant="outline">name / 상품명</Badge>
                    <Badge variant="outline">price / 가격</Badge>
                  </div>
                  <p className="font-medium mt-3">📎 선택 컬럼</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Badge variant="secondary">image_url / 이미지</Badge>
                    <Badge variant="secondary">original_price / 원가</Badge>
                    <Badge variant="secondary">category / 카테고리</Badge>
                    <Badge variant="secondary">brand / 브랜드</Badge>
                    <Badge variant="secondary">gender / 성별</Badge>
                    <Badge variant="secondary">color / 색상</Badge>
                  </div>
                </div>

                {/* File upload */}
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="max-w-xs"
                  />
                  {excelFileName && (
                    <span className="text-sm text-muted-foreground">
                      📁 {excelFileName} ({excelProducts.length}개 제품)
                    </span>
                  )}
                </div>

                {/* Preview */}
                {excelProducts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        미리보기 (상위 5개)
                      </h4>
                      <Button 
                        onClick={registerExcelProducts} 
                        disabled={isExcelUploading}
                      >
                        {isExcelUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {excelProducts.length}개 제품 등록
                      </Button>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">머천트</th>
                              <th className="p-2 text-left">상품명</th>
                              <th className="p-2 text-right">가격</th>
                              <th className="p-2 text-left">이미지</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelProducts.slice(0, 5).map((p, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">
                                  <Badge variant="outline">{p.merchant_id}</Badge>
                                </td>
                                <td className="p-2 max-w-[200px] truncate">{p.name}</td>
                                <td className="p-2 text-right font-medium">₩{p.price.toLocaleString()}</td>
                                <td className="p-2">
                                  {p.image_url ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload result */}
                {excelUploadResult && (
                  <div className={`p-4 rounded-lg border ${
                    excelUploadResult.failed === 0 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                      : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {excelUploadResult.failed === 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      )}
                      <span className="font-medium">
                        등록 완료: {excelUploadResult.success}개 성공, {excelUploadResult.failed}개 실패
                      </span>
                    </div>
                    {excelUploadResult.errors.length > 0 && (
                      <div className="text-sm text-muted-foreground space-y-1 mt-2">
                        {excelUploadResult.errors.map((err, idx) => (
                          <p key={idx} className="text-xs">❌ {err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Products Tab */}
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  등록 대기 제품
                </CardTitle>
                <CardDescription>
                  이미지 저장 또는 DNA 생성에 실패한 제품들입니다. 재시도하거나 수동으로 보완할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button onClick={loadPendingProducts} disabled={pendingLoading} variant="outline">
                    {pendingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    새로고침
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {pendingProducts.length}개 대기 중
                  </span>
                </div>

                {pendingProducts.length > 0 ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {pendingProducts.map((pending) => {
                      const rawData = pending.raw_data as { name?: string; product_url?: string; image_url?: string };
                      return (
                        <div key={pending.id} className="p-3 border rounded-lg bg-card flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{pending.source}</Badge>
                              <Badge variant={pending.error_type === 'image_failed' ? 'secondary' : 'destructive'}>
                                {pending.error_type}
                              </Badge>
                              {pending.retry_count > 0 && (
                                <Badge variant="outline" className="text-xs">재시도 {pending.retry_count}회</Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm truncate">{rawData?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{rawData?.product_url}</p>
                            {pending.error_message && (
                              <p className="text-xs text-destructive mt-1 truncate">{pending.error_message}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => retryPendingProduct(pending)}>
                              <RotateCw className="w-4 h-4 mr-1" />
                              재시도
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deletePendingProduct(pending.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {pendingLoading ? '로딩 중...' : '등록 대기 중인 제품이 없습니다.'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DNA Management Tab */}
          <TabsContent value="dna" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dna className="w-5 h-5" />
                  DNA 4.0 + 피드백 학습 관리
                </CardTitle>
                <CardDescription>
                  상품 DNA와 유저 피드백 기반 학습 시스템을 관리합니다. (v4.0)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* DNA Coverage */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">🧬 DNA 커버리지</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={loadDnaStats}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        새로고침
                      </Button>
                      <Button variant="outline" size="sm" onClick={loadFeedbackStats} disabled={isFeedbackLoading}>
                        {isFeedbackLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <BarChart3 className="w-4 h-4 mr-1" />}
                        피드백 통계
                      </Button>
                    </div>
                  </div>
                  
                  {dnaStats && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>🧬 DNA 커버리지</span>
                          <span className={dnaPercentage === 100 ? 'text-primary font-bold' : 'text-accent-foreground'}>
                            {dnaStats.withDna} / {dnaStats.total} ({dnaPercentage}%)
                          </span>
                        </div>
                        <Progress value={dnaPercentage} className="h-3" />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        {Object.keys(dnaStats.byTarget).length > 0 && (
                          <div className="p-4 border rounded-lg space-y-2">
                            <h4 className="text-sm font-medium">👤 타겟 분포</h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(dnaStats.byTarget)
                                .sort((a, b) => b[1] - a[1])
                                .map(([target, count]) => (
                                  <Badge key={target} variant="secondary">{target}: {count}</Badge>
                                ))}
                            </div>
                          </div>
                        )}

                        {Object.keys(dnaStats.bySlot).length > 0 && (
                          <div className="p-4 border rounded-lg space-y-2">
                            <h4 className="text-sm font-medium">👕 아이템 슬롯</h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(dnaStats.bySlot)
                                .sort((a, b) => b[1] - a[1])
                                .map(([slot, count]) => (
                                  <Badge key={slot} variant="outline">{slot}: {count}</Badge>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {Object.keys(dnaStats.byConcept).length > 0 && (
                        <div className="p-4 border rounded-lg space-y-2">
                          <h4 className="text-sm font-medium">🎨 스타일 컨셉 분포</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(dnaStats.byConcept)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 15)
                              .map(([concept, count]) => (
                                <Badge key={concept} className="bg-primary/10 text-primary border-primary/20">{concept}: {count}</Badge>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Feedback Stats (v4.0) */}
                {feedbackStats && (
                  <div className="p-4 border-2 border-accent/30 rounded-lg space-y-4 bg-accent/5">
                    <h3 className="font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      피드백 학습 현황 (v4.0)
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-card rounded-lg text-center">
                        <p className="text-2xl font-bold">{feedbackStats.totalProducts}</p>
                        <p className="text-xs text-muted-foreground">피드백 스코어 수</p>
                      </div>
                      <div className="p-3 bg-card rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">{feedbackStats.withFeedback}</p>
                        <p className="text-xs text-muted-foreground">활성 피드백</p>
                      </div>
                      <div className="p-3 bg-card rounded-lg text-center">
                        <p className="text-2xl font-bold text-accent-foreground">{feedbackStats.topLiked.length}</p>
                        <p className="text-xs text-muted-foreground">인기 상품</p>
                      </div>
                      <div className="p-3 bg-card rounded-lg text-center">
                        <p className="text-2xl font-bold">{Object.keys(feedbackStats.styleWeights).length}</p>
                        <p className="text-xs text-muted-foreground">학습된 스타일</p>
                      </div>
                    </div>

                    {/* Top Liked Products */}
                    {feedbackStats.topLiked.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">👍 인기 상품 TOP 5</h4>
                        <div className="space-y-1">
                          {feedbackStats.topLiked.slice(0, 5).map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-card rounded">
                              <span className="flex items-center gap-2">
                                <span className="text-primary font-bold">{idx + 1}.</span>
                                <span className="truncate max-w-[200px]">{item.name}</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">❤️ {item.likeCount}</Badge>
                                <Badge variant="outline">점수: {item.score.toFixed(2)}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Style Weights */}
                    {Object.keys(feedbackStats.styleWeights).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">🎯 스타일별 학습 가중치</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(feedbackStats.styleWeights)
                            .sort((a, b) => (b[1].positive - b[1].negative) - (a[1].positive - a[1].negative))
                            .slice(0, 10)
                            .map(([style, data]) => (
                              <Badge 
                                key={style} 
                                variant={data.positive > data.negative ? "default" : "secondary"}
                                className="flex items-center gap-1"
                              >
                                {style}
                                <span className="text-xs opacity-75">
                                  (+{data.positive}/-{data.negative})
                                </span>
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DNA Batch Generation */}
                <div className="p-4 border-2 border-primary/20 rounded-lg space-y-4 bg-primary/5">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Dna className="w-4 h-4" />
                      DNA 배치 생성
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      규칙 기반으로 DNA 메타 정보(target, concepts, occasions 등)를 자동 생성합니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">배치 크기</label>
                      <Select value={dnaBatchSize} onValueChange={setDnaBatchSize}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20개</SelectItem>
                          <SelectItem value="50">50개</SelectItem>
                          <SelectItem value="100">100개</SelectItem>
                          <SelectItem value="200">200개</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={runDnaBatch} disabled={isDnaLoading}>
                      {isDnaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Dna className="w-4 h-4 mr-2" />}
                      🧬 DNA 생성
                    </Button>
                  </div>

                  {dnaBatchResult && (
                    <div className={`p-4 rounded-lg border ${
                      dnaBatchResult.success 
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-destructive/10 border-destructive/30'
                    }`}>
                      {dnaBatchResult.success ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                            <span className="font-medium">DNA 생성 완료</span>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div><span className="text-muted-foreground">처리:</span> <span className="font-medium">{dnaBatchResult.processed}</span></div>
                            <div><span className="text-muted-foreground">성공:</span> <span className="font-medium text-primary">{dnaBatchResult.updated}</span></div>
                            <div><span className="text-muted-foreground">에러:</span> <span className="font-medium text-destructive">{dnaBatchResult.errors || 0}</span></div>
                            <div><span className="text-muted-foreground">남음:</span> <span className="font-medium">{dnaBatchResult.remaining}</span></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-destructive" />
                          <span className="font-medium">오류: {dnaBatchResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Recommend Tab */}
          <TabsContent value="recommend" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  AI 스타일 추천 v4.0
                </CardTitle>
                <CardDescription>
                  GPT-5 스타일 추론 + DNA 기반 매칭 + 피드백 학습 시스템
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* v4.0 Features Info */}
                <div className="p-3 bg-muted/50 rounded-lg border text-sm">
                  <p className="font-medium mb-1">🚀 v4.0 피드백 학습 시스템</p>
                  <ul className="text-muted-foreground space-y-0.5 text-xs">
                    <li>• DNA 점수 (0.20) + 컨셉 매칭 (0.25) + TPO (0.15) + 패턴 (0.10)</li>
                    <li>• 피드백 점수 (±0.10): 좋아요/구매 +, 싫어요 -</li>
                    <li>• 스타일별 가중치 (±0.15): 각 스타일 컨셉에서의 인기도</li>
                    <li>• 최근 사용 패널티 (-0.25): 다양성 확보</li>
                  </ul>
                </div>

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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">성별</label>
                      <Select value={aiGender} onValueChange={setAiGender}>
                        <SelectTrigger><SelectValue placeholder="성별 선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="여성">여성</SelectItem>
                          <SelectItem value="남성">남성</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm pb-2">
                        <input type="checkbox" checked={aiForceRefresh} onChange={(e) => setAiForceRefresh(e.target.checked)} className="rounded" />
                        캐시 무시 (새로운 피드백 반영)
                      </label>
                    </div>
                  </div>
                </div>

                <Button onClick={testStyleRecommend} disabled={isAiLoading} className="w-full">
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingBag className="w-4 h-4 mr-2" />}
                  AI 추천 생성 (v4.0)
                </Button>

                {aiResult && (
                  <div className={`p-4 rounded-lg border ${
                    aiResult.success 
                      ? 'bg-accent/10 border-accent/30' 
                      : 'bg-destructive/10 border-destructive/30'
                  }`}>
                    {aiResult.success && aiResult.look ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-primary">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">{aiResult.look.name}</span>
                            {aiResult.cacheHit && <Badge variant="secondary">캐시 히트</Badge>}
                          </div>
                          <p className="text-lg font-bold">₩{aiResult.look.totalPrice.toLocaleString()}</p>
                        </div>
                        
                        {/* Stats */}
                        {aiResult.stats && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">요청: {aiResult.stats.requestedItems}</Badge>
                            <Badge variant="secondary">캐시: {aiResult.stats.foundInCache}</Badge>
                            <Badge variant="outline">API: {aiResult.stats.foundViaSerpapi}</Badge>
                            {aiResult.apiCalls && (
                              <Badge variant="default">AI 호출: Gemini {aiResult.apiCalls.gemini}</Badge>
                            )}
                          </div>
                        )}
                        
                        {aiResult.look.stylingTips && (
                          <p className="text-sm text-muted-foreground italic bg-card p-3 rounded-lg">
                            💡 {aiResult.look.stylingTips}
                          </p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {aiResult.look.items.filter(item => item.product).map((item, idx) => (
                            <div key={idx} className="border rounded-lg overflow-hidden bg-card">
                              <div className="aspect-square bg-muted relative">
                                {item.product?.image_url ? (
                                  <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground" /></div>
                                )}
                                <Badge className="absolute top-1 left-1 text-xs" variant="secondary">{item.category}</Badge>
                                <Badge className="absolute top-1 right-1 text-xs" variant="outline">{item.source}</Badge>
                              </div>
                              <div className="p-2">
                                <p className="text-xs font-medium line-clamp-2 mb-1">{item.product?.name}</p>
                                <p className="text-xs text-muted-foreground">{item.product?.brand}</p>
                                <p className="text-sm font-bold mt-1">₩{item.product?.price.toLocaleString()}</p>
                                {item.affiliateUrl && (
                                  <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={() => window.open(item.affiliateUrl!, '_blank')}>
                                    <ExternalLink className="w-3 h-3 mr-1" />구매하기
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">추천 실패: {aiResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deeplink Tab */}
          <TabsContent value="deeplink" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Link2 className="w-5 h-5" />딥링크 생성 테스트</CardTitle>
                <CardDescription>상품 URL을 입력하면 링크프라이스 제휴 딥링크를 생성합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="상품 URL 입력 (예: https://www.wconcept.co.kr/Product/...)"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && testDeeplink()}
                  />
                  <Button onClick={testDeeplink} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                </div>

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
                          <span className="font-medium">딥링크 생성 완료</span>
                          <Badge variant="secondary">{deeplinkResult.merchant_name}</Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">원본:</span> <code className="text-xs break-all">{deeplinkResult.original_url}</code></p>
                          <p><span className="text-muted-foreground">제휴:</span> <code className="text-xs break-all">{deeplinkResult.affiliate_url}</code></p>
                        </div>
                        <Button onClick={openAffiliateLink} variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />링크 열기
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">{deeplinkResult.error || deeplinkResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Missing Images Tab */}
          <TabsContent value="images" className="space-y-4">
            <MissingImagesManager />
          </TabsContent>

          {/* Products Management Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />상품 관리</CardTitle>
                <CardDescription>products_cache 상품 목록 - 상품 삭제/비활성화</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">필터:</label>
                    <Select value={productFilter} onValueChange={(v) => {
                      setProductFilter(v as 'all' | 'active' | 'inactive');
                      loadCachedProducts(v as 'all' | 'active' | 'inactive', showAllProducts);
                    }}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">활성화</SelectItem>
                        <SelectItem value="inactive">비활성화</SelectItem>
                        <SelectItem value="all">전체</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={showAllProducts} onCheckedChange={(checked) => {
                      setShowAllProducts(!!checked);
                      loadCachedProducts(productFilter, !!checked);
                    }} />
                    전체 상품 로드
                  </label>

                  <Button onClick={() => loadCachedProducts(productFilter, showAllProducts)} disabled={productsLoading} variant="outline">
                    {productsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    새로고침
                  </Button>
                </div>

                {cachedProducts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllProducts}>전체 선택</Button>
                      <Button variant="outline" size="sm" onClick={deselectAllProducts}>선택 해제</Button>
                    </div>
                    <span className="text-sm text-muted-foreground">{selectedProductIds.length}개 선택됨 / 총 {cachedProducts.length}개</span>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button variant="outline" size="sm" onClick={deactivateSelectedProducts} disabled={selectedProductIds.length === 0 || isDeletingProducts}>
                        {isDeletingProducts ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}비활성화
                      </Button>
                      <Button variant="destructive" size="sm" onClick={deleteSelectedProducts} disabled={selectedProductIds.length === 0 || isDeletingProducts}>
                        {isDeletingProducts ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}삭제
                      </Button>
                    </div>
                  </div>
                )}

                {cachedProducts.length > 0 ? (
                  <div className="grid gap-2 max-h-[600px] overflow-y-auto">
                    {cachedProducts.map((product) => (
                      <div 
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer transition-colors ${
                          selectedProductIds.includes(product.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        } ${!product.is_active ? 'opacity-60' : ''}`}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        <Checkbox checked={selectedProductIds.includes(product.id)} onCheckedChange={() => toggleProductSelection(product.id)} onClick={(e) => e.stopPropagation()} />
                        <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="w-5 h-5" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                            <Badge variant="outline" className="text-xs">{product.merchant_id}</Badge>
                            <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                            {!product.is_active && <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">비활성</Badge>}
                          </div>
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{product.brand}</span>
                            <span className="font-bold text-foreground">₩{product.price.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {productsLoading ? '로딩 중...' : '상품이 없습니다. "새로고침" 버튼을 클릭해주세요.'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" />관리 도구</CardTitle>
                <CardDescription>시스템 관리를 위한 도구들</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2"><RotateCcw className="w-4 h-4" />일일 생성 횟수 초기화</h3>
                      <p className="text-sm text-muted-foreground">오늘의 스타일 생성 횟수를 0으로 리셋합니다.</p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            toast({ title: "로그인 필요", description: "로그인 후 사용해주세요.", variant: "destructive" });
                            return;
                          }
                          
                          const today = new Date().toISOString().split('T')[0];
                          await supabase.from('daily_generation_usage')
                            .update({ generation_count: 0, updated_at: new Date().toISOString() })
                            .eq('user_id', user.id)
                            .eq('usage_date', today);
                          
                          toast({ title: "초기화 완료", description: "오늘의 생성 횟수가 0으로 초기화되었습니다." });
                        } catch (error: unknown) {
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                          toast({ title: "초기화 실패", description: errorMessage, variant: "destructive" });
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />횟수 초기화
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" />추천 캐시 정리</h3>
                      <p className="text-sm text-muted-foreground">만료된 스타일 추천 캐시를 삭제합니다.</p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          await supabase.from('style_cache').delete().lt('expires_at', new Date().toISOString());
                          toast({ title: "캐시 정리 완료", description: "만료된 캐시가 삭제되었습니다." });
                        } catch (error: unknown) {
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                          toast({ title: "캐시 정리 실패", description: errorMessage, variant: "destructive" });
                        }
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />만료 캐시 정리
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">상품 통계</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(productStats.byMerchant)
                      .sort((a, b) => b[1] - a[1])
                      .map(([merchantId, count]) => (
                        <div key={merchantId} className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium">{merchantId}</p>
                          <p className="text-2xl font-bold">{count}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-4">
            <UserManagementPanel />
          </TabsContent>

          {/* Error Logs Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  에러 로그 모니터링
                </CardTitle>
                <CardDescription>
                  Edge Function 에러를 실시간으로 모니터링합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-destructive">{errorLogStats.total}</p>
                    <p className="text-sm text-muted-foreground">총 에러</p>
                  </div>
                  {Object.entries(errorLogStats.byFunction).slice(0, 3).map(([fn, count]) => (
                    <div key={fn} className="p-4 border rounded-lg text-center">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground truncate">{fn}</p>
                    </div>
                  ))}
                </div>

                {/* Error Code Distribution */}
                {Object.keys(errorLogStats.byCode).length > 0 && (
                  <div className="p-4 border rounded-lg space-y-2">
                    <h3 className="font-medium">에러 코드별 분포</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(errorLogStats.byCode).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                        <Badge 
                          key={code} 
                          variant={code === '429' ? 'secondary' : code === '402' ? 'outline' : 'destructive'}
                        >
                          {code}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={() => { loadErrorLogs(); loadErrorLogStats(); }} disabled={errorLogsLoading}>
                    {errorLogsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    새로고침
                  </Button>
                  <Button variant="outline" onClick={clearOldErrorLogs}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    30일 이전 삭제
                  </Button>
                </div>

                {/* Error Logs Table */}
                {errorLogs.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">시간</th>
                            <th className="p-2 text-left">함수</th>
                            <th className="p-2 text-left">코드</th>
                            <th className="p-2 text-left">메시지</th>
                            <th className="p-2 text-right">실행시간</th>
                          </tr>
                        </thead>
                        <tbody>
                          {errorLogs.map(log => (
                            <tr key={log.id} className="border-t hover:bg-muted/50">
                              <td className="p-2 whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString('ko-KR', { 
                                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </td>
                              <td className="p-2">
                                <Badge variant="outline">{log.function_name}</Badge>
                              </td>
                              <td className="p-2">
                                <Badge 
                                  variant={log.error_code === '429' ? 'secondary' : 
                                           log.error_code === '402' ? 'outline' : 'destructive'}
                                >
                                  {log.error_code || 'N/A'}
                                </Badge>
                              </td>
                              <td className="p-2 max-w-xs truncate text-muted-foreground">
                                {log.error_message?.slice(0, 100) || '-'}
                              </td>
                              <td className="p-2 text-right text-muted-foreground">
                                {log.execution_time_ms ? `${log.execution_time_ms}ms` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Generation Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            {/* Phase 3: Real-time Queue Monitor */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  실시간 큐 모니터링
                  {isMonitorLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                </CardTitle>
                <CardDescription>
                  Phase 3 엔터프라이즈 스케일링: Rate Limiter + Priority Aging
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Control Buttons */}
                <div className="flex gap-2 items-center">
                  <Button onClick={loadQueueMonitor} disabled={isMonitorLoading} variant="outline">
                    {isMonitorLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    새로고침
                  </Button>
                  <Button 
                    onClick={() => setIsAutoRefresh(!isAutoRefresh)} 
                    variant={isAutoRefresh ? "default" : "outline"}
                    className={isAutoRefresh ? "animate-pulse" : ""}
                  >
                    {isAutoRefresh ? (
                      <>
                        <Activity className="w-4 h-4 mr-2 animate-spin" />
                        자동 갱신 중 (10초)
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        자동 갱신 시작
                      </>
                    )}
                  </Button>
                  {isAutoRefresh && (
                    <Badge variant="secondary" className="animate-pulse">
                      🟢 실시간
                    </Badge>
                  )}
                </div>

                {queueMonitor && (
                  <>
                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 border rounded-lg text-center bg-card">
                        <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-3xl font-bold">{queueMonitor.totalQueued}</p>
                        <p className="text-sm text-muted-foreground">전체 대기</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center bg-card">
                        <Play className="w-6 h-6 mx-auto mb-2 text-primary" />
                        <p className="text-3xl font-bold text-primary">{queueMonitor.totalProcessing}</p>
                        <p className="text-sm text-muted-foreground">처리 중</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center bg-card">
                        <Zap className="w-6 h-6 mx-auto mb-2 text-accent-foreground" />
                        <p className="text-3xl font-bold">{queueMonitor.recentThroughput.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">분당 처리량</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center bg-card">
                        <Database className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-3xl font-bold">
                          {Object.keys(queueMonitor.queueByPriority).length}
                        </p>
                        <p className="text-sm text-muted-foreground">우선순위 레벨</p>
                      </div>
                    </div>

                    {/* Priority Distribution */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg bg-card">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          우선순위별 대기 분포
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(queueMonitor.queueByPriority)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([priority, count]) => {
                              const tierLabel = priority === '1' ? 'Premium' : priority === '2' || priority === '3' ? 'Pro' : 'Free';
                              const tierColor = priority === '1' ? 'bg-yellow-500' : priority === '2' || priority === '3' ? 'bg-blue-500' : 'bg-muted-foreground';
                              const total = queueMonitor.totalQueued || 1;
                              const percentage = (count / total) * 100;
                              
                              return (
                                <div key={priority} className="flex items-center gap-2">
                                  <div className="w-24 text-sm">
                                    <Badge variant="outline" className="text-xs">
                                      P{priority} ({tierLabel})
                                    </Badge>
                                  </div>
                                  <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${tierColor} transition-all`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className="w-16 text-right text-sm font-medium">{count}개</span>
                                </div>
                              );
                            })}
                          {Object.keys(queueMonitor.queueByPriority).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">대기 중인 작업 없음</p>
                          )}
                        </div>
                      </div>

                      {/* Estimated Wait Times */}
                      <div className="p-4 border rounded-lg bg-card">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          티어별 예상 대기 시간
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2 rounded-md bg-yellow-500/10">
                            <span className="flex items-center gap-2">
                              <Badge className="bg-yellow-500 text-white">Premium</Badge>
                            </span>
                            <span className="font-bold">
                              {queueMonitor.estimatedWaitByTier.premium || 0}분
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-md bg-blue-500/10">
                            <span className="flex items-center gap-2">
                              <Badge className="bg-blue-500 text-white">Pro</Badge>
                            </span>
                            <span className="font-bold">
                              {queueMonitor.estimatedWaitByTier.pro || 0}분
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-md bg-muted">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary">Free</Badge>
                            </span>
                            <span className="font-bold">
                              {queueMonitor.estimatedWaitByTier.free || 0}분
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!queueMonitor && !isMonitorLoading && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>"모니터링 데이터 로드" 버튼을 눌러주세요</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Existing Job Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  24시간 작업 통계
                </CardTitle>
                <CardDescription>
                  최근 24시간 동안의 작업 상태별 집계
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold">{jobStats.queued}</p>
                    <p className="text-sm text-muted-foreground">대기중</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Play className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-primary">{jobStats.processing}</p>
                    <p className="text-sm text-muted-foreground">처리중</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold text-green-500">{jobStats.completed}</p>
                    <p className="text-sm text-muted-foreground">완료</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <XOctagon className="w-6 h-6 mx-auto mb-2 text-destructive" />
                    <p className="text-2xl font-bold text-destructive">{jobStats.failed}</p>
                    <p className="text-sm text-muted-foreground">실패</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={() => { loadGenerationJobs(); loadJobStats(); }} disabled={jobsLoading}>
                    {jobsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    새로고침
                  </Button>
                </div>

                {/* Jobs Table */}
                {generationJobs.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">시간</th>
                            <th className="p-2 text-left">상태</th>
                            <th className="p-2 text-left">진행률</th>
                            <th className="p-2 text-left">우선순위</th>
                            <th className="p-2 text-left">재시도</th>
                            <th className="p-2 text-left">작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generationJobs.map(job => (
                            <tr key={job.id} className="border-t hover:bg-muted/50">
                              <td className="p-2 whitespace-nowrap">
                                {new Date(job.created_at).toLocaleString('ko-KR', { 
                                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </td>
                              <td className="p-2">
                                <Badge 
                                  variant={
                                    job.status === 'completed' ? 'default' :
                                    job.status === 'failed' ? 'destructive' :
                                    ['processing', 'generating_style', 'generating_image'].includes(job.status) ? 'secondary' :
                                    'outline'
                                  }
                                >
                                  {job.status}
                                </Badge>
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <Progress value={job.progress} className="w-16 h-2" />
                                  <span className="text-xs text-muted-foreground">{job.progress}%</span>
                                </div>
                              </td>
                              <td className="p-2 text-center">
                                <Badge variant="outline">{job.priority}</Badge>
                              </td>
                              <td className="p-2 text-center">
                                {job.retry_count > 0 && (
                                  <Badge variant="secondary">{job.retry_count}회</Badge>
                                )}
                              </td>
                              <td className="p-2">
                                {['queued', 'processing', 'generating_style', 'generating_image'].includes(job.status) && (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => cancelJob(job.id)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                )}
                                {job.error_message && (
                                  <span className="text-xs text-destructive ml-2" title={job.error_message}>
                                    {job.error_message.slice(0, 20)}...
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {generationJobs.length === 0 && !jobsLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>현재 대기 중인 작업이 없습니다.</p>
                    <p className="text-sm">새로고침 버튼을 눌러 작업 목록을 확인하세요.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Throughput Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  처리량 분석 대시보드
                </CardTitle>
                <CardDescription>
                  생성 작업의 처리 시간, 성공률, 시간별 처리량을 분석합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ThroughputAnalytics />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token Bucket Rate Limiter Tab */}
          <TabsContent value="ratelimit" className="space-y-4">
            <TokenBucketMonitor />
          </TabsContent>

          {/* Load Test Tab */}
          <TabsContent value="loadtest" className="space-y-4">
            <LoadTestPanel />
          </TabsContent>

          {/* Bright Data Tab */}
          <TabsContent value="brightdata" className="space-y-4">
            <BrightDataFetchPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
