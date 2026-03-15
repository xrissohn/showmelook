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
  Clock, Play, CheckCircle, XOctagon, BarChart3, Store
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Checkbox } from "@/components/ui/checkbox";
import MissingImagesManager from "@/components/admin/MissingImagesManager";
import PendingProductsManager from "@/components/admin/PendingProductsManager";
import { ProductDetailEditor } from "@/components/admin/ProductDetailEditor";

import { UserManagementPanel } from "@/components/admin/UserManagementPanel";
import { ThroughputAnalytics } from "@/components/admin/ThroughputAnalytics";
import { InferenceMetricsPanel } from "@/components/admin/InferenceMetricsPanel";
import { Cafe24TenantManager } from "@/components/admin/Cafe24TenantManager";
import { CoupangDailyReportPanel } from "@/components/admin/CoupangDailyReportPanel";

import { parseExcelFile, findColumnValue, parsePrice as parseExcelPrice } from '@/lib/excelParser';

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
  original_price?: number | null;
  image_url: string | null;
  product_url: string;
  category: string;
  sub_category: string | null;
  gender: string | null;
  color: string | null;
  sizes: unknown;
  style_tags: string[] | null;
  is_in_stock: boolean;
  is_active: boolean;
  collected_at: string;
  dna_meta: unknown;
  dna_text: string | null;
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
  const [productStats, setProductStats] = useState<{ total: number; byMerchant: Record<string, number>; byCategory: Record<string, number> }>({ total: 0, byMerchant: {}, byCategory: {} });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isDeletingProducts, setIsDeletingProducts] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [merchantFilter, setMerchantFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availableMerchants, setAvailableMerchants] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  
  // DNA Editor state
  const [dnaEditorOpen, setDnaEditorOpen] = useState(false);
  const [dnaEditorProduct, setDnaEditorProduct] = useState<CachedProduct | null>(null);
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
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [pendingOtherCount, setPendingOtherCount] = useState(0);
  // Excel upload state
  const [excelProducts, setExcelProducts] = useState<ExcelProduct[]>([]);
  const [excelFileNames, setExcelFileNames] = useState<string[]>([]);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [excelUploadProgress, setExcelUploadProgress] = useState<{
    current: number;
    total: number;
    currentFile?: string;
    startTime?: number;
  } | null>(null);
  const [excelUploadResult, setExcelUploadResult] = useState<{
    success: number;
    failed: number;
    skipped?: number;
    pending?: number;
    imageFailed?: number;
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

  // Realtime: products_cache 변경 시 자동으로 통계 갱신
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('admin-products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products_cache' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            loadProductStats();
            loadDnaStats();
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
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
      // 이미지 관련 에러 카운트 (missing_image, image_download_failed)
      const { count: imageCount } = await supabase
        .from('pending_products')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null)
        .in('error_type', ['missing_image', 'image_download_failed']);
      
      // 기타 에러 카운트 (머천트 오류 등, 이미지 관련 제외)
      const { count: otherCount } = await supabase
        .from('pending_products')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null)
        .not('error_type', 'in', '("missing_image","image_download_failed")');
      
      setPendingImageCount(imageCount || 0);
      setPendingOtherCount(otherCount || 0);
      setPendingCount((imageCount || 0) + (otherCount || 0));
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

  const handleDownloadProductTemplate = () => {
    try {
      const csvContent = `\uFEFFname,product_url,price,category,merchant_id,image_url,brand,original_price,gender,color,sub_category,style_tags,sizes,external_id\n"나이키 에어포스 1 '07","https://www.musinsa.com/app/goods/example1",139000,"신발","musinsa","https://image.musinsa.com/example1.jpg","Nike",159000,"unisex","white","스니커즈","캐주얼,스트릿","250,260,270,280","NIKE-AF1-07"`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "product-upload-template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
      toast({ title: "다운로드 시작", description: "엑셀 템플릿 저장 창이 열렸습니다." });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "다운로드 실패", description: errorMessage, variant: "destructive" });
    }
  };

  const handleExcelUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setExcelUploadResult(null);
    setExcelProducts([]);
    
    const fileNames: string[] = [];
    const allProducts: ExcelProduct[] = [];

    // 가격 파싱 (콤마, 원화 기호 제거, JSON 형식 지원)
    const parsePrice = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // JSON 형식 가격 처리 ({"value":65000,"currency":"KRW"})
        if (value.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(value);
            if (parsed.value) return Number(parsed.value);
          } catch {
            // JSON 파싱 실패시 일반 파싱 진행
          }
        }
        const cleaned = value.replace(/[^\d.]/g, '');
        return parseFloat(cleaned) || 0;
      }
      return 0;
    };

    // URL에서 merchant_id 추론
    const inferMerchantId = (url: string): string => {
      const urlLower = url.toLowerCase();
      if (urlLower.includes('wconcept')) return 'wconcept';
      if (urlLower.includes('hfashionmall') || urlLower.includes('hfashion')) return 'hfashion';
      if (urlLower.includes('paulsmith')) return 'paulsmith';
      if (urlLower.includes('ssfshop')) return 'ssfshop';
      if (urlLower.includes('sivillage')) return 'sivillage';
      if (urlLower.includes('29cm')) return '29cm';
      if (urlLower.includes('musinsa')) return 'musinsa';
      if (urlLower.includes('stories') || urlLower.includes('otherstories')) return 'stories';
      if (urlLower.includes('posty')) return 'posty';
      if (urlLower.includes('lfmall')) return 'lfmall';
      if (urlLower.includes('arket')) return 'arket';
      if (urlLower.includes('jestina') || urlLower.includes('j.estina')) return 'jestina';
      if (urlLower.includes('benetton')) return 'benetton1';
      if (urlLower.includes('coupang')) return 'coupang';
      if (urlLower.includes('stockx')) return 'stockx';
      return 'unknown';
    };

    // 각 파일 처리 (async)
    for (const file of Array.from(files)) {
      fileNames.push(file.name);
      
      try {
        const jsonData = await parseExcelFile(file);

        // 첫 행의 컬럼명 확인 (디버깅용)
        if (jsonData.length > 0) {
          const columns = Object.keys(jsonData[0]);
          console.log(`[Excel] ${file.name} 발견된 컬럼:`, columns);
        }

        // 컬럼 매핑
        const products: ExcelProduct[] = jsonData.map((row) => {
          const productUrl = String(findColumnValue(row, ['product_url', 'url', '상품url', '링크', 'link', 'producturl']) || '');
          const merchantIdRaw = findColumnValue(row, ['merchant_id', '머천트', 'merchant', '판매처', '쇼핑몰']);
          const merchantId = merchantIdRaw ? String(merchantIdRaw) : inferMerchantId(productUrl);
          
          // 이미지 URL 처리 (image_urls 배열 형식도 지원, input 컬럼도 확인)
          let imageUrl = findColumnValue(row, ['image_url', '이미지', 'image', '이미지url', 'imageurl', 'img', 'image_urls', 'imageurls', 'input', 'images']);
          if (typeof imageUrl === 'string' && imageUrl.trim().startsWith('[')) {
            // JSON 배열 형식인 경우 그대로 전달 (서버에서 처리)
            imageUrl = imageUrl;
          } else if (typeof imageUrl === 'string' && imageUrl.trim().startsWith('{')) {
            // JSON 객체 형식인 경우 url 추출 시도
            try {
              const parsed = JSON.parse(imageUrl);
              if (parsed.url) imageUrl = parsed.url;
            } catch {
              // 파싱 실패시 그대로 사용
            }
          }
          
          return {
            merchant_id: merchantId,
            product_url: productUrl,
            name: String(findColumnValue(row, ['name', '상품명', 'title', '제품명', 'productname', '이름', 'product_name']) || ''),
            price: parsePrice(findColumnValue(row, ['price', '가격', '판매가', 'saleprice', '현재가', 'final_price', 'finalprice'])),
            image_url: imageUrl ? String(imageUrl) : undefined,
            original_price: findColumnValue(row, ['original_price', '원가', '정가', 'originalprice']) ? 
              parsePrice(findColumnValue(row, ['original_price', '원가', '정가', 'originalprice'])) : undefined,
            category: findColumnValue(row, ['category', '카테고리', '분류']) ? 
              String(findColumnValue(row, ['category', '카테고리', '분류'])) : undefined,
            brand: findColumnValue(row, ['brand', '브랜드']) ? 
              String(findColumnValue(row, ['brand', '브랜드'])) : undefined,
            gender: findColumnValue(row, ['gender', '성별', 'target']) ? 
              String(findColumnValue(row, ['gender', '성별', 'target'])) : undefined,
            color: findColumnValue(row, ['color', '색상', '컬러', 'colors_available']) ? 
              String(findColumnValue(row, ['color', '색상', '컬러', 'colors_available'])) : undefined,
          };
        }).filter(p => p.product_url && p.name && p.price > 0);

        console.log(`[Excel] ${file.name}: ${jsonData.length}행 중 ${products.length}개 유효`);
        allProducts.push(...products);
        
      } catch (error) {
        console.error(`[Excel] ${file.name} 파싱 오류:`, error);
        toast({ title: "파일 파싱 실패", description: `${file.name}: 올바른 엑셀 파일인지 확인해주세요.`, variant: "destructive" });
      }
    }

    // 모든 파일 처리 완료
    setExcelFileNames(fileNames);
    setExcelProducts(allProducts);
    
    if (allProducts.length > 0) {
      toast({ 
        title: "파일 파싱 완료", 
        description: `${files.length}개 파일에서 ${allProducts.length}개 제품 발견` 
      });
    } else {
      toast({ 
        title: "제품 발견 실패", 
        description: "유효한 제품이 없습니다. 컬럼명을 확인해주세요.",
        variant: "destructive" 
      });
    }
  }, [toast]);

  const registerExcelProducts = async () => {
    if (excelProducts.length === 0) return;

    setIsExcelUploading(true);
    setExcelUploadResult(null);
    
    const startTime = Date.now();
    setExcelUploadProgress({ current: 0, total: excelProducts.length, startTime });

    const BATCH_SIZE = 10;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;
    let imageFailed = 0;
    const errors: string[] = [];

    for (let i = 0; i < excelProducts.length; i += BATCH_SIZE) {
      const batch = excelProducts.slice(i, i + BATCH_SIZE);
      
      // 진행 상황 업데이트
      setExcelUploadProgress(prev => ({ 
        ...prev!, 
        current: i,
        currentFile: `배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(excelProducts.length / BATCH_SIZE)}`
      }));
      
      try {
        const { data, error } = await supabase.functions.invoke('register-product', {
          body: { products: batch },
        });

        if (error) throw error;

        if (data.success && data.results) {
          for (const r of data.results) {
            if (r.success) {
              success++;
            } else if (r.duplicate || r.error?.includes('이미 등록된 제품')) {
              skipped++;
            } else if (r.step_failed === 'image' || r.error?.includes('이미지')) {
              imageFailed++;
            } else if (r.pending || r.error?.includes('수동 처리 대기열')) {
              pending++;
            } else {
              failed++;
              errors.push(`${r.product_url?.slice(0, 50) || r.error?.slice(0, 50)}...: ${r.error}`);
            }
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed += batch.length;
        errors.push(`배치 오류: ${errorMessage}`);
      }
    }

    // 최종 진행 상황
    setExcelUploadProgress(prev => ({ ...prev!, current: excelProducts.length }));
    
    // 결과 저장
    const resultWithAll = { success, failed, skipped, pending, imageFailed, errors: errors.slice(0, 10) };
    setExcelUploadResult(resultWithAll);
    setIsExcelUploading(false);
    
    // 1초 후 진행 상황 리셋
    setTimeout(() => setExcelUploadProgress(null), 1000);
    
    // 결과 토스트 메시지 개선
    const parts = [];
    if (success > 0) parts.push(`${success}개 성공`);
    if (skipped > 0) parts.push(`${skipped}개 중복 스킵`);
    if (imageFailed > 0) parts.push(`${imageFailed}개 이미지 실패`);
    if (pending > 0) parts.push(`${pending}개 대기열`);
    if (failed > 0) parts.push(`${failed}개 실패`);
    
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    
    if (parts.length > 0) {
      toast({ 
        title: success > 0 ? "등록 완료" : (skipped > 0 ? "중복 제품" : "등록 실패"), 
        description: `${parts.join(', ')} (${elapsedSec}초 소요)`,
        variant: success > 0 ? "default" : (skipped > 0 ? "default" : "destructive")
      });
    }
    
    // 성공 또는 대기열 추가된 경우 통계 리로드
    if (success > 0 || pending > 0) {
      loadProductStats();
      loadDnaStats();
      loadPendingCount();
      loadPendingProducts();
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
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: productUrl },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
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
      // 전체 개수
      const { count: total } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // 머천트 목록 조회 (distinct)
      const { data: merchants } = await supabase
        .from('merchants')
        .select('id')
        .eq('is_active', true);

      const byMerchant: Record<string, number> = {};
      const merchantList: string[] = [];
      
      if (merchants && merchants.length > 0) {
        // 각 머천트별 개수를 병렬로 조회
        const countPromises = merchants.map(async (m) => {
          const { count } = await supabase
            .from('products_cache')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('merchant_id', m.id);
          return { merchantId: m.id, count: count || 0 };
        });

        const results = await Promise.all(countPromises);
        results.forEach(r => {
          merchantList.push(r.merchantId);
          if (r.count > 0) {
            byMerchant[r.merchantId] = r.count;
          }
        });
      }

      // 카테고리 목록 조회 (최근 1000개 기준)
      const { data: categoryData } = await supabase
        .from('products_cache')
        .select('category')
        .eq('is_active', true)
        .limit(1000);

      const byCategory: Record<string, number> = {};
      const categoryList: string[] = [];
      if (categoryData) {
        categoryData.forEach(item => {
          if (item.category) {
            byCategory[item.category] = (byCategory[item.category] || 0) + 1;
            if (!categoryList.includes(item.category)) {
              categoryList.push(item.category);
            }
          }
        });
      }

      setAvailableMerchants(merchantList.sort());
      setAvailableCategories(categoryList.sort());
      setProductStats({ total: total || 0, byMerchant, byCategory });
    } catch (error) {
      console.error('Error loading product stats:', error);
    }
  };

  const loadCachedProducts = async (
    filter: 'all' | 'active' | 'inactive' = 'active', 
    loadAll: boolean = false,
    merchant: string = 'all',
    category: string = 'all'
  ) => {
    setProductsLoading(true);
    setSelectedProductIds([]);
    try {
      let query = supabase.from('products_cache')
        .select('id, merchant_id, name, brand, price, original_price, image_url, product_url, category, sub_category, gender, color, sizes, style_tags, is_in_stock, is_active, collected_at, dna_meta, dna_text');
      
      if (filter === 'active') query = query.eq('is_active', true);
      else if (filter === 'inactive') query = query.eq('is_active', false);
      
      if (merchant !== 'all') query = query.eq('merchant_id', merchant);
      if (category !== 'all') query = query.eq('category', category);
      
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
      loadCachedProducts(productFilter, showAllProducts, merchantFilter, categoryFilter);
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
      loadCachedProducts(productFilter, showAllProducts, merchantFilter, categoryFilter);
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
      // 전체 개수는 count 쿼리로 (1000개 제한 우회)
      const { count: totalCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: withDnaCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('dna_meta', 'is', null);

      const total = totalCount || 0;
      const withDna = withDnaCount || 0;
      const withoutDna = total - withDna;

      // DNA 메타 분석은 최신 1000개만 샘플링
      const { data: products } = await supabase
        .from('products_cache')
        .select('dna_meta')
        .eq('is_active', true)
        .not('dna_meta', 'is', null)
        .order('collected_at', { ascending: false })
        .limit(1000);

      const byTarget: Record<string, number> = {};
      const bySlot: Record<string, number> = {};
      const byConcept: Record<string, number> = {};
      
      if (products) {
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
      }

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
          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <TabsList className="inline-flex h-auto min-w-max gap-1 p-1">
              <TabsTrigger value="register" className="flex-shrink-0 whitespace-nowrap">
                <Upload className="w-4 h-4 mr-1" />
                제품 등록
              </TabsTrigger>
              <TabsTrigger value="dna" className="flex-shrink-0 whitespace-nowrap">
                <Dna className="w-4 h-4 mr-1" />
                DNA 관리
              </TabsTrigger>
              <TabsTrigger value="recommend" className="flex-shrink-0 whitespace-nowrap">
                <ShoppingBag className="w-4 h-4 mr-1" />
                AI 추천
              </TabsTrigger>
              <TabsTrigger value="deeplink" className="flex-shrink-0 whitespace-nowrap">
                <Link2 className="w-4 h-4 mr-1" />
                딥링크
              </TabsTrigger>
              <TabsTrigger value="pending" className="relative flex-shrink-0 whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 mr-1" />
                등록 대기
                {pendingOtherCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{pendingOtherCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="images" className="relative flex-shrink-0 whitespace-nowrap">
                <ImageOff className="w-4 h-4 mr-1" />
                이미지 관리
                {pendingImageCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{pendingImageCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="products" className="flex-shrink-0 whitespace-nowrap">
                <Package className="w-4 h-4 mr-1" />
                상품 관리
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-shrink-0 whitespace-nowrap">
                <Users className="w-4 h-4 mr-1" />
                사용자 관리
              </TabsTrigger>
              <TabsTrigger value="errors" className="relative flex-shrink-0 whitespace-nowrap">
                <AlertCircle className="w-4 h-4 mr-1" />
                에러 로그
                {errorLogStats.total > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{errorLogStats.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="jobs" className="relative flex-shrink-0 whitespace-nowrap">
                <Activity className="w-4 h-4 mr-1" />
                생성 큐
                {(jobStats.queued + jobStats.processing) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">{jobStats.queued + jobStats.processing}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex-shrink-0 whitespace-nowrap">
                <BarChart3 className="w-4 h-4 mr-1" />
                성능 분석
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex-shrink-0 whitespace-nowrap">
                <Zap className="w-4 h-4 mr-1" />
                관리도구
              </TabsTrigger>
              <TabsTrigger value="cafe24" className="flex-shrink-0 whitespace-nowrap">
                <Store className="w-4 h-4 mr-1" />
                카페24
              </TabsTrigger>
              <TabsTrigger value="coupang-report" className="flex-shrink-0 whitespace-nowrap">
                <ShoppingBag className="w-4 h-4 mr-1" />
                쿠팡 리포트
              </TabsTrigger>
            </TabsList>
          </div>

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

                {/* File upload - multiple files */}
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      multiple
                      onChange={handleExcelUpload}
                      className="max-w-md"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadProductTemplate}
                      className="whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      템플릿 다운로드
                    </Button>
                  </div>
                  {excelFileNames.length > 0 && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="font-medium">📁 {excelFileNames.length}개 파일 선택됨 (총 {excelProducts.length}개 제품)</p>
                      <div className="flex flex-wrap gap-2">
                        {excelFileNames.map((name, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {excelProducts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          미리보기 (상위 5개)
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          ⏱️ 예상 등록 시간: 약 {Math.ceil(excelProducts.length * 1.5 / 60)}분 ({excelProducts.length}개 × 1.5초)
                        </p>
                      </div>
                      <Button 
                        onClick={registerExcelProducts} 
                        disabled={isExcelUploading}
                        size="lg"
                      >
                        {isExcelUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {excelProducts.length}개 제품 등록
                      </Button>
                    </div>
                    
                    {/* Progress bar during upload */}
                    {isExcelUploading && excelUploadProgress && (
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {excelUploadProgress.currentFile || '등록 중...'}
                          </span>
                          <span className="font-mono">
                            {excelUploadProgress.current}/{excelUploadProgress.total}
                          </span>
                        </div>
                        <Progress value={(excelUploadProgress.current / excelUploadProgress.total) * 100} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {Math.round((excelUploadProgress.current / excelUploadProgress.total) * 100)}% 완료
                          </span>
                          {excelUploadProgress.startTime && excelUploadProgress.current > 0 && (
                            <span>
                              남은 시간: 약 {Math.ceil(
                                ((Date.now() - excelUploadProgress.startTime) / excelUploadProgress.current) 
                                * (excelUploadProgress.total - excelUploadProgress.current) / 1000
                              )}초
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
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
                      ? (excelUploadResult.pending && excelUploadResult.pending > 0
                          ? 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800'
                          : excelUploadResult.skipped && excelUploadResult.skipped > 0 
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                            : 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800')
                      : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {excelUploadResult.failed === 0 && excelUploadResult.success > 0 && !excelUploadResult.pending ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : excelUploadResult.pending && excelUploadResult.pending > 0 ? (
                        <Clock className="w-5 h-5 text-orange-600" />
                      ) : excelUploadResult.skipped && excelUploadResult.skipped > 0 ? (
                        <Package className="w-5 h-5 text-blue-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      )}
                      <span className="font-medium">
                        등록 결과: {excelUploadResult.success}개 성공
                        {excelUploadResult.skipped && excelUploadResult.skipped > 0 && `, ${excelUploadResult.skipped}개 중복 스킵`}
                        {excelUploadResult.imageFailed && excelUploadResult.imageFailed > 0 && `, ${excelUploadResult.imageFailed}개 이미지 실패`}
                        {excelUploadResult.pending && excelUploadResult.pending > 0 && `, ${excelUploadResult.pending}개 대기열`}
                        {excelUploadResult.failed > 0 && `, ${excelUploadResult.failed}개 실패`}
                      </span>
                    </div>
                    {(excelUploadResult.imageFailed && excelUploadResult.imageFailed > 0) && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        🖼️ 이미지 다운로드 실패 {excelUploadResult.imageFailed}개 → "이미지 누락 제품" 탭에서 수동 업로드 가능
                      </p>
                    )}
                    {excelUploadResult.pending && excelUploadResult.pending > 0 && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        🔸 머천트 오류 등 {excelUploadResult.pending}개 → "등록 대기 제품" 탭에서 수동 처리
                      </p>
                    )}
                    {excelUploadResult.skipped && excelUploadResult.skipped > 0 && excelUploadResult.success === 0 && excelUploadResult.failed === 0 && !excelUploadResult.pending && !excelUploadResult.imageFailed && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        ℹ️ 모든 제품이 이미 등록되어 있습니다.
                      </p>
                    )}
                    {excelUploadResult.errors.length > 0 && (
                      <div className="text-sm text-muted-foreground space-y-1 mt-2">
                        <p className="text-xs font-medium text-destructive mb-1">오류 상세:</p>
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

          {/* Pending Products Tab (머천트/기타 에러) */}
          <TabsContent value="pending" className="space-y-4">
            <PendingProductsManager onStatsUpdate={() => { loadProductStats(); loadPendingCount(); }} />
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

                {/* DNA 배치 자동화 안내 */}
                <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Dna className="w-4 h-4" />
                    DNA 자동 생성
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    DNA 배치 생성은 10분마다 자동으로 실행됩니다 (배치 크기: 50개). 색상 분석도 10분 주기로 자동 실행됩니다.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">🤖 자동화됨</Badge>
                    <Badge variant="outline">10분 주기</Badge>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
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
                    <label className="text-sm font-medium">상태:</label>
                    <Select value={productFilter} onValueChange={(v) => {
                      setProductFilter(v as 'all' | 'active' | 'inactive');
                      loadCachedProducts(v as 'all' | 'active' | 'inactive', showAllProducts, merchantFilter, categoryFilter);
                    }}>
                      <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">활성화</SelectItem>
                        <SelectItem value="inactive">비활성화</SelectItem>
                        <SelectItem value="all">전체</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">머천트:</label>
                    <Select value={merchantFilter} onValueChange={(v) => {
                      setMerchantFilter(v);
                      loadCachedProducts(productFilter, showAllProducts, v, categoryFilter);
                    }}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 ({productStats.total})</SelectItem>
                        {availableMerchants.map(m => (
                          <SelectItem key={m} value={m}>
                            {m} ({productStats.byMerchant[m] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">카테고리:</label>
                    <Select value={categoryFilter} onValueChange={(v) => {
                      setCategoryFilter(v);
                      loadCachedProducts(productFilter, showAllProducts, merchantFilter, v);
                    }}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {availableCategories.map(c => (
                          <SelectItem key={c} value={c}>
                            {c} ({productStats.byCategory[c] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={showAllProducts} onCheckedChange={(checked) => {
                      setShowAllProducts(!!checked);
                      loadCachedProducts(productFilter, !!checked, merchantFilter, categoryFilter);
                    }} />
                    전체 로드
                  </label>

                  <Button onClick={() => loadCachedProducts(productFilter, showAllProducts, merchantFilter, categoryFilter)} disabled={productsLoading} variant="outline" size="sm">
                    {productsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
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
                        className={`flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer transition-colors overflow-hidden ${
                          selectedProductIds.includes(product.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        } ${!product.is_active ? 'opacity-60' : ''}`}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        <Checkbox checked={selectedProductIds.includes(product.id)} onCheckedChange={() => toggleProductSelection(product.id)} onClick={(e) => e.stopPropagation()} className="flex-shrink-0" />
                        <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="w-5 h-5" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Badge variant="outline" className="text-xs flex-shrink-0">{product.merchant_id}</Badge>
                            <Badge variant="secondary" className="text-xs flex-shrink-0">{product.category}</Badge>
                            {!product.is_active && <Badge variant="outline" className="text-xs border-orange-500 text-orange-500 flex-shrink-0">비활성</Badge>}
                          </div>
                          <p className="font-medium text-sm truncate max-w-full">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate max-w-[80px]">{product.brand}</span>
                            <span className="font-bold text-foreground flex-shrink-0">₩{product.price.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDnaEditorProduct(product);
                              setDnaEditorOpen(true);
                            }}
                          >
                            <Dna className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(product.product_url, '_blank');
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {productsLoading ? '로딩 중...' : '상품이 없습니다. "새로고침" 버튼을 클릭해주세요.'}
                  </div>
                )}
                
                {/* DNA Editor Modal */}
                <ProductDetailEditor
                  product={dnaEditorProduct ? {
                    id: dnaEditorProduct.id,
                    name: dnaEditorProduct.name,
                    brand: dnaEditorProduct.brand,
                    category: dnaEditorProduct.category,
                    sub_category: dnaEditorProduct.sub_category,
                    price: dnaEditorProduct.price,
                    original_price: dnaEditorProduct.original_price,
                    image_url: dnaEditorProduct.image_url,
                    product_url: dnaEditorProduct.product_url,
                    merchant_id: dnaEditorProduct.merchant_id,
                    gender: dnaEditorProduct.gender,
                    color: dnaEditorProduct.color,
                    sizes: dnaEditorProduct.sizes,
                    style_tags: dnaEditorProduct.style_tags,
                    is_active: dnaEditorProduct.is_active,
                    is_in_stock: dnaEditorProduct.is_in_stock,
                    dna_meta: dnaEditorProduct.dna_meta as Record<string, unknown> | null,
                    dna_text: dnaEditorProduct.dna_text,
                  } : null}
                  open={dnaEditorOpen}
                  onOpenChange={setDnaEditorOpen}
                  onSaved={() => loadCachedProducts(productFilter, showAllProducts, merchantFilter, categoryFilter)}
                />
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
                          
                          // 한국시간 기준 오늘 날짜 계산
                          const now = new Date();
                          const kstOffset = 9 * 60 * 60 * 1000;
                          const kstTime = new Date(now.getTime() + kstOffset);
                          const today = kstTime.toISOString().split('T')[0];
                          
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

                <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                  <h3 className="font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" />자동화된 정리 작업</h3>
                  <p className="text-sm text-muted-foreground">추천 캐시 정리와 에러 로그 정리는 매일 자동으로 실행됩니다.</p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">🤖 캐시 정리 (매일 01:00)</Badge>
                    <Badge variant="secondary">🤖 에러 로그 정리 (매일 00:00)</Badge>
                    <Badge variant="secondary">🤖 DNA 배치 (10분 주기)</Badge>
                    <Badge variant="secondary">🤖 색상 분석 (10분 주기)</Badge>
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

          {/* Performance Analytics Tab (merged) */}
          <TabsContent value="performance" className="space-y-4">
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
            <InferenceMetricsPanel />
          </TabsContent>

          {/* Cafe24 Tab */}
          <TabsContent value="cafe24" className="space-y-4">
            <Cafe24TenantManager />
          </TabsContent>

          {/* Coupang Daily Report Tab */}
          <TabsContent value="coupang-report" className="space-y-4">
            <CoupangDailyReportPanel />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
