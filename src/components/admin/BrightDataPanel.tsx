import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Download, Play, Database, Globe, Clock, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fetchAllRows } from "@/lib/paginatedFetch";

interface DatasetItem {
  id: string;
  name: string;
  size?: number;
}

interface SnapshotItem {
  id?: string;
  snapshot_id?: string;
  status?: string;
  created_at?: string;
  records_count?: number;
  [key: string]: unknown;
}

interface FetchResult {
  success: boolean;
  total_in_snapshot?: number;
  processed?: number;
  registered?: number;
  failed?: number;
  skipped?: number;
  error?: string;
}

export const BrightDataPanel = () => {
  const { toast } = useToast();

  // Dataset list
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);

  // Snapshots
  const [datasetId, setDatasetId] = useState("");
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsRaw, setSnapshotsRaw] = useState<string | null>(null);

  // Fetch snapshot
  const [snapshotId, setSnapshotId] = useState("");
  const [fetchLimit, setFetchLimit] = useState(100);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);

  // Collection stats
  const [collectionStats, setCollectionStats] = useState<Array<{
    merchant_id: string;
    count: number;
    last_collected: string;
  }> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Daily product log
  const [dailyLog, setDailyLog] = useState<Array<{
    date: string;
    new_count: number;
    updated_count: number;
    by_merchant: Record<string, number>;
  }> | null>(null);
  const [dailyLogLoading, setDailyLogLoading] = useState(false);
  const [dailyLogDays, setDailyLogDays] = useState(30);

  const loadDatasets = async () => {
    setDatasetsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brightdata-fetch", {
        body: { action: "dataset_list" },
      });
      if (error) throw error;
      if (data?.datasets) {
        setDatasets(data.datasets);
      } else if (data?.error) {
        throw new Error(data.error);
      }
      toast({ title: "데이터셋 목록 조회 완료", description: `${data?.datasets?.length || 0}개 데이터셋` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "데이터셋 목록 조회 실패", description: msg, variant: "destructive" });
    } finally {
      setDatasetsLoading(false);
    }
  };

  const loadSnapshots = async () => {
    if (!datasetId.trim()) {
      toast({ title: "dataset_id를 입력해주세요", variant: "destructive" });
      return;
    }
    setSnapshotsLoading(true);
    setSnapshotsRaw(null);
    try {
      const { data, error } = await supabase.functions.invoke("brightdata-fetch", {
        body: { action: "list_snapshots", dataset_id: datasetId.trim() },
      });
      if (error) throw error;
      setSnapshots(data?.snapshots || []);
      setSnapshotsRaw(data?.raw_response || null);
      toast({ title: "스냅샷 조회 완료", description: `${data?.snapshots?.length || 0}개 스냅샷` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "스냅샷 조회 실패", description: msg, variant: "destructive" });
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const fetchSnapshot = async (sid?: string) => {
    const targetId = sid || snapshotId.trim();
    if (!targetId) {
      toast({ title: "snapshot_id를 입력해주세요", variant: "destructive" });
      return;
    }
    setFetchLoading(true);
    setFetchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("brightdata-fetch", {
        body: { action: "fetch_snapshot", snapshot_id: targetId, limit: fetchLimit },
      });
      if (error) throw error;
      setFetchResult(data);
      if (data?.success) {
        toast({ title: "스냅샷 수집 완료", description: `등록: ${data.registered}건, 실패: ${data.failed}건` });
      } else {
        toast({ title: "수집 실패", description: data?.error, variant: "destructive" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "스냅샷 수집 실패", description: msg, variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  const loadCollectionStats = async () => {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products_cache")
        .select("merchant_id, collected_at")
        .not("merchant_id", "is", null)
        .order("collected_at", { ascending: false });

      if (error) throw error;

      const statsMap: Record<string, { count: number; last_collected: string }> = {};
      for (const row of data || []) {
        const mid = row.merchant_id || "unknown";
        if (!statsMap[mid]) {
          statsMap[mid] = { count: 0, last_collected: row.collected_at || "" };
        }
        statsMap[mid].count++;
      }

      const stats = Object.entries(statsMap)
        .map(([merchant_id, s]) => ({ merchant_id, count: s.count, last_collected: s.last_collected }))
        .sort((a, b) => b.count - a.count);

      setCollectionStats(stats);
      toast({ title: "수집 현황 조회 완료" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "수집 현황 조회 실패", description: msg, variant: "destructive" });
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch {
      return d;
    }
  };

  const loadDailyLog = async () => {
    setDailyLogLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - dailyLogDays);
      const sinceStr = since.toISOString();

      const allRows = await fetchAllRows<{
        collected_at: string | null;
        updated_at: string | null;
        merchant_id: string | null;
      }>(
        'products_cache',
        'collected_at, updated_at, merchant_id',
        (q) => q.or(`collected_at.gte.${sinceStr},updated_at.gte.${sinceStr}`)
      );

      const newMap: Record<string, { new_count: number; updated_count: number; by_merchant: Record<string, number> }> = {};

      const toDateKey = (d: string) => d.slice(0, 10);

      for (const row of allRows) {
        const collDate = row.collected_at ? toDateKey(row.collected_at) : null;
        const updDate = row.updated_at ? toDateKey(row.updated_at) : null;
        const mid = row.merchant_id || 'unknown';

        if (collDate && collDate >= sinceStr.slice(0, 10)) {
          if (!newMap[collDate]) newMap[collDate] = { new_count: 0, updated_count: 0, by_merchant: {} };
          newMap[collDate].new_count++;
          newMap[collDate].by_merchant[mid] = (newMap[collDate].by_merchant[mid] || 0) + 1;
        }

        if (updDate && updDate >= sinceStr.slice(0, 10) && updDate !== collDate) {
          if (!newMap[updDate]) newMap[updDate] = { new_count: 0, updated_count: 0, by_merchant: {} };
          newMap[updDate].updated_count++;
        }
      }

      const sorted = Object.entries(newMap)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setDailyLog(sorted);
      toast({ title: "일별 상품 로그 조회 완료", description: `${sorted.length}일간 데이터` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "일별 로그 조회 실패", description: msg, variant: "destructive" });
    } finally {
      setDailyLogLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Dataset List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bright Data 데이터셋 목록
          </CardTitle>
          <CardDescription>
            계정에 연결된 모든 데이터셋/뷰 ID를 확인합니다. (marketplace + custom)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={loadDatasets} disabled={datasetsLoading} variant="outline">
            {datasetsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            데이터셋 목록 조회
          </Button>

          {datasets.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">ID</th>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-right p-2 font-medium">Size</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) => (
                    <tr key={ds.id} className="border-t hover:bg-muted/50">
                      <td className="p-2 font-mono text-xs">{ds.id}</td>
                      <td className="p-2">{ds.name}</td>
                      <td className="p-2 text-right">{ds.size?.toLocaleString() || "-"}</td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDatasetId(ds.id);
                            toast({ title: "dataset_id 설정됨", description: ds.id });
                          }}
                        >
                          선택
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Snapshot List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            스냅샷 조회
          </CardTitle>
          <CardDescription>
            특정 dataset_id의 스냅샷 목록을 확인하고 데이터를 가져옵니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="dataset_id 입력 (예: gd_xxx...)"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="font-mono text-sm"
            />
            <Button onClick={loadSnapshots} disabled={snapshotsLoading} variant="outline">
              {snapshotsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              조회
            </Button>
          </div>

          {snapshotsRaw && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw API Response</summary>
              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto max-h-40">{snapshotsRaw}</pre>
            </details>
          )}

          {snapshots.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Snapshot ID</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-right p-2 font-medium">Records</th>
                    <th className="text-left p-2 font-medium">Created</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snap, i) => {
                    const sid = snap.id || snap.snapshot_id || `snap-${i}`;
                    return (
                      <tr key={sid} className="border-t hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{sid}</td>
                        <td className="p-2">
                          <Badge variant={snap.status === "ready" ? "default" : "secondary"}>
                            {snap.status || "unknown"}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">{snap.records_count?.toLocaleString() || "-"}</td>
                        <td className="p-2 text-xs">{formatDate(snap.created_at || "")}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSnapshotId(sid);
                              fetchSnapshot(sid);
                            }}
                            disabled={fetchLoading}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            수집
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Manual Snapshot Fetch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            수동 스냅샷 수집
          </CardTitle>
          <CardDescription>
            snapshot_id를 직접 입력하여 상품 데이터를 가져옵니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="snapshot_id 입력"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="font-mono text-sm flex-1"
            />
            <Input
              type="number"
              placeholder="Limit"
              value={fetchLimit}
              onChange={(e) => setFetchLimit(parseInt(e.target.value) || 100)}
              className="w-24"
            />
            <Button onClick={() => fetchSnapshot()} disabled={fetchLoading}>
              {fetchLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              수집 실행
            </Button>
          </div>

          {fetchResult && (
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={fetchResult.success ? "default" : "destructive"}>
                  {fetchResult.success ? "성공" : "실패"}
                </Badge>
              </div>
              {fetchResult.success ? (
                <>
                  <p>스냅샷 총 상품: <strong>{fetchResult.total_in_snapshot?.toLocaleString()}</strong></p>
                  <p>처리: <strong>{fetchResult.processed?.toLocaleString()}</strong></p>
                  <p>등록 성공: <strong className="text-primary">{fetchResult.registered?.toLocaleString()}</strong></p>
                  <p>실패: <strong className="text-destructive">{fetchResult.failed?.toLocaleString()}</strong></p>
                  <p>스킵: <strong className="text-muted-foreground">{fetchResult.skipped?.toLocaleString()}</strong></p>
                </>
              ) : (
                <p className="text-destructive">{fetchResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Collection Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            머천트별 수집 현황
          </CardTitle>
          <CardDescription>
            products_cache 기준 머천트별 상품 수와 최근 수집 시각을 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={loadCollectionStats} disabled={statsLoading} variant="outline">
            {statsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            현황 조회
          </Button>

          {collectionStats && (
            <div className="border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">머천트</th>
                    <th className="text-right p-2 font-medium">상품 수</th>
                    <th className="text-left p-2 font-medium">최근 수집</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionStats.map((s) => (
                    <tr key={s.merchant_id} className="border-t">
                      <td className="p-2 font-medium">{s.merchant_id}</td>
                      <td className="p-2 text-right">{s.count.toLocaleString()}</td>
                      <td className="p-2 text-xs text-muted-foreground">{formatDate(s.last_collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Daily Product Update Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            일별 상품 업데이트 이력
          </CardTitle>
          <CardDescription>
            날짜별 신규 등록 및 업데이트된 상품 수를 머천트별로 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center">
            <Select value={String(dailyLogDays)} onValueChange={(v) => setDailyLogDays(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">최근 7일</SelectItem>
                <SelectItem value="14">최근 14일</SelectItem>
                <SelectItem value="30">최근 30일</SelectItem>
                <SelectItem value="90">최근 90일</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadDailyLog} disabled={dailyLogLoading} variant="outline">
              {dailyLogLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              조회
            </Button>
          </div>

          {dailyLog && dailyLog.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xl font-bold text-primary">
                    {dailyLog.reduce((s, d) => s + d.new_count, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">총 신규 등록</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xl font-bold">
                    {dailyLog.reduce((s, d) => s + d.updated_count, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">총 업데이트</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xl font-bold">
                    {dailyLog.length}
                  </p>
                  <p className="text-xs text-muted-foreground">활동일 수</p>
                </div>
              </div>

              {/* Bar Chart - by merchant */}
              {(() => {
                const MERCHANT_COLORS = [
                  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
                  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
                ];
                const allMerchants = Array.from(
                  new Set(dailyLog.flatMap((r) => Object.keys(r.by_merchant)))
                );
                const chartData = [...dailyLog].reverse().map((row) => {
                  const entry: Record<string, unknown> = {
                    date: row.date,
                    updated_count: row.updated_count,
                  };
                  allMerchants.forEach((m) => {
                    entry[m] = row.by_merchant[m] || 0;
                  });
                  return entry;
                });
                return (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: string) => v.slice(5)}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ fontWeight: 600 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {allMerchants.map((m, i) => (
                          <Bar
                            key={m}
                            dataKey={m}
                            name={m}
                            stackId="merchants"
                            fill={MERCHANT_COLORS[i % MERCHANT_COLORS.length]}
                            radius={i === allMerchants.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                        <Bar dataKey="updated_count" name="업데이트" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Daily table */}
              <div className="max-h-[500px] overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">날짜</th>
                      <th className="text-right p-2 font-medium">신규</th>
                      <th className="text-right p-2 font-medium">업데이트</th>
                      <th className="text-left p-2 font-medium">머천트별 신규</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyLog.map((row) => (
                      <tr key={row.date} className="border-t hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{row.date}</td>
                        <td className="p-2 text-right font-medium text-primary">{row.new_count.toLocaleString()}</td>
                        <td className="p-2 text-right text-muted-foreground">{row.updated_count.toLocaleString()}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.by_merchant)
                              .sort((a, b) => b[1] - a[1])
                              .map(([mid, cnt]) => (
                                <Badge key={mid} variant="outline" className="text-xs">
                                  {mid}: {cnt}
                                </Badge>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {dailyLog && dailyLog.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">해당 기간에 상품 변동이 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
