import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  HeartPulse, Play, Loader2, CheckCircle, Trash2, RefreshCw, 
  AlertTriangle, Clock, Shield, History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RunSummary {
  totalChecked: number;
  totalDeleted: number;
  totalErrors: number;
  iterations: number;
  startedAt: Date;
  finishedAt?: Date;
  status: "idle" | "running" | "completed" | "error";
}

interface HealthCheckLog {
  id: string;
  run_type: string;
  checked_count: number;
  deleted_count: number;
  error_count: number;
  duration_seconds: number;
  created_at: string;
}

interface ProductHealthPanelProps {
  onStatsUpdate?: () => void;
}

export function ProductHealthPanel({ onStatsUpdate }: ProductHealthPanelProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<HealthCheckLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "manual" | "batch">("all");

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("health_check_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!error && data) setLogs(data as unknown as HealthCheckLog[]);
    } catch (e) {
      console.error("Failed to load health check logs:", e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const runBatchHealthCheck = useCallback(async () => {
    setIsRunning(true);
    const run: RunSummary = {
      totalChecked: 0,
      totalDeleted: 0,
      totalErrors: 0,
      iterations: 0,
      startedAt: new Date(),
      status: "running",
    };
    setSummary({ ...run });

    try {
      let hasMore = true;
      let offset = 0;

      while (hasMore && run.iterations < 20) {
        const { data, error } = await supabase.functions.invoke("product-health-check", {
          body: { batch: true, batchSize: 100, offset, maxIterations: 5, runType: "manual", startTime: run.startedAt.getTime() },
        });

        if (error) {
          run.totalErrors++;
          run.status = "error";
          setSummary({ ...run });
          toast({ title: "헬스체크 오류", description: error.message, variant: "destructive" });
          break;
        }

        run.totalChecked += data.checked || 0;
        run.totalDeleted += data.deleted || 0;
        run.iterations++;
        hasMore = data.hasMore;
        offset += (data.checked || 500);

        setSummary({ ...run });
      }

      if (run.status !== "error") {
        run.status = "completed";
        run.finishedAt = new Date();
      }
      setSummary({ ...run });

      if (run.status === "completed") {
        onStatsUpdate?.();
        // Reload logs to show the new entry
        setTimeout(() => loadLogs(), 2000);
        toast({
          title: "헬스체크 완료",
          description: `${run.totalChecked}개 검사, ${run.totalDeleted}개 품절 삭제`,
        });
      }
    } catch (err) {
      run.status = "error";
      run.finishedAt = new Date();
      setSummary({ ...run });
      toast({ title: "헬스체크 실패", description: String(err), variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  }, [toast, onStatsUpdate, loadLogs]);

  const elapsed = summary?.startedAt
    ? Math.round(((summary.finishedAt || new Date()).getTime() - summary.startedAt.getTime()) / 1000)
    : 0;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5" />
            상품 헬스체크
          </CardTitle>
          <CardDescription>
            품절/단종 상품을 감지하고 자동 삭제합니다. 매일 04:00 KST 자동 실행되며, 수동 실행도 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action Button */}
          <div className="flex items-center gap-3">
            <Button onClick={runBatchHealthCheck} disabled={isRunning} size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  검사 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  수동 헬스체크 실행
                </>
              )}
            </Button>
            {isRunning && summary && (
              <Badge variant="secondary" className="animate-pulse">
                🔄 {summary.iterations}회차 진행 중
              </Badge>
            )}
          </div>

          {/* Progress */}
          {summary && summary.status === "running" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>검사 진행 중... ({summary.iterations}/20 배치)</span>
                <span>{elapsed}초 경과</span>
              </div>
              <Progress value={(summary.iterations / 20) * 100} className="h-2" />
            </div>
          )}

          {/* Results */}
          {summary && summary.status !== "idle" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg text-center bg-card">
                <Shield className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{summary.totalChecked}</p>
                <p className="text-sm text-muted-foreground">검사 완료</p>
              </div>
              <div className="p-4 border rounded-lg text-center bg-card">
                <Trash2 className="w-6 h-6 mx-auto mb-2 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{summary.totalDeleted}</p>
                <p className="text-sm text-muted-foreground">품절 삭제</p>
              </div>
              <div className="p-4 border rounded-lg text-center bg-card">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-green-500">
                  {summary.totalChecked - summary.totalDeleted - summary.totalErrors}
                </p>
                <p className="text-sm text-muted-foreground">정상 상품</p>
              </div>
              <div className="p-4 border rounded-lg text-center bg-card">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold text-yellow-500">{summary.totalErrors}</p>
                <p className="text-sm text-muted-foreground">검사 실패</p>
              </div>
            </div>
          )}

          {/* Completion Info */}
          {summary?.status === "completed" && (
            <div className="p-4 border rounded-lg bg-green-500/10 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">헬스체크 완료</p>
                <p className="text-sm text-muted-foreground">
                  총 {summary.totalChecked}개 검사 · {summary.totalDeleted}개 삭제 · {summary.iterations}회 배치 · {elapsed}초 소요
                </p>
              </div>
            </div>
          )}

          {summary?.status === "error" && (
            <div className="p-4 border rounded-lg bg-destructive/10 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">헬스체크 중 오류 발생</p>
                <p className="text-sm text-muted-foreground">
                  {summary.totalChecked}개 검사 후 중단 · {summary.totalDeleted}개 삭제됨
                </p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              자동 실행 스케줄
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 매일 04:00 KST (19:00 UTC) — pg_cron 배치로 전체 상품 URL 검사</li>
              <li>• 구매 클릭 시 — 실시간 단건 URL 유효성 검증 (Layer 2)</li>
              <li>• 판정 기준: HTTP 404, 410, 5xx → 즉시 삭제 / 403 → 정상 (봇 차단 오탐 방지)</li>
            </ul>
          </div>

          {!summary && (
            <div className="text-center py-8 text-muted-foreground">
              <HeartPulse className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>"수동 헬스체크 실행" 버튼을 눌러 품절 상품을 검사하세요.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              실행 이력
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadLogs} disabled={logsLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${logsLoading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {(["all", "manual", "batch"] as const).map((f) => (
              <Button
                key={f}
                variant={logFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setLogFilter(f)}
              >
                {f === "all" ? "전체" : f === "manual" ? "수동" : "자동"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const filteredLogs = logFilter === "all" ? logs : logs.filter(l => l.run_type === logFilter);
            return filteredLogs.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-3 text-left">실행 시각</th>
                      <th className="p-3 text-left">유형</th>
                      <th className="p-3 text-right">검사 수</th>
                      <th className="p-3 text-right">삭제 수</th>
                      <th className="p-3 text-right">에러</th>
                      <th className="p-3 text-right">소요 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="border-t hover:bg-muted/50">
                        <td className="p-3 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="p-3">
                          <Badge variant={log.run_type === "manual" ? "default" : "secondary"}>
                            {log.run_type === "manual" ? "수동" : "자동"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium">{log.checked_count.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          {log.deleted_count > 0 ? (
                            <span className="text-destructive font-medium">{log.deleted_count}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {log.error_count > 0 ? (
                            <span className="text-yellow-500 font-medium">{log.error_count}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {log.duration_seconds}초
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>{logFilter === "all" ? "아직 실행 이력이 없습니다." : `${logFilter === "manual" ? "수동" : "자동"} 실행 이력이 없습니다.`}</p>
            </div>
          );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
