import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { RefreshCw, Clock, Zap, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/paginatedFetch";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, LineChart, Line, ComposedChart, Area
} from "recharts";

interface InferenceMetric {
  id: string;
  created_at: string;
  stage1_model: string;
  stage2_model: string;
  stage1_time_ms: number | null;
  stage2_time_ms: number | null;
  total_time_ms: number | null;
  stage1_success: boolean;
  stage2_success: boolean;
  used_fallback: boolean;
  fallback_reason: string | null;
  occasion: string | null;
  concepts: string[] | null;
  product_count: number | null;
}

interface ModelConfig {
  id: string;
  model_name: string;
  is_active: boolean;
  priority: number;
  updated_at: string;
}

interface ModelStats {
  model: string;
  requests: number;
  avgTime: number;
  successRate: number;
  stage: 'stage1' | 'stage2';
}

const MODEL_OPTIONS = {
  stage1: [
    { value: 'openai/gpt-5-mini', label: 'GPT-5-mini (기본)' },
    { value: 'openai/gpt-5-nano', label: 'GPT-5-nano (빠름/저렴)' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  ],
  stage2: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (기본)' },
    { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5-mini' },
  ],
};

export const InferenceMetricsPanel = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<InferenceMetric[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 시간 범위 계산
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // 메트릭 조회 (전체 - 페이지네이션)
      const metricsData = await fetchAllRows<InferenceMetric>(
        'inference_metrics', '*',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q: any) => q
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
      );
      setMetrics(metricsData);

      // 모델 설정 조회
      const { data: configData, error: configError } = await supabase
        .from('model_config')
        .select('*')
        .order('priority');

      if (configError) throw configError;
      setModelConfigs((configData as ModelConfig[]) || []);
    } catch (error) {
      console.error('Failed to load inference metrics:', error);
      toast({
        title: "로드 실패",
        description: "추론 성능 데이터를 불러오지 못했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateModelConfig = async (id: string, modelName: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('model_config')
        .update({ 
          model_name: modelName, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "모델 변경 완료",
        description: `${id} 모델이 ${modelName}으로 변경되었습니다.`,
      });
      loadData();
    } catch (error) {
      console.error('Failed to update model config:', error);
      toast({
        title: "변경 실패",
        description: "모델 설정을 변경하지 못했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 통계 계산
  const stats = {
    totalRequests: metrics.length,
    stage1Success: metrics.filter(m => m.stage1_success).length,
    stage2Success: metrics.filter(m => m.stage2_success).length,
    fallbackUsed: metrics.filter(m => m.used_fallback).length,
    avgStage1Time: metrics.filter(m => m.stage1_time_ms)
      .reduce((sum, m) => sum + (m.stage1_time_ms || 0), 0) / Math.max(1, metrics.filter(m => m.stage1_time_ms).length),
    avgStage2Time: metrics.filter(m => m.stage2_time_ms)
      .reduce((sum, m) => sum + (m.stage2_time_ms || 0), 0) / Math.max(1, metrics.filter(m => m.stage2_time_ms).length),
    avgTotalTime: metrics.filter(m => m.total_time_ms)
      .reduce((sum, m) => sum + (m.total_time_ms || 0), 0) / Math.max(1, metrics.filter(m => m.total_time_ms).length),
  };

  // 모델별 통계
  const modelStats: ModelStats[] = [];
  const stage1Models = new Map<string, { requests: number; totalTime: number; success: number }>();
  const stage2Models = new Map<string, { requests: number; totalTime: number; success: number }>();

  metrics.forEach(m => {
    // Stage 1
    const s1 = stage1Models.get(m.stage1_model) || { requests: 0, totalTime: 0, success: 0 };
    s1.requests++;
    s1.totalTime += m.stage1_time_ms || 0;
    if (m.stage1_success) s1.success++;
    stage1Models.set(m.stage1_model, s1);

    // Stage 2
    const s2 = stage2Models.get(m.stage2_model) || { requests: 0, totalTime: 0, success: 0 };
    s2.requests++;
    s2.totalTime += m.stage2_time_ms || 0;
    if (m.stage2_success) s2.success++;
    stage2Models.set(m.stage2_model, s2);
  });

  stage1Models.forEach((data, model) => {
    modelStats.push({
      model,
      stage: 'stage1',
      requests: data.requests,
      avgTime: Math.round(data.totalTime / data.requests),
      successRate: Math.round((data.success / data.requests) * 100),
    });
  });

  stage2Models.forEach((data, model) => {
    modelStats.push({
      model,
      stage: 'stage2',
      requests: data.requests,
      avgTime: Math.round(data.totalTime / data.requests),
      successRate: Math.round((data.success / data.requests) * 100),
    });
  });

  // 시간대별 차트 데이터
  const hourlyData: { hour: string; stage1: number; stage2: number; total: number; count: number }[] = [];
  const hourMap = new Map<string, { stage1: number; stage2: number; total: number; count: number }>();

  metrics.forEach(m => {
    const hour = new Date(m.created_at).toLocaleString('ko-KR', { 
      hour: '2-digit', 
      hour12: false,
      ...(timeRange === '7d' && { month: '2-digit', day: '2-digit' })
    });
    const existing = hourMap.get(hour) || { stage1: 0, stage2: 0, total: 0, count: 0 };
    existing.stage1 += m.stage1_time_ms || 0;
    existing.stage2 += m.stage2_time_ms || 0;
    existing.total += m.total_time_ms || 0;
    existing.count++;
    hourMap.set(hour, existing);
  });

  hourMap.forEach((data, hour) => {
    hourlyData.push({
      hour,
      stage1: Math.round(data.stage1 / data.count),
      stage2: Math.round(data.stage2 / data.count),
      total: Math.round(data.total / data.count),
      count: data.count,
    });
  });
  hourlyData.sort((a, b) => a.hour.localeCompare(b.hour));

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getActiveModel = (stage: string) => {
    return modelConfigs.find(c => c.id === stage)?.model_name || '';
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">추론 성능 모니터링</h3>
          <p className="text-sm text-muted-foreground">Stage 1/2 응답 시간 및 성공률</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v: '1h' | '24h' | '7d') => setTimeRange(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">최근 1시간</SelectItem>
              <SelectItem value="24h">최근 24시간</SelectItem>
              <SelectItem value="7d">최근 7일</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">총 요청</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">평균 응답</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatMs(stats.avgTotalTime)}</p>
            <p className="text-xs text-muted-foreground">
              S1: {formatMs(stats.avgStage1Time)} / S2: {formatMs(stats.avgStage2Time)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">성공률</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stats.totalRequests > 0 
                ? `${Math.round((stats.stage1Success / stats.totalRequests) * 100)}%`
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground">
              S1: {stats.stage1Success}/{stats.totalRequests}, S2: {stats.stage2Success}/{stats.totalRequests}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Fallback 사용</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.fallbackUsed}</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalRequests > 0 
                ? `${Math.round((stats.fallbackUsed / stats.totalRequests) * 100)}% 비율`
                : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 모델 설정 (A/B 테스트) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">모델 설정 (A/B 테스트)</CardTitle>
          <CardDescription>Stage별 활성 모델을 변경하여 성능을 비교하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stage 1 */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline">Stage 1</Badge>
                TPO 분석 (컨셉 추론)
              </label>
              <Select
                value={getActiveModel('stage1')}
                onValueChange={(v) => updateModelConfig('stage1', v)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모델 선택" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.stage1.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                백업: {getActiveModel('stage1_backup') || '설정 안됨'}
              </p>
            </div>

            {/* Stage 2 */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline">Stage 2</Badge>
                최종 선택 (스타일링)
              </label>
              <Select
                value={getActiveModel('stage2')}
                onValueChange={(v) => updateModelConfig('stage2', v)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모델 선택" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.stage2.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                백업: {getActiveModel('stage2_backup') || '설정 안됨'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 응답 시간 차트 */}
      {hourlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">시간대별 응답 시간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" />
                  <YAxis yAxisId="left" orientation="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'count' ? `${value}건` : formatMs(value),
                      name === 'stage1' ? 'Stage 1' : name === 'stage2' ? 'Stage 2' : name === 'total' ? '전체' : '요청 수'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="count" fill="hsl(var(--muted))" name="요청 수" />
                  <Line yAxisId="left" type="monotone" dataKey="stage1" stroke="hsl(var(--chart-1))" name="Stage 1" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="stage2" stroke="hsl(var(--chart-2))" name="Stage 2" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="total" stroke="hsl(var(--chart-3))" name="전체" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 모델별 성능 테이블 */}
      {modelStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">모델별 성능 비교</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>단계</TableHead>
                  <TableHead>모델</TableHead>
                  <TableHead className="text-right">요청 수</TableHead>
                  <TableHead className="text-right">평균 응답</TableHead>
                  <TableHead className="text-right">성공률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelStats.map((stat, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant={stat.stage === 'stage1' ? 'default' : 'secondary'}>
                        {stat.stage === 'stage1' ? 'S1' : 'S2'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{stat.model}</TableCell>
                    <TableCell className="text-right">{stat.requests}</TableCell>
                    <TableCell className="text-right">{formatMs(stat.avgTime)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={stat.successRate >= 90 ? 'default' : stat.successRate >= 70 ? 'secondary' : 'destructive'}>
                        {stat.successRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 최근 요청 로그 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 추론 로그</CardTitle>
          <CardDescription>최근 20건의 추론 요청</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시간</TableHead>
                  <TableHead>S1 모델</TableHead>
                  <TableHead>S1 시간</TableHead>
                  <TableHead>S2 모델</TableHead>
                  <TableHead>S2 시간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>Fallback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.slice(0, 20).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">
                      {new Date(m.created_at).toLocaleString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.stage1_model.split('/')[1]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.stage1_success ? 'outline' : 'destructive'} className="text-xs">
                        {m.stage1_time_ms ? formatMs(m.stage1_time_ms) : '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.stage2_model.split('/')[1]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.stage2_success ? 'outline' : 'destructive'} className="text-xs">
                        {m.stage2_time_ms ? formatMs(m.stage2_time_ms) : '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.stage1_success && m.stage2_success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.fallback_reason || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InferenceMetricsPanel;
