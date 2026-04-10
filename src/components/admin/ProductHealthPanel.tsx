import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  HeartPulse, Play, Loader2, CheckCircle, Trash2, RefreshCw, 
  AlertTriangle, Clock, Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BatchResult {
  checked: number;
  deleted: number;
  alive: number;
  errors: number;
  hasMore: boolean;
  remaining: number;
  chainIteration?: number;
}

interface RunSummary {
  totalChecked: number;
  totalDeleted: number;
  totalErrors: number;
  iterations: number;
  startedAt: Date;
  finishedAt?: Date;
  status: "idle" | "running" | "completed" | "error";
}

interface ProductHealthPanelProps {
  onStatsUpdate?: () => void;
}

export function ProductHealthPanel({ onStatsUpdate }: ProductHealthPanelProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<RunSummary | null>(null);

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
          body: { batch: true, batchSize: 100, offset, maxIterations: 5 },
        });

        if (error) {
          run.totalErrors++;
          run.status = "error";
          setSummary({ ...run });
          toast({ title: "헬스체크 오류", description: error.message, variant: "destructive" });
          break;
        }

        const result = data as BatchResult;
        run.totalChecked += result.checked || 0;
        run.totalDeleted += result.deleted || 0;
        run.totalErrors += result.errors || 0;
        run.iterations++;
        hasMore = result.hasMore;
        offset += (result.checked || 500);

        setSummary({ ...run });
      }

      if (run.status !== "error") {
        run.status = "completed";
        run.finishedAt = new Date();
      }
      setSummary({ ...run });
      setLastRunResult({ ...run });

      if (run.status === "completed") {
        onStatsUpdate?.();
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
  }, [toast]);

  const elapsed = summary?.startedAt
    ? Math.round(((summary.finishedAt || new Date()).getTime() - summary.startedAt.getTime()) / 1000)
    : 0;

  return (
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
              <p className="font-medium text-green-700 dark:text-green-400">
                헬스체크 완료
              </p>
              <p className="text-sm text-muted-foreground">
                총 {summary.totalChecked}개 상품 검사 완료 · {summary.totalDeleted}개 품절 삭제 · {summary.iterations}회 배치 · {elapsed}초 소요
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

        {/* No results yet */}
        {!summary && (
          <div className="text-center py-8 text-muted-foreground">
            <HeartPulse className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>"수동 헬스체크 실행" 버튼을 눌러 품절 상품을 검사하세요.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
