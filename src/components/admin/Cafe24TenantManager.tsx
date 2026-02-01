import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Store, RefreshCw, Link2, CheckCircle, XCircle, ExternalLink, 
  Users, ShoppingBag, Loader2, Plus, Copy, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Cafe24Tenant {
  id: string;
  mall_id: string;
  shop_name: string | null;
  is_active: boolean;
  plan: string | null;
  monthly_generation_limit: number | null;
  monthly_generation_used: number | null;
  expires_at: string;
  created_at: string;
}

interface Cafe24Product {
  id: string;
  cafe24_product_no: number;
  product_name: string;
  price: number;
  image_url: string | null;
  is_synced: boolean;
  products_cache_id: string | null;
}

interface Cafe24FittingSession {
  id: string;
  cafe24_product_no: number;
  session_token: string;
  fitting_result_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export function Cafe24TenantManager() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Cafe24Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Cafe24Tenant | null>(null);
  const [products, setProducts] = useState<Cafe24Product[]>([]);
  const [sessions, setSessions] = useState<Cafe24FittingSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testMallId, setTestMallId] = useState("");

  // OAuth 엔드포인트 URL
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mggedvvzpwxlgrhatrau.supabase.co';
  const oauthUrls = {
    managerAuth: `${SUPABASE_URL}/functions/v1/cafe24-oauth/manager-auth`,
    authorize: `${SUPABASE_URL}/functions/v1/cafe24-oauth/authorize`,
    callback: `${SUPABASE_URL}/functions/v1/cafe24-oauth/callback`,
    widgetSdk: `${SUPABASE_URL}/functions/v1/cafe24-widget/sdk.js`,
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cafe24_tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      toast({ title: "테넌트 로드 실패", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenantDetails = async (tenant: Cafe24Tenant) => {
    setSelectedTenant(tenant);
    
    // 상품 로드
    const { data: productData } = await supabase
      .from('cafe24_products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    setProducts(productData || []);

    // 세션 로드
    const { data: sessionData } = await supabase
      .from('cafe24_fitting_sessions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    setSessions(sessionData || []);
  };

  const syncProducts = async () => {
    if (!selectedTenant) return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('cafe24-sync', {
        body: {
          action: 'list-products',
          mall_id: selectedTenant.mall_id,
        },
      });

      if (error) throw error;

      toast({ 
        title: "동기화 완료", 
        description: `${data.synced_count || 0}개 상품이 동기화되었습니다.` 
      });
      
      loadTenantDetails(selectedTenant);
    } catch (error) {
      console.error('Sync error:', error);
      toast({ title: "동기화 실패", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const linkToProductsCache = async (cafe24Product: Cafe24Product) => {
    // products_cache에서 비슷한 상품 찾기
    const { data: cacheProducts } = await supabase
      .from('products_cache')
      .select('id, name, brand, price')
      .ilike('name', `%${cafe24Product.product_name.split(' ').slice(0, 2).join(' ')}%`)
      .limit(5);

    if (!cacheProducts || cacheProducts.length === 0) {
      toast({ 
        title: "연결 실패", 
        description: "products_cache에서 일치하는 상품을 찾을 수 없습니다.",
        variant: "destructive" 
      });
      return;
    }

    // 첫 번째 일치 상품으로 자동 연결
    const { error } = await supabase
      .from('cafe24_products')
      .update({ products_cache_id: cacheProducts[0].id })
      .eq('id', cafe24Product.id);

    if (error) {
      toast({ title: "연결 실패", variant: "destructive" });
    } else {
      toast({ 
        title: "연결 성공", 
        description: `${cacheProducts[0].name}과 연결되었습니다.` 
      });
      if (selectedTenant) loadTenantDetails(selectedTenant);
    }
  };

  const testOAuthEndpoint = async () => {
    try {
      const response = await fetch(oauthUrls.managerAuth);
      const data = await response.json();
      
      toast({ 
        title: "운영자 권한확인 테스트", 
        description: data.message || "성공" 
      });
    } catch (error) {
      toast({ title: "테스트 실패", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "복사됨", description: `${label}이 클립보드에 복사되었습니다.` });
  };

  const toggleTenantStatus = async (tenant: Cafe24Tenant) => {
    const { error } = await supabase
      .from('cafe24_tenants')
      .update({ is_active: !tenant.is_active })
      .eq('id', tenant.id);

    if (error) {
      toast({ title: "상태 변경 실패", variant: "destructive" });
    } else {
      toast({ title: tenant.is_active ? "비활성화됨" : "활성화됨" });
      loadTenants();
    }
  };

  return (
    <div className="space-y-6">
      {/* OAuth 엔드포인트 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            카페24 연동 URL
          </CardTitle>
          <CardDescription>
            카페24 개발자 스토어 앱 등록에 필요한 URL입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">운영자 권한확인 URI</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{oauthUrls.managerAuth}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(oauthUrls.managerAuth, 'URL')}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={testOAuthEndpoint}>
                  테스트
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">OAuth Redirect URI</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{oauthUrls.callback}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(oauthUrls.callback, 'URL')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">위젯 SDK URL</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{oauthUrls.widgetSdk}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(oauthUrls.widgetSdk, 'URL')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* OAuth 테스트 */}
          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="테스트용 mall_id (예: test-shop)"
              value={testMallId}
              onChange={(e) => setTestMallId(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (testMallId) {
                  window.open(`${oauthUrls.authorize}?mall_id=${testMallId}`, '_blank');
                } else {
                  toast({ title: "mall_id를 입력하세요", variant: "destructive" });
                }
              }}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              OAuth 테스트
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 테넌트 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                연동된 쇼핑몰 ({tenants.length})
              </CardTitle>
              <CardDescription>
                카페24 앱을 설치한 쇼핑몰 목록입니다.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={loadTenants} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Store className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>아직 연동된 쇼핑몰이 없습니다.</p>
              <p className="text-sm">카페24 스토어에서 앱을 설치하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>쇼핑몰</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>사용량</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow 
                    key={tenant.id}
                    className={selectedTenant?.id === tenant.id ? 'bg-muted/50' : ''}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{tenant.shop_name || tenant.mall_id}</p>
                        <p className="text-xs text-muted-foreground">{tenant.mall_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.is_active ? (
                        <Badge variant="default">
                          <CheckCircle className="w-3 h-3 mr-1" /> 활성
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" /> 비활성
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tenant.plan || 'basic'}</Badge>
                    </TableCell>
                    <TableCell>
                      {tenant.monthly_generation_used}/{tenant.monthly_generation_limit}
                    </TableCell>
                    <TableCell>
                      {format(new Date(tenant.expires_at), 'yyyy.MM.dd', { locale: ko })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => loadTenantDetails(tenant)}
                        >
                          상세
                        </Button>
                        <Button 
                          size="sm" 
                          variant={tenant.is_active ? "destructive" : "default"}
                          onClick={() => toggleTenantStatus(tenant)}
                        >
                          {tenant.is_active ? '비활성화' : '활성화'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 선택된 테넌트 상세 */}
      {selectedTenant && (
        <>
          {/* 상품 목록 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    {selectedTenant.shop_name || selectedTenant.mall_id} 상품 ({products.length})
                  </CardTitle>
                  <CardDescription>
                    카페24에서 동기화된 상품입니다.
                  </CardDescription>
                </div>
                <Button onClick={syncProducts} disabled={isSyncing}>
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  상품 동기화
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>동기화된 상품이 없습니다.</p>
                  <p className="text-sm">상품 동기화 버튼을 클릭하세요.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이미지</TableHead>
                      <TableHead>상품명</TableHead>
                      <TableHead>가격</TableHead>
                      <TableHead>캐시 연결</TableHead>
                      <TableHead>액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.product_name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                              <ShoppingBag className="w-6 h-6 opacity-30" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.product_name}</p>
                            <p className="text-xs text-muted-foreground">#{product.cafe24_product_no}</p>
                          </div>
                        </TableCell>
                        <TableCell>₩{product.price.toLocaleString()}</TableCell>
                        <TableCell>
                          {product.products_cache_id ? (
                            <Badge variant="default">연결됨</Badge>
                          ) : (
                            <Badge variant="secondary">미연결</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!product.products_cache_id && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => linkToProductsCache(product)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              캐시 연결
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 피팅 세션 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                피팅 세션 ({sessions.length})
              </CardTitle>
              <CardDescription>
                최근 가상피팅 요청 기록입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>피팅 세션이 없습니다.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상품번호</TableHead>
                      <TableHead>세션 토큰</TableHead>
                      <TableHead>생성일</TableHead>
                      <TableHead>완료</TableHead>
                      <TableHead>결과</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>#{session.cafe24_product_no}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {session.session_token.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {format(new Date(session.created_at), 'MM.dd HH:mm', { locale: ko })}
                        </TableCell>
                        <TableCell>
                          {session.completed_at ? (
                            <Badge variant="default">완료</Badge>
                          ) : (
                            <Badge variant="secondary">진행중</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.fitting_result_url && (
                            <a 
                              href={session.fitting_result_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              결과 보기
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
