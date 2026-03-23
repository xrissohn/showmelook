import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, RefreshCw, CheckCircle, XCircle, Clock, ShoppingCart,
  TrendingUp, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PurchaseIntent {
  id: string;
  user_id: string;
  tracking_id: string;
  merchant_id: string | null;
  product_name: string | null;
  product_price: number | null;
  product_url: string | null;
  status: string;
  order_id: string | null;
  actual_amount: number | null;
  commission: number | null;
  confirmation_status: string | null;
  clicked_at: string;
  purchased_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
}

interface ReportStats {
  totalClicks: number;
  totalPurchased: number;
  totalCancelled: number;
  totalPending: number;
  totalGmv: number;
  totalCommission: number;
  conversionRate: number;
}

export function LinkPriceReportPanel() {
  const { toast } = useToast();
  const [intents, setIntents] = useState<PurchaseIntent[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch purchase_intents for linkprice (exclude coupang merchant_id)
      const { data, error } = await supabase
        .from("purchase_intents")
        .select("*")
        .neq("merchant_id", "coupang")
        .gte("clicked_at", `${dateFrom}T00:00:00`)
        .lte("clicked_at", `${dateTo}T23:59:59`)
        .order("clicked_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const rows = (data || []) as PurchaseIntent[];
      setIntents(rows);

      const purchased = rows.filter((r) => r.status === "purchased");
      const cancelled = rows.filter((r) => r.status === "cancelled");
      const pending = rows.filter((r) => r.status === "pending");

      setStats({
        totalClicks: rows.length,
        totalPurchased: purchased.length,
        totalCancelled: cancelled.length,
        totalPending: pending.length,
        totalGmv: purchased.reduce((s, r) => s + (r.actual_amount || r.product_price || 0), 0),
        totalCommission: purchased.reduce((s, r) => s + (r.commission ? Number(r.commission) : 0), 0),
        conversionRate: rows.length > 0 ? (purchased.length / rows.length) * 100 : 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "로드 실패", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statusBadge = (status: string, confirmStatus: string | null) => {
    if (status === "purchased") {
      if (confirmStatus === "rolled_back")
        return <Badge variant="destructive">환불</Badge>;
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">구매확정</Badge>;
    }
    if (status === "cancelled")
      return <Badge variant="destructive">취소</Badge>;
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />대기</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            링크프라이스 판매 리포트
          </CardTitle>
          <CardDescription>
            링크프라이스 제휴 딥링크를 통한 클릭 및 구매 내역을 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-1 block">시작일</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">종료일</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={loadData} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />조회 중...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />조회</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 클릭</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClicks}</div>
              <p className="text-xs text-muted-foreground">
                전환율: {stats.conversionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">구매 확정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                {stats.totalPurchased}
              </div>
              <p className="text-xs text-muted-foreground">
                대기: {stats.totalPending} / 취소: {stats.totalCancelled}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 매출(GMV)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalGmv)}</div>
              <p className="text-xs text-muted-foreground">
                확정 건 기준
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">수수료</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalCommission)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalGmv > 0
                  ? `수수료율: ${((stats.totalCommission / stats.totalGmv) * 100).toFixed(1)}%`
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            클릭/구매 내역 ({intents.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : intents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              해당 기간에 데이터가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">날짜</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead>머천트</TableHead>
                    <TableHead className="text-right">상품가격</TableHead>
                    <TableHead className="text-right">실구매액</TableHead>
                    <TableHead className="text-right">수수료</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>주문번호</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intents.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(row.clicked_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {row.product_url ? (
                          <a
                            href={row.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-primary"
                          >
                            {row.product_name || "상품명 없음"}
                          </a>
                        ) : (
                          row.product_name || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.merchant_id || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.product_price ? formatCurrency(row.product_price) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {row.actual_amount ? formatCurrency(row.actual_amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.commission ? formatCurrency(Number(row.commission)) : "-"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(row.status, row.confirmation_status)}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[120px] truncate">
                        {row.tracking_id?.slice(0, 16)}...
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.order_id || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
