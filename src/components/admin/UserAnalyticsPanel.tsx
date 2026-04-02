/**
 * UserAnalyticsPanel - MAU/DAU 유저 통계 패널
 * 일별 활성 사용자(DAU), 월별 활성 사용자(MAU) 추적
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface DailyActiveData {
  date: string;
  label: string;
  dau: number;
}

interface MonthlyStats {
  mau: number;
  totalUsers: number;
  avgDau: number;
  peakDau: number;
  peakDate: string;
}

export const UserAnalyticsPanel = () => {
  const [dailyData, setDailyData] = useState<DailyActiveData[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rangeDays, setRangeDays] = useState<string>('30');
  const [signupData, setSignupData] = useState<{ date: string; label: string; signups: number }[]>([]);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const days = parseInt(rangeDays);
      const now = new Date();
      const startDate = subDays(now, days);

      // 1. DAU: daily_generation_usage 테이블에서 날짜별 고유 사용자 수 집계
      const { data: usageData, error: usageError } = await supabase
        .from('daily_generation_usage')
        .select('user_id, usage_date')
        .gte('usage_date', format(startDate, 'yyyy-MM-dd'))
        .lte('usage_date', format(now, 'yyyy-MM-dd'));

      if (usageError) throw usageError;

      // 날짜별 고유 사용자 수 집계
      const dailyUsers = new Map<string, Set<string>>();
      const monthlyUsers = new Set<string>();

      usageData?.forEach(row => {
        const date = row.usage_date;
        if (!dailyUsers.has(date)) dailyUsers.set(date, new Set());
        dailyUsers.get(date)!.add(row.user_id);
        monthlyUsers.add(row.user_id);
      });

      // 2. 가입자 추이: profiles 테이블에서 날짜별 가입 수
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString());

      if (profileError) throw profileError;

      const dailySignups = new Map<string, number>();
      profileData?.forEach(row => {
        const date = format(new Date(row.created_at), 'yyyy-MM-dd');
        dailySignups.set(date, (dailySignups.get(date) || 0) + 1);
      });

      // 3. 전체 사용자 수
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 날짜 범위 채우기
      const dateRange = eachDayOfInterval({ start: startDate, end: now });
      const chartData: DailyActiveData[] = dateRange.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const users = dailyUsers.get(dateStr);
        return {
          date: dateStr,
          label: format(d, 'M/d', { locale: ko }),
          dau: users ? users.size : 0,
        };
      });

      const signupChartData = dateRange.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          label: format(d, 'M/d', { locale: ko }),
          signups: dailySignups.get(dateStr) || 0,
        };
      });

      // 통계 계산
      const dauValues = chartData.map(d => d.dau);
      const peakDau = Math.max(...dauValues, 0);
      const peakIdx = dauValues.indexOf(peakDau);
      const avgDau = dauValues.length > 0
        ? Math.round(dauValues.reduce((a, b) => a + b, 0) / dauValues.length)
        : 0;

      setDailyData(chartData);
      setSignupData(signupChartData);
      setMonthlyStats({
        mau: monthlyUsers.size,
        totalUsers: totalUsers || 0,
        avgDau,
        peakDau,
        peakDate: peakIdx >= 0 ? chartData[peakIdx]?.date || '' : '',
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const StatCard = ({ title, value, subtitle, icon: Icon }: {
    title: string; value: string | number; subtitle?: string; icon: typeof Users;
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className="w-8 h-8 text-muted-foreground/30" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">유저 통계</h3>
          <p className="text-sm text-muted-foreground">MAU, DAU 및 가입 추이</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">최근 7일</SelectItem>
              <SelectItem value="14">최근 14일</SelectItem>
              <SelectItem value="30">최근 30일</SelectItem>
              <SelectItem value="90">최근 90일</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : monthlyStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="전체 가입자"
            value={monthlyStats.totalUsers.toLocaleString()}
            subtitle="누적 가입 수"
            icon={Users}
          />
          <StatCard
            title={`MAU (${rangeDays}일)`}
            value={monthlyStats.mau.toLocaleString()}
            subtitle="활성 사용자 (스타일 생성 기준)"
            icon={TrendingUp}
          />
          <StatCard
            title="평균 DAU"
            value={monthlyStats.avgDau.toLocaleString()}
            subtitle={`최근 ${rangeDays}일 평균`}
            icon={Calendar}
          />
          <StatCard
            title="피크 DAU"
            value={monthlyStats.peakDau.toLocaleString()}
            subtitle={monthlyStats.peakDate ? format(new Date(monthlyStats.peakDate), 'M월 d일', { locale: ko }) : '-'}
            icon={BarChart3}
          />
        </div>
      ) : null}

      {/* DAU Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">일별 활성 사용자 (DAU)</CardTitle>
          <CardDescription>스타일 생성을 사용한 고유 사용자 수</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={Math.max(0, Math.floor(dailyData.length / 10) - 1)}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload?.date) {
                      return format(new Date(payload[0].payload.date), 'yyyy년 M월 d일', { locale: ko });
                    }
                    return '';
                  }}
                  formatter={(value: number) => [`${value}명`, 'DAU']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="dau" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Signup Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">일별 신규 가입자</CardTitle>
          <CardDescription>날짜별 신규 가입 수</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={Math.max(0, Math.floor(signupData.length / 10) - 1)}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload?.date) {
                      return format(new Date(payload[0].payload.date), 'yyyy년 M월 d일', { locale: ko });
                    }
                    return '';
                  }}
                  formatter={(value: number) => [`${value}명`, '신규 가입']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="signups" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
