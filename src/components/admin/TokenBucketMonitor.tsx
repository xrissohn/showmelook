import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Zap, AlertTriangle, CheckCircle2, Gauge, Timer, TrendingUp, Activity } from "lucide-react";

interface TokenBucketState {
  id: string;
  tokens: number;
  max_tokens: number;
  refill_rate: number;
  last_refill_at: string;
  backoff_until: string | null;
  consecutive_failures: number;
  consecutive_successes: number;
  total_requests_today: number;
  total_rate_limits_today: number;
  last_reset_date: string;
  updated_at: string;
}

export const TokenBucketMonitor = () => {
  const [state, setState] = useState<TokenBucketState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);

  const loadState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rate_limit_state')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error) throw error;
      
      setState(data as unknown as TokenBucketState);
      
      // 실시간 토큰 추정 (리필 반영)
      if (data) {
        const now = Date.now();
        const lastRefillMs = new Date(data.last_refill_at).getTime();
        const elapsedSec = (now - lastRefillMs) / 1000;
        const estimatedTokens = Math.min(
          Number(data.tokens) + elapsedSec * Number(data.refill_rate),
          Number(data.max_tokens)
        );
        setEstimatedTokens(estimatedTokens);
      }
    } catch (err) {
      console.error('Failed to load token bucket state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    
    let interval: number | undefined;
    if (autoRefresh) {
      interval = window.setInterval(loadState, 2000); // 2초마다 갱신
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loadState, autoRefresh]);

  // 실시간 토큰 추정 업데이트 (더 빈번하게)
  useEffect(() => {
    if (!state) return;
    
    const updateEstimate = () => {
      const now = Date.now();
      const lastRefillMs = new Date(state.last_refill_at).getTime();
      const elapsedSec = (now - lastRefillMs) / 1000;
      const estimated = Math.min(
        Number(state.tokens) + elapsedSec * Number(state.refill_rate),
        Number(state.max_tokens)
      );
      setEstimatedTokens(estimated);
    };
    
    const interval = window.setInterval(updateEstimate, 100); // 100ms마다
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR');
  };

  const getBackoffRemaining = () => {
    if (!state?.backoff_until) return null;
    const backoffMs = new Date(state.backoff_until).getTime() - Date.now();
    if (backoffMs <= 0) return null;
    return Math.ceil(backoffMs / 1000);
  };

  const backoffRemaining = getBackoffRemaining();
  const isInBackoff = backoffRemaining !== null && backoffRemaining > 0;
  const tokenPercentage = state ? (estimatedTokens / state.max_tokens) * 100 : 0;
  const successRate = state && state.total_requests_today > 0
    ? ((state.total_requests_today - state.total_rate_limits_today) / state.total_requests_today * 100).toFixed(1)
    : '100';

  if (isLoading && !state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            Token Bucket 모니터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">로딩 중...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 메인 상태 카드 */}
      <Card className={isInBackoff ? 'border-destructive' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Token Bucket Rate Limiter
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'text-primary' : 'text-muted-foreground'}
              >
                <Activity className="w-4 h-4 mr-1" />
                {autoRefresh ? '자동 갱신 중' : '수동'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadState}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            실시간 API Rate Limit 상태 모니터링
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 백오프 경고 */}
          {isInBackoff && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Rate Limit 백오프 중</p>
                <p className="text-sm text-muted-foreground">
                  {backoffRemaining}초 후 재시작 • 연속 실패: {state?.consecutive_failures}회
                </p>
              </div>
            </div>
          )}

          {/* 토큰 게이지 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                사용 가능 토큰
              </span>
              <span className="text-2xl font-bold">
                {estimatedTokens.toFixed(1)} / {state?.max_tokens}
              </span>
            </div>
            <Progress 
              value={tokenPercentage} 
              className={`h-4 ${tokenPercentage < 20 ? '[&>div]:bg-destructive' : tokenPercentage < 50 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>리필 속도: {state?.refill_rate} 토큰/초</span>
              <span>마지막 업데이트: {state ? formatTime(state.updated_at) : '-'}</span>
            </div>
          </div>

          {/* 통계 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">{state?.total_requests_today || 0}</div>
              <div className="text-xs text-muted-foreground">오늘 총 요청</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-destructive">{state?.total_rate_limits_today || 0}</div>
              <div className="text-xs text-muted-foreground">오늘 Rate Limit</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{successRate}%</div>
              <div className="text-xs text-muted-foreground">성공률</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                {state?.consecutive_failures && state.consecutive_failures > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">{state.consecutive_failures}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">{state?.consecutive_successes || 0}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {state?.consecutive_failures && state.consecutive_failures > 0 ? '연속 실패' : '연속 성공'}
              </div>
            </div>
          </div>

          {/* 상태 배지들 */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={isInBackoff ? 'destructive' : 'default'}>
              {isInBackoff ? '백오프 중' : '정상'}
            </Badge>
            <Badge variant="outline">
              <Timer className="w-3 h-3 mr-1" />
              {((state?.max_tokens || 30) / (state?.refill_rate || 10)).toFixed(1)}초 풀 충전
            </Badge>
            <Badge variant="outline">
              <TrendingUp className="w-3 h-3 mr-1" />
              {((state?.refill_rate || 10) * 60).toFixed(0)} RPM 최대
            </Badge>
            {state?.consecutive_successes && state.consecutive_successes >= 5 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                회복 중
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
