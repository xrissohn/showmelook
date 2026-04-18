import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Crosshair, MoveHorizontal, MoveVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchAllRows } from "@/lib/paginatedFetch";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

interface CorrectionRow {
  category: string;
  ai_x: number;
  ai_y: number;
  manual_x: number;
  manual_y: number;
  created_at: string;
}

interface CategoryStat {
  category: string;
  count: number;
  avgDx: number;
  avgDy: number;
  absDx: number;
  absDy: number;
  magnitude: number;
}

const formatDelta = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export const TagCorrectionAnalytics = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllRows<CorrectionRow>(
        "tag_corrections",
        "category, ai_x, ai_y, manual_x, manual_y, created_at",
        (q) => q.order("created_at", { ascending: false }),
      );
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "데이터 로드 실패", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats: CategoryStat[] = useMemo(() => {
    const map = new Map<string, CorrectionRow[]>();
    rows.forEach((r) => {
      const cat = r.category || "기타";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    });

    return Array.from(map.entries())
      .map(([category, items]) => {
        const dxs = items.map((i) => Number(i.manual_x) - Number(i.ai_x));
        const dys = items.map((i) => Number(i.manual_y) - Number(i.ai_y));
        const avgDx = dxs.reduce((a, b) => a + b, 0) / dxs.length;
        const avgDy = dys.reduce((a, b) => a + b, 0) / dys.length;
        const absDx = dxs.reduce((a, b) => a + Math.abs(b), 0) / dxs.length;
        const absDy = dys.reduce((a, b) => a + Math.abs(b), 0) / dys.length;
        return {
          category,
          count: items.length,
          avgDx,
          avgDy,
          absDx,
          absDy,
          magnitude: Math.sqrt(avgDx * avgDx + avgDy * avgDy),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const totals = useMemo(() => {
    if (rows.length === 0) {
      return { count: 0, avgAbsDx: 0, avgAbsDy: 0, worstCategory: "-" };
    }
    const dxs = rows.map((r) => Math.abs(Number(r.manual_x) - Number(r.ai_x)));
    const dys = rows.map((r) => Math.abs(Number(r.manual_y) - Number(r.ai_y)));
    const avgAbsDx = dxs.reduce((a, b) => a + b, 0) / dxs.length;
    const avgAbsDy = dys.reduce((a, b) => a + b, 0) / dys.length;
    const worst = [...stats].sort((a, b) => b.magnitude - a.magnitude)[0];
    return {
      count: rows.length,
      avgAbsDx,
      avgAbsDy,
      worstCategory: worst ? worst.category : "-",
    };
  }, [rows, stats]);

  const chartData = stats.map((s) => ({
    category: s.category,
    "ΔX (좌우)": Number(s.avgDx.toFixed(2)),
    "ΔY (상하)": Number(s.avgDy.toFixed(2)),
    count: s.count,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crosshair className="w-5 h-5" />
              태그 위치 보정 학습 분석
            </CardTitle>
            <CardDescription>
              사용자가 수동으로 태그를 옮긴 데이터를 기반으로 AI 예측 위치의 카테고리별 평균 오차를
              시각화합니다. 값은 이미지 너비/높이 대비 % 단위입니다.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            새로고침
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">총 보정 데이터</div>
                <div className="text-2xl font-bold">{totals.count.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MoveHorizontal className="w-3 h-3" />
                  평균 |ΔX|
                </div>
                <div className="text-2xl font-bold">{totals.avgAbsDx.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MoveVertical className="w-3 h-3" />
                  평균 |ΔY|
                </div>
                <div className="text-2xl font-bold">{totals.avgAbsDy.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">가장 큰 오차 카테고리</div>
                <div className="text-2xl font-bold truncate">{totals.worstCategory}</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
              아직 보정 데이터가 없습니다.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="category" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    label={{
                      value: "평균 보정량 (%)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                    }}
                    formatter={(value: number, name: string) => [
                      `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="ΔX (좌우)" fill="hsl(var(--primary))" />
                  <Bar dataKey="ΔY (상하)" fill="hsl(var(--accent-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detail table */}
          {stats.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">카테고리</th>
                    <th className="py-2 px-2 font-medium text-right">데이터 수</th>
                    <th className="py-2 px-2 font-medium text-right">평균 ΔX</th>
                    <th className="py-2 px-2 font-medium text-right">평균 ΔY</th>
                    <th className="py-2 px-2 font-medium text-right">|ΔX|</th>
                    <th className="py-2 px-2 font-medium text-right">|ΔY|</th>
                    <th className="py-2 px-2 font-medium text-right">크기</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.category} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{s.category}</td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="secondary">{s.count}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatDelta(s.avgDx)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatDelta(s.avgDy)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {s.absDx.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {s.absDy.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">
                        {s.magnitude.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            ΔX/ΔY = 사용자가 옮긴 위치(manual) − AI 예측 위치(ai). 양수면 AI가 왼쪽/위쪽에 너무
            붙였다는 뜻이고, 음수면 오른쪽/아래쪽으로 치우쳤다는 뜻입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TagCorrectionAnalytics;
