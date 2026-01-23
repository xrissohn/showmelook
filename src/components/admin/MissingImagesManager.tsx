import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ImageOff, Upload, ExternalLink, CheckCircle2, XCircle, AlertCircle, Copy, FileText, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ==================== Types ====================
interface ProductWithoutImage {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  merchant_id: string | null;
  product_url: string;
  price: number;
}

interface RawProductData {
  name: string;
  product_url: string;
  price: number;
  image_url?: string;
  category?: string;
  merchant_id?: string;
  brand?: string;
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

interface ImageMapping {
  productId: string;
  imageUrl: string;
}

interface UploadResult {
  productId: string;
  productName: string;
  originalUrl: string;
  storageUrl?: string;
  success: boolean;
  error?: string;
}

// ==================== Component ====================
const MissingImagesManager = () => {
  const { toast } = useToast();
  
  // Tab 1: Existing products without images
  const [products, setProducts] = useState<ProductWithoutImage[]>([]);
  const [imageMappings, setImageMappings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [csvInput, setCsvInput] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  
  // Tab 2: Pending products (missing_image)
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedMerchantFix, setSelectedMerchantFix] = useState<Record<string, string>>({});
  const [pendingImageUrls, setPendingImageUrls] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadProductsWithoutImages();
    loadPendingProducts();
    loadMerchants();
  }, []);

  // ==================== Data Loaders ====================
  const loadProductsWithoutImages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products_cache')
        .select('id, name, brand, category, merchant_id, product_url, price')
        .or('image_url.is.null,image_url.eq.')
        .eq('is_active', true)
        .order('merchant_id')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
      
      const initialMappings: Record<string, string> = {};
      data?.forEach(p => { initialMappings[p.id] = ''; });
      setImageMappings(initialMappings);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingProducts = async () => {
    setPendingLoading(true);
    try {
      // 이미지 관련 에러만 (missing_image, image_download_failed)
      const { data, error } = await supabase
        .from('pending_products')
        .select('*')
        .in('error_type', ['missing_image', 'image_download_failed'])
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedPending: PendingProduct[] = (data || []).map(p => ({
        id: p.id,
        source: p.source,
        error_type: p.error_type,
        error_message: p.error_message,
        raw_data: p.raw_data as RawProductData,
        created_at: p.created_at,
        retry_count: p.retry_count,
      }));

      setPendingProducts(typedPending);

      // Initialize merchant selections from raw_data
      const initialFix: Record<string, string> = {};
      typedPending.forEach(p => {
        initialFix[p.id] = p.raw_data.merchant_id || p.source || '';
      });
      setSelectedMerchantFix(initialFix);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setPendingLoading(false);
    }
  };

  const loadMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, name_ko')
        .eq('is_active', true);

      if (error) throw error;
      setMerchants(data || []);
    } catch (error) {
      console.error('Failed to load merchants:', error);
    }
  };

  // ==================== Tab 1: Existing Products Handlers ====================
  const handleImageUrlChange = (productId: string, url: string) => {
    setImageMappings(prev => ({ ...prev, [productId]: url }));
  };

  const parseCsvInput = () => {
    const lines = csvInput.trim().split('\n').filter(line => line.trim());
    const newMappings = { ...imageMappings };
    let matchedCount = 0;

    lines.forEach((line, index) => {
      const parts = line.split(',').map(s => s.trim());
      
      if (parts.length >= 2) {
        const [productId, imageUrl] = parts;
        if (newMappings.hasOwnProperty(productId) && imageUrl) {
          newMappings[productId] = imageUrl;
          matchedCount++;
        }
      } else if (parts.length === 1 && products[index]) {
        newMappings[products[index].id] = parts[0];
        matchedCount++;
      }
    });

    setImageMappings(newMappings);
    toast({ title: "CSV 파싱 완료", description: `${matchedCount}개의 이미지 URL이 매칭되었습니다.` });
    setShowCsvUpload(false);
    setCsvInput("");
  };

  const getMappingsToUpload = (): ImageMapping[] => {
    return Object.entries(imageMappings)
      .filter(([_, url]) => url.trim())
      .map(([productId, imageUrl]) => ({ productId, imageUrl: imageUrl.trim() }));
  };

  const uploadImages = async () => {
    const mappings = getMappingsToUpload();
    
    if (mappings.length === 0) {
      toast({ title: "업로드할 이미지 없음", description: "이미지 URL을 입력해주세요.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('update-product-images', {
        body: { mappings }
      });

      if (error) throw error;

      setUploadResults(data.results || []);
      setUploadProgress(100);

      toast({
        title: "업로드 완료",
        description: `${data.updated}개 성공, ${data.failed}개 실패`,
        variant: data.failed > 0 ? "destructive" : "default",
      });

      if (data.updated > 0) {
        loadProductsWithoutImages();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "업로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const copyProductList = () => {
    const text = products.map(p => `${p.id},${p.name},${p.product_url}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: "복사 완료", description: "상품 목록이 클립보드에 복사되었습니다." });
  };

  // ==================== Tab 2: Pending Products Handlers ====================
  const handlePendingImageUpload = async (productId: string, file: File) => {
    setProcessingId(productId);
    
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `pending/${productId}_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filename, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename);

      setPendingImageUrls(prev => ({ ...prev, [productId]: urlData.publicUrl }));
      toast({ title: "이미지 업로드 완료" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "업로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const registerPendingWithImage = async (product: PendingProduct) => {
    const imageUrl = pendingImageUrls[product.id];
    const merchantId = selectedMerchantFix[product.id] || product.raw_data.merchant_id;
    
    if (!imageUrl) {
      toast({ title: "이미지 필요", description: "이미지를 업로드하거나 URL을 입력해주세요.", variant: "destructive" });
      return;
    }

    if (!merchantId) {
      toast({ title: "머천트 필요", description: "머천트를 선택해주세요.", variant: "destructive" });
      return;
    }

    setProcessingId(product.id);

    try {
      const updatedProduct = {
        ...product.raw_data,
        image_url: imageUrl,
        merchant_id: merchantId,
      };

      const { data, error } = await supabase.functions.invoke('register-product', {
        body: { products: [updatedProduct] }
      });

      if (error) throw error;

      const result = data?.results?.[0];
      if (result?.success) {
        await supabase
          .from('pending_products')
          .update({ resolved_at: new Date().toISOString(), resolved_by: 'admin_image_upload' })
          .eq('id', product.id);
        
        setPendingProducts(prev => prev.filter(p => p.id !== product.id));
        toast({ title: "등록 성공", description: `${product.raw_data.name} 제품이 등록되었습니다.` });
      } else {
        throw new Error(result?.error || data?.error || '등록 실패');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "등록 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const deletePendingItem = async (id: string) => {
    try {
      await supabase.from('pending_products').delete().eq('id', id);
      setPendingProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "삭제됨" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "삭제 실패", description: errorMessage, variant: "destructive" });
    }
  };

  // ==================== Groupings ====================
  const groupedProducts = products.reduce((acc, product) => {
    const merchant = product.merchant_id || 'unknown';
    if (!acc[merchant]) acc[merchant] = [];
    acc[merchant].push(product);
    return acc;
  }, {} as Record<string, ProductWithoutImage[]>);

  const groupedPending = pendingProducts.reduce((acc, product) => {
    const source = product.source || 'unknown';
    if (!acc[source]) acc[source] = [];
    acc[source].push(product);
    return acc;
  }, {} as Record<string, PendingProduct[]>);

  const mappingsToUploadCount = getMappingsToUpload().length;

  // ==================== Render ====================
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageOff className="w-5 h-5 text-amber-500" />
          이미지 관리
        </CardTitle>
        <CardDescription>
          이미지가 없는 상품 및 등록 대기 중인 제품의 이미지를 관리합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              등록 대기
              {pendingProducts.length > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-1">
                  {pendingProducts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="existing" className="flex items-center gap-2">
              기존 제품
              {products.length > 0 && (
                <Badge variant="secondary" className="ml-1">{products.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ==================== Tab: Pending Products ==================== */}
          <TabsContent value="pending" className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">이미지 없이 등록 시도한 제품들입니다. 이미지를 업로드하여 등록하세요.</span>
              <Button variant="outline" size="sm" onClick={loadPendingProducts} disabled={pendingLoading} className="ml-auto">
                {pendingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "새로고침"}
              </Button>
            </div>

            {pendingLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}

            {!pendingLoading && Object.entries(groupedPending).map(([source, sourceProducts]) => (
              <div key={source} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{source}</Badge>
                  <span className="text-sm text-muted-foreground">{sourceProducts.length}개</span>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">이미지</TableHead>
                        <TableHead className="w-[180px]">상품명</TableHead>
                        <TableHead className="w-[130px]">머천트</TableHead>
                        <TableHead className="w-[80px]">가격</TableHead>
                        <TableHead className="w-[220px]">이미지 업로드</TableHead>
                        <TableHead className="w-[100px]">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceProducts.slice(0, 30).map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            {pendingImageUrls[product.id] ? (
                              <img 
                                src={pendingImageUrls[product.id]} 
                                alt={product.raw_data.name}
                                className="w-14 h-14 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-muted rounded border flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="truncate max-w-[160px] text-sm font-medium" title={product.raw_data.name}>
                              {product.raw_data.name}
                            </div>
                            {product.raw_data.brand && (
                              <div className="text-xs text-muted-foreground">{product.raw_data.brand}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={selectedMerchantFix[product.id] || ''} 
                              onValueChange={(value) => setSelectedMerchantFix(prev => ({ ...prev, [product.id]: value }))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {merchants.map(m => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">
                                    {m.name_ko} ({m.id})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs">
                            ₩{product.raw_data.price?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  ref={el => { fileInputRefs.current[product.id] = el; }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePendingImageUpload(product.id, file);
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRefs.current[product.id]?.click()}
                                  disabled={processingId === product.id}
                                  className="h-7 text-xs flex-1"
                                >
                                  {processingId === product.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Upload className="w-3 h-3 mr-1" />
                                  )}
                                  파일
                                </Button>
                              </div>
                              <Input
                                type="url"
                                placeholder="이미지 URL"
                                className="h-7 text-xs"
                                value={pendingImageUrls[product.id] || ''}
                                onChange={(e) => setPendingImageUrls(prev => ({ ...prev, [product.id]: e.target.value }))}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                onClick={() => registerPendingWithImage(product)}
                                disabled={processingId === product.id || !pendingImageUrls[product.id]}
                                className="h-7 text-xs"
                              >
                                {processingId === product.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "등록"}
                              </Button>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(product.raw_data.product_url, '_blank')}
                                  className="h-6 flex-1 px-2"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deletePendingItem(product.id)}
                                  className="text-destructive hover:text-destructive h-6 flex-1 px-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sourceProducts.length > 30 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-2 text-xs">
                            ... 외 {sourceProducts.length - 30}개 더
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}

            {!pendingLoading && pendingProducts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-primary" />
                <p>이미지 대기 중인 제품이 없습니다!</p>
              </div>
            )}
          </TabsContent>

          {/* ==================== Tab: Existing Products ==================== */}
          <TabsContent value="existing" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm">이미지 없는 기존 상품: {products.length}개</span>
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={copyProductList}>
                  <Copy className="w-3 h-3 mr-1" />목록 복사
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCsvUpload(!showCsvUpload)}>
                  <FileText className="w-3 h-3 mr-1" />CSV 입력
                </Button>
                <Button onClick={uploadImages} disabled={isUploading || mappingsToUploadCount === 0} size="sm">
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                  {mappingsToUploadCount}개 업로드
                </Button>
              </div>
            </div>

            {showCsvUpload && (
              <div className="p-4 border rounded-lg space-y-3 bg-background">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">CSV 형식:</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">product_id,image_url</code>
                </div>
                <Textarea
                  placeholder="product_id,https://example.com/image.jpg"
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button onClick={parseCsvInput} size="sm">적용</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCsvUpload(false)}>취소</Button>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-muted-foreground text-center">이미지 업로드 중...</p>
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="p-4 border rounded-lg space-y-2 max-h-[200px] overflow-y-auto">
                <p className="font-medium text-sm">업로드 결과:</p>
                {uploadResults.map((result, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {result.success ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    <span className="truncate flex-1">{result.productName}</span>
                    {result.error && <span className="text-destructive text-xs">{result.error}</span>}
                  </div>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}

            {!isLoading && Object.entries(groupedProducts).map(([merchantId, merchantProducts]) => (
              <div key={merchantId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{merchantId}</Badge>
                  <span className="text-sm text-muted-foreground">{merchantProducts.length}개</span>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">상품명</TableHead>
                        <TableHead className="w-[100px]">카테고리</TableHead>
                        <TableHead className="w-[100px]">가격</TableHead>
                        <TableHead>이미지 URL</TableHead>
                        <TableHead className="w-[60px]">링크</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {merchantProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            <div className="truncate max-w-[230px]" title={product.name}>{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.brand}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">₩{product.price.toLocaleString()}</TableCell>
                          <TableCell>
                            <Input
                              placeholder="https://..."
                              value={imageMappings[product.id] || ''}
                              onChange={(e) => handleImageUrlChange(product.id, e.target.value)}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => window.open(product.product_url, '_blank')}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}

            {!isLoading && products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-primary" />
                <p>모든 상품에 이미지가 있습니다!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MissingImagesManager;
