import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, RefreshCw, CheckCircle, XCircle, 
  ShoppingCart, Upload, AlertTriangle, FileSpreadsheet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/paginatedFetch";
import { useToast } from "@/hooks/use-toast";
import { parseExcelFile, findColumnValue } from '@/lib/excelParser';

interface ReportResult {
  success: boolean;
  totalRecords?: number;
  processedRecords?: number;
  matchedIntents?: number;
  updatedStats?: number;
  tierChanges?: number;
  errors?: string[];
  error?: string;
  message?: string;
}

interface DailyReportRow {
  id: string;
  report_date: string;
  tracking_code: string | null;
  sub_id: string | null;
  click_count: number;
  order_count: number;
  cancel_count: number;
  gmv: number;
  commission: number;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

interface ReportStats {
  total: number;
  processed: number;
  totalGmv: number;
  totalCommission: number;
  totalOrders: number;
  totalCancels: number;
  byDate: Record<string, {
    count: number;
    gmv: number;
    orders: number;
  }>;
}

interface ManualRecord {
  report_date: string;
  sub_id: string;
  tracking_code?: string;
  click_count?: number;
  order_count: number;
  cancel_count?: number;
  gmv: number;
  commission?: number;
}

export function CoupangDailyReportPanel() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  
  // 수동 입력 폼
  const [manualDate, setManualDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  const [manualSubId, setManualSubId] = useState("");
  const [manualGmv, setManualGmv] = useState("");
  const [manualOrderCount, setManualOrderCount] = useState("1");
  const [manualCancelCount, setManualCancelCount] = useState("0");
  const [manualCommission, setManualCommission] = useState("");
  
  // Excel 업로드
  const [parsedRecords, setParsedRecords] = useState<ManualRecord[]>([]);
  
  const [recentReports, setRecentReports] = useState<DailyReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [stats, setStats] = useState<ReportStats | null>(null);

  useEffect(() => {
    loadRecentReports();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await fetchAllRows<DailyReportRow>(
        'coupang_daily_reports', '*',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q: any) => q.order('report_date', { ascending: false })
      );

      const statsResult: ReportStats = {
        total: data?.length || 0,
        processed: data?.filter(r => r.processed).length || 0,
        totalGmv: data?.reduce((sum, r) => sum + (r.gmv || 0), 0) || 0,
        totalCommission: data?.reduce((sum, r) => sum + (r.commission || 0), 0) || 0,
        totalOrders: data?.reduce((sum, r) => sum + (r.order_count || 0), 0) || 0,
        totalCancels: data?.reduce((sum, r) => sum + (r.cancel_count || 0), 0) || 0,
        byDate: {},
      };

      data?.forEach(r => {
        const dateKey = r.report_date;
        if (!statsResult.byDate[dateKey]) {
          statsResult.byDate[dateKey] = { count: 0, gmv: 0, orders: 0 };
        }
        statsResult.byDate[dateKey].count++;
        statsResult.byDate[dateKey].gmv += r.gmv || 0;
        statsResult.byDate[dateKey].orders += r.order_count || 0;
      });

      setStats(statsResult);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentReports = async () => {
    setReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupang_daily_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecentReports(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "로드 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setReportsLoading(false);
    }
  };

  const handleExcelUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const jsonData = await parseExcelFile(file);
      console.log('[Excel] Parsed rows:', jsonData.length);

      const records: ManualRecord[] = jsonData.map((row) => {
        return {
          report_date: String(findColumnValue(row, ['date', '날짜', 'reportdate']) || manualDate),
          sub_id: String(findColumnValue(row, ['subid', 'sub_id', '트래킹', 'tracking', 'lpinfo']) || ''),
          tracking_code: String(findColumnValue(row, ['trackingcode', 'tracking_code', '코드']) || ''),
          click_count: parseInt(String(findColumnValue(row, ['click', '클릭']) || '0'), 10),
          order_count: parseInt(String(findColumnValue(row, ['order', '주문', 'orders']) || '0'), 10),
          cancel_count: parseInt(String(findColumnValue(row, ['cancel', '취소', 'cancels']) || '0'), 10),
          gmv: parseInt(String(findColumnValue(row, ['gmv', '매출', 'sales', '금액']) || '0').replace(/[^\d]/g, ''), 10),
          commission: parseInt(String(findColumnValue(row, ['commission', '수수료', 'payout']) || '0').replace(/[^\d]/g, ''), 10),
        };
      }).filter(r => r.sub_id && (r.order_count > 0 || r.cancel_count > 0));

      setParsedRecords(records);
      
      toast({
        title: "엑셀 파싱 완료",
        description: `${records.length}건의 유효한 레코드가 발견되었습니다.`,
      });
    } catch (error) {
      console.error('[Excel] Parse error:', error);
      toast({ title: "파싱 실패", description: "엑셀 파일 형식을 확인해주세요.", variant: "destructive" });
    }
  }, [manualDate, toast]);

  const submitManualRecord = async () => {
    if (!manualSubId || !manualGmv) {
      toast({ title: "필수 입력 누락", description: "Sub ID와 GMV는 필수입니다.", variant: "destructive" });
      return;
    }

    const record: ManualRecord = {
      report_date: manualDate,
      sub_id: manualSubId.trim(),
      order_count: parseInt(manualOrderCount, 10) || 0,
      cancel_count: parseInt(manualCancelCount, 10) || 0,
      gmv: parseInt(manualGmv.replace(/[^\d]/g, ''), 10) || 0,
      commission: manualCommission ? parseInt(manualCommission.replace(/[^\d]/g, ''), 10) : undefined,
    };

    await processRecords([record]);
  };

  const submitExcelRecords = async () => {
    if (parsedRecords.length === 0) {
      toast({ title: "레코드 없음", description: "먼저 엑셀 파일을 업로드해주세요.", variant: "destructive" });
      return;
    }

    await processRecords(parsedRecords);
  };

  const processRecords = async (records: ManualRecord[]) => {
    setIsLoading(true);
    setReportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('coupang-daily-report', {
        body: { records },
      });

      if (error) throw error;

      setReportResult(data);
      
      if (data.success) {
        toast({
          title: "처리 완료",
          description: `${data.processedRecords}건 처리, ${data.matchedIntents}건 매칭, ${data.tierChanges}건 등급 변동`,
        });
        loadRecentReports();
        loadStats();
        
        // 폼 초기화
        setManualSubId("");
        setManualGmv("");
        setManualOrderCount("1");
        setManualCancelCount("0");
        setManualCommission("");
        setParsedRecords([]);
      } else {
        toast({
          title: "처리 실패",
          description: data.error || data.message,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "API 호출 실패", description: errorMessage, variant: "destructive" });
      setReportResult({ success: false, error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  // API 자동 조회
  const fetchFromApi = async () => {
    setIsLoading(true);
    setReportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('coupang-daily-report', {
        body: { date: manualDate },
      });

      if (error) throw error;

      setReportResult(data);
      
      if (data.success) {
        toast({
          title: data.mode === 'api' ? 'API 조회 완료' : '처리 완료',
          description: `${data.totalRecords}건 조회, ${data.matchedIntents}건 매칭, ${data.tierChanges}건 등급 변동`,
        });
        loadRecentReports();
        loadStats();
      } else {
        toast({
          title: '조회 실패',
          description: data.error || data.message,
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'API 호출 실패', description: errorMessage, variant: 'destructive' });
      setReportResult({ success: false, error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API 자동 조회 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            쿠팡 일별 실적 API 조회
          </CardTitle>
          <CardDescription>
            쿠팡 파트너스 API를 통해 일별 실적을 자동으로 조회합니다.
            매일 오후 6시(KST)에 자동 실행되며, 수동으로도 실행할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-1 block">조회 날짜</label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchFromApi} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />조회 중...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />API 조회 실행</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            * 쿠팡 파트너스 계정에 일별 실적 API 권한이 있어야 합니다. 
            API 권한이 없는 경우 아래 수동 입력/엑셀 업로드를 이용하세요.
          </p>
        </CardContent>
      </Card>

      {/* 안내 배너 */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">수동 입력 모드</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                쿠팡 파트너스 대시보드에서 다운로드한 실적 리포트를 업로드하거나 수동으로 입력하세요.
                Sub ID(tracking_id)가 일치하는 구매 기록이 자동으로 확정 처리됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 레코드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              처리됨: {stats?.processed || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 GMV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalGmv || 0)}</div>
            <p className="text-xs text-muted-foreground">
              수수료: {formatCurrency(stats?.totalCommission || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 주문</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              취소: {stats?.totalCancels || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">일별 데이터</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats?.byDate || {}).length}</div>
            <p className="text-xs text-muted-foreground">일</p>
          </CardContent>
        </Card>
      </div>

      {/* 엑셀 업로드 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            엑셀 파일 업로드
          </CardTitle>
          <CardDescription>
            쿠팡 파트너스 대시보드에서 다운로드한 실적 리포트 엑셀 파일을 업로드하세요.
            필요한 컬럼: sub_id (또는 트래킹/lpinfo), order_count (또는 주문), gmv (또는 매출/금액)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelUpload}
              className="flex-1"
            />
          </div>
          
          {parsedRecords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{parsedRecords.length}건 파싱됨</Badge>
                <Button onClick={submitExcelRecords} disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />처리 중...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" />일괄 처리</>
                  )}
                </Button>
              </div>
              <div className="max-h-32 overflow-auto text-xs bg-muted p-2 rounded">
                {parsedRecords.slice(0, 5).map((r, i) => (
                  <div key={i}>
                    {r.report_date} | {r.sub_id.slice(0, 12)}... | 주문:{r.order_count} | GMV:{formatCurrency(r.gmv)}
                  </div>
                ))}
                {parsedRecords.length > 5 && <div>... 외 {parsedRecords.length - 5}건</div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 수동 입력 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            수동 입력
          </CardTitle>
          <CardDescription>
            개별 구매 건을 수동으로 입력하여 처리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">날짜</label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-sm font-medium mb-1 block">Sub ID (tracking_id) *</label>
              <Input
                placeholder="예: abc12345_xyz789"
                value={manualSubId}
                onChange={(e) => setManualSubId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">GMV (원) *</label>
              <Input
                placeholder="예: 50000"
                value={manualGmv}
                onChange={(e) => setManualGmv(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">주문 수</label>
              <Input
                type="number"
                min="0"
                value={manualOrderCount}
                onChange={(e) => setManualOrderCount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">취소 수</label>
              <Input
                type="number"
                min="0"
                value={manualCancelCount}
                onChange={(e) => setManualCancelCount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">수수료 (선택)</label>
              <Input
                placeholder="예: 2500"
                value={manualCommission}
                onChange={(e) => setManualCommission(e.target.value)}
              />
            </div>
          </div>
          
          <Button onClick={submitManualRecord} disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />처리 중...</>
            ) : (
              <><CheckCircle className="w-4 h-4 mr-2" />입력 처리</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 결과 표시 */}
      {reportResult && (
        <Card className={reportResult.success ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              {reportResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="font-semibold">
                {reportResult.success ? '처리 완료' : '처리 실패'}
              </span>
            </div>
            
            {reportResult.success ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">처리됨:</span>
                  <span className="ml-2 font-medium">{reportResult.processedRecords}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">매칭:</span>
                  <span className="ml-2 font-medium">{reportResult.matchedIntents}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">통계 업데이트:</span>
                  <span className="ml-2 font-medium">{reportResult.updatedStats}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">등급 변동:</span>
                  <span className="ml-2 font-medium">{reportResult.tierChanges}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-600">
                {reportResult.error || reportResult.message}
              </p>
            )}

            {reportResult.errors && reportResult.errors.length > 0 && (
              <div className="mt-2">
                <span className="text-sm text-muted-foreground">오류 ({reportResult.errors.length}건):</span>
                <ul className="text-xs text-red-500 mt-1 max-h-20 overflow-auto">
                  {reportResult.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {reportResult.errors.length > 5 && (
                    <li>... 외 {reportResult.errors.length - 5}건</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 최근 리포트 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              최근 리포트 데이터
            </span>
            <Button variant="outline" size="sm" onClick={loadRecentReports} disabled={reportsLoading}>
              {reportsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">날짜</th>
                    <th className="text-left py-2 px-2">Sub ID</th>
                    <th className="text-right py-2 px-2">클릭</th>
                    <th className="text-right py-2 px-2">주문</th>
                    <th className="text-right py-2 px-2">취소</th>
                    <th className="text-right py-2 px-2">GMV</th>
                    <th className="text-right py-2 px-2">수수료</th>
                    <th className="text-center py-2 px-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">{report.report_date}</td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {report.sub_id ? report.sub_id.slice(0, 12) + '...' : '-'}
                      </td>
                      <td className="text-right py-2 px-2">{report.click_count}</td>
                      <td className="text-right py-2 px-2">
                        {report.order_count > 0 && (
                          <Badge className="bg-green-500 hover:bg-green-600">{report.order_count}</Badge>
                        )}
                        {report.order_count === 0 && '-'}
                      </td>
                      <td className="text-right py-2 px-2">
                        {report.cancel_count > 0 && (
                          <Badge variant="destructive">{report.cancel_count}</Badge>
                        )}
                        {report.cancel_count === 0 && '-'}
                      </td>
                      <td className="text-right py-2 px-2">{formatCurrency(report.gmv)}</td>
                      <td className="text-right py-2 px-2">{formatCurrency(report.commission)}</td>
                      <td className="text-center py-2 px-2">
                        {report.processed ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">처리됨</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">대기</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>리포트 데이터가 없습니다.</p>
              <p className="text-sm">위에서 엑셀 파일을 업로드하거나 수동으로 입력해주세요.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
