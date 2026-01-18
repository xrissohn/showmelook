import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Image, Upload, ExternalLink, CheckCircle2, XCircle, AlertCircle, Copy, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductWithoutImage {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  merchant_id: string | null;
  product_url: string;
  price: number;
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

const MissingImagesManager = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductWithoutImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imageMappings, setImageMappings] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [csvInput, setCsvInput] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);

  useEffect(() => {
    loadProductsWithoutImages();
  }, []);

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
      
      // Initialize empty mappings
      const initialMappings: Record<string, string> = {};
      data?.forEach(p => {
        initialMappings[p.id] = '';
      });
      setImageMappings(initialMappings);
    } catch (error: any) {
      toast({
        title: "로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUrlChange = (productId: string, url: string) => {
    setImageMappings(prev => ({
      ...prev,
      [productId]: url
    }));
  };

  const parseCsvInput = () => {
    // Parse CSV format: product_id,image_url or just image_url per line (matching by order)
    const lines = csvInput.trim().split('\n').filter(line => line.trim());
    const newMappings = { ...imageMappings };
    
    let matchedCount = 0;
    
    lines.forEach((line, index) => {
      const parts = line.split(',').map(s => s.trim());
      
      if (parts.length >= 2) {
        // Format: product_id,image_url
        const [productId, imageUrl] = parts;
        if (newMappings.hasOwnProperty(productId) && imageUrl) {
          newMappings[productId] = imageUrl;
          matchedCount++;
        }
      } else if (parts.length === 1 && products[index]) {
        // Format: just image_url, match by order
        newMappings[products[index].id] = parts[0];
        matchedCount++;
      }
    });

    setImageMappings(newMappings);
    toast({
      title: "CSV 파싱 완료",
      description: `${matchedCount}개의 이미지 URL이 매칭되었습니다.`,
    });
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
      toast({
        title: "업로드할 이미지 없음",
        description: "이미지 URL을 입력해주세요.",
        variant: "destructive",
      });
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

      // Reload to update the list
      if (data.updated > 0) {
        loadProductsWithoutImages();
      }
    } catch (error: any) {
      toast({
        title: "업로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const copyProductList = () => {
    const text = products.map(p => `${p.id},${p.name},${p.product_url}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({
      title: "복사 완료",
      description: "상품 목록이 클립보드에 복사되었습니다.",
    });
  };

  const groupedProducts = products.reduce((acc, product) => {
    const merchant = product.merchant_id || 'unknown';
    if (!acc[merchant]) acc[merchant] = [];
    acc[merchant].push(product);
    return acc;
  }, {} as Record<string, ProductWithoutImage[]>);

  const mappingsToUploadCount = getMappingsToUpload().length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          이미지 없는 상품 관리
        </CardTitle>
        <CardDescription>
          이미지가 없는 상품에 이미지 URL을 입력하여 Storage에 저장합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats & Actions */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <span className="font-medium">이미지 없는 상품: {products.length}개</span>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={copyProductList}>
              <Copy className="w-4 h-4 mr-2" />
              목록 복사
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCsvUpload(!showCsvUpload)}>
              <FileText className="w-4 h-4 mr-2" />
              CSV 일괄 입력
            </Button>
            <Button 
              onClick={uploadImages} 
              disabled={isUploading || mappingsToUploadCount === 0}
              size="sm"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {mappingsToUploadCount}개 이미지 업로드
            </Button>
          </div>
        </div>

        {/* CSV Bulk Input */}
        {showCsvUpload && (
          <div className="p-4 border rounded-lg space-y-3 bg-background">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">CSV 형식:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">product_id,image_url</code>
              <p className="mt-1">또는 상품 순서대로 이미지 URL만 입력 (줄바꿈 구분)</p>
            </div>
            <Textarea
              placeholder={`product_id,https://example.com/image1.jpg\nproduct_id,https://example.com/image2.jpg\n\n또는\n\nhttps://example.com/image1.jpg\nhttps://example.com/image2.jpg`}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button onClick={parseCsvInput} size="sm">
                적용
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCsvUpload(false)}>
                취소
              </Button>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} />
            <p className="text-sm text-muted-foreground text-center">
              이미지 업로드 중...
            </p>
          </div>
        )}

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="p-4 border rounded-lg space-y-2 max-h-[200px] overflow-y-auto">
            <p className="font-medium text-sm">업로드 결과:</p>
            {uploadResults.map((result, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="truncate flex-1">{result.productName}</span>
                {result.error && (
                  <span className="text-red-500 text-xs">{result.error}</span>
                )}
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

        {/* Products by Merchant */}
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
                    <TableHead className="w-[80px]">링크</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchantProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[230px]" title={product.name}>
                          {product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{product.brand}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        ₩{product.price.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="https://..."
                          value={imageMappings[product.id] || ''}
                          onChange={(e) => handleImageUrlChange(product.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(product.product_url, '_blank')}
                        >
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
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>모든 상품에 이미지가 있습니다!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MissingImagesManager;
