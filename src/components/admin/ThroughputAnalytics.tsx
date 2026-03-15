import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, Clock, Zap, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/paginatedFetch";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from 'recharts';

interface ProcessingStats {
  avgProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  totalCompleted: number;
  totalFailed: number;
  successRate: number;
}

interface HourlyThroughput {
  hour: string;
  completed: number;
  failed: number;
  avgTimeMs: number;
}

interface DailyThroughput {
  date: string;
  completed: number;
  failed: number;
  avgTimeMs: number;
}

export const ThroughputAnalytics = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyThroughput[]>([]);
  const [dailyData, setDailyData] = useState<DailyThroughput[]>([]);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate time range
      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // Fetch ALL completed/failed jobs with timing data (paginated)
      const jobs = await fetchAllRows<{
        id: string; status: string; created_at: string; started_at: string | null; completed_at: string | null;
      }>(
        'generation_jobs',
        'id, status, created_at, started_at, completed_at',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q: any) => q
          .gte('created_at', startDate.toISOString())
          .in('status', ['completed', 'failed'])
          .order('created_at', { ascending: true })
      );

      // Calculate processing times for completed jobs
      const processingTimes: number[] = [];
      let totalCompleted = 0;
      let totalFailed = 0;

      const hourlyMap = new Map<string, { completed: number; failed: number; totalTimeMs: number; count: number }>();
      const dailyMap = new Map<string, { completed: number; failed: number; totalTimeMs: number; count: number }>();

      jobs.forEach(job => {
        const createdAt = new Date(job.created_at);
        const hourKey = createdAt.toISOString().slice(0, 13) + ':00';
        const dayKey = createdAt.toISOString().slice(0, 10);

        if (!hourlyMap.has(hourKey)) {
          hourlyMap.set(hourKey, { completed: 0, failed: 0, totalTimeMs: 0, count: 0 });
        }
        if (!dailyMap.has(dayKey)) {
          dailyMap.set(dayKey, { completed: 0, failed: 0, totalTimeMs: 0, count: 0 });
        }

        const hourlyEntry = hourlyMap.get(hourKey)!;
        const dailyEntry = dailyMap.get(dayKey)!;

        if (job.status === 'completed') {
          totalCompleted++;
          hourlyEntry.completed++;
          dailyEntry.completed++;

          if (job.started_at && job.completed_at) {
            const processingTime = new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
            processingTimes.push(processingTime);
            hourlyEntry.totalTimeMs += processingTime;
            hourlyEntry.count++;
            dailyEntry.totalTimeMs += processingTime;
            dailyEntry.count++;
          }
        } else if (job.status === 'failed') {
          totalFailed++;
          hourlyEntry.failed++;
          dailyEntry.failed++;
        }
      });

      // Calculate percentiles
      processingTimes.sort((a, b) => a - b);
      const getPercentile = (arr: number[], p: number) => {
        if (arr.length === 0) return 0;
        const idx = Math.ceil(arr.length * p / 100) - 1;
        return arr[Math.max(0, Math.min(idx, arr.length - 1))];
      };

      const avgTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;

      setStats({
        avgProcessingTimeMs: Math.round(avgTime),
        p50ProcessingTimeMs: getPercentile(processingTimes, 50),
        p95ProcessingTimeMs: getPercentile(processingTimes, 95),
        p99ProcessingTimeMs: getPercentile(processingTimes, 99),
        totalCompleted,
        totalFailed,
        successRate: totalCompleted + totalFailed > 0 
          ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100) 
          : 0,
      });

      // Convert hourly map to array (last 24 hours for 24h, or aggregate for longer periods)
      const hourlyArray: HourlyThroughput[] = [];
      const sortedHours = Array.from(hourlyMap.keys()).sort();
      
      // For 24h, show all hours; for longer periods, show last 48 hours
      const hoursToShow = timeRange === '24h' ? sortedHours : sortedHours.slice(-48);
      
      hoursToShow.forEach(hour => {
        const entry = hourlyMap.get(hour)!;
        hourlyArray.push({
          hour: new Date(hour).toLocaleString('ko-KR', { 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit' 
          }),
          completed: entry.completed,
          failed: entry.failed,
          avgTimeMs: entry.count > 0 ? Math.round(entry.totalTimeMs / entry.count) : 0,
        });
      });
      setHourlyData(hourlyArray);

      // Convert daily map to array
      const dailyArray: DailyThroughput[] = [];
      const sortedDays = Array.from(dailyMap.keys()).sort();
      
      sortedDays.forEach(day => {
        const entry = dailyMap.get(day)!;
        dailyArray.push({
          date: new Date(day).toLocaleDateString('ko-KR', { 
            month: '2-digit', 
            day: '2-digit' 
          }),
          completed: entry.completed,
          failed: entry.failed,
          avgTimeMs: entry.count > 0 ? Math.round(entry.totalTimeMs / entry.count) : 0,
        });
      });
      setDailyData(dailyArray);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}초`;
    return `${(ms / 60000).toFixed(1)}분`;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24시간</SelectItem>
              <SelectItem value="7d">7일</SelectItem>
              <SelectItem value="30d">30일</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadAnalytics} disabled={isLoading} variant="outline" size="sm">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">새로고침</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">평균 처리시간</span>
              </div>
              <p className="text-2xl font-bold">{formatMs(stats.avgProcessingTimeMs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">P95 처리시간</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{formatMs(stats.p95ProcessingTimeMs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">성공률</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.successRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">총 처리량</span>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalCompleted}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (+{stats.totalFailed} 실패)
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Percentiles */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              처리 시간 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">P50 (중간값)</p>
                <p className="font-semibold">{formatMs(stats.p50ProcessingTimeMs)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">평균</p>
                <p className="font-semibold">{formatMs(stats.avgProcessingTimeMs)}</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">P95</p>
                <p className="font-semibold text-orange-600">{formatMs(stats.p95ProcessingTimeMs)}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">P99</p>
                <p className="font-semibold text-red-600">{formatMs(stats.p99ProcessingTimeMs)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Throughput Chart */}
      {hourlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              시간별 처리량
            </CardTitle>
            <CardDescription>
              완료/실패 작업 수 (막대) 및 평균 처리시간 (선)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 10 }} 
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'avgTimeMs') return [formatMs(value), '평균 처리시간'];
                      return [value, name === 'completed' ? '완료' : '실패'];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="completed" fill="hsl(var(--primary))" name="완료" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="failed" fill="hsl(var(--destructive))" name="실패" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="avgTimeMs" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} name="평균 처리시간" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Throughput Chart (for 7d/30d) */}
      {timeRange !== '24h' && dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              일별 처리량 추이
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'avgTimeMs') return [formatMs(value), '평균 처리시간'];
                      return [value, name === 'completed' ? '완료' : '실패'];
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="completed" stackId="1" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" name="완료" />
                  <Area type="monotone" dataKey="failed" stackId="1" fill="hsl(var(--destructive))" stroke="hsl(var(--destructive))" name="실패" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && hourlyData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">선택한 기간에 처리된 작업이 없습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
