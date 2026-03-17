/**
 * ErrorLogPanel - 관리자용 에러 로그 모니터링 패널
 * 에러 상세 정보(request/response payload) 확인 가능
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, RefreshCw, Loader2, ChevronDown, ChevronRight, Clock, Code, FileText, User } from 'lucide-react';
import { fetchAllRows } from '@/lib/paginatedFetch';

interface ErrorLog {
  id: string;
  function_name: string;
  error_code: string | null;
  error_message: string | null;
  user_id: string | null;
  request_payload: unknown;
  response_payload: unknown;
  execution_time_ms: number | null;
  created_at: string;
}

export const ErrorLogPanel = () => {
  const { toast } = useToast();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [functionFilter, setFunctionFilter] = useState<string>('all');
  const [codeFilter, setCodeFilter] = useState<string>('all');
  const [stats, setStats] = useState<{
    total: number;
    byFunction: Record<string, number>;
    byCode: Record<string, number>;
  }>({ total: 0, byFunction: {}, byCode: {} });

  const loadStats = useCallback(async () => {
    try {
      const allLogs = await fetchAllRows<{ function_name: string; error_code: string | null }>(
        'error_logs', 'function_name, error_code',
        (q) => q.order('created_at', { ascending: false })
      );

      const byFunction: Record<string, number> = {};
      const byCode: Record<string, number> = {};

      allLogs.forEach(log => {
        byFunction[log.function_name] = (byFunction[log.function_name] || 0) + 1;
        const code = log.error_code || 'UNKNOWN';
        byCode[code] = (byCode[code] || 0) + 1;
      });

      setStats({ total: allLogs.length, byFunction, byCode });
    } catch (error) {
      console.error('Error loading error log stats:', error);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (functionFilter !== 'all') {
        query = query.eq('function_name', functionFilter);
      }
      if (codeFilter !== 'all') {
        if (codeFilter === 'UNKNOWN') {
          query = query.is('error_code', null);
        } else {
          query = query.eq('error_code', codeFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setErrorLogs(data || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: '에러 로그 로드 실패', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [functionFilter, codeFilter, toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatPayload = (payload: unknown): string => {
    if (!payload) return '(없음)';
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const getCodeVariant = (code: string | null): 'destructive' | 'secondary' | 'outline' => {
    if (code === '429') return 'secondary';
    if (code === '402') return 'outline';
    return 'destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          에러 로그 모니터링
        </CardTitle>
        <CardDescription>
          Edge Function 에러 히스토리 — 상세 요청/응답 정보 확인
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg text-center">
            <p className="text-2xl font-bold text-destructive">{stats.total}</p>
            <p className="text-sm text-muted-foreground">총 에러</p>
          </div>
          {Object.entries(stats.byFunction)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([fn, count]) => (
              <div key={fn} className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground truncate">{fn}</p>
              </div>
            ))}
        </div>

        {/* Error Code Distribution */}
        {Object.keys(stats.byCode).length > 0 && (
          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-medium">에러 코드별 분포</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCode)
                .sort((a, b) => b[1] - a[1])
                .map(([code, count]) => (
                  <Badge key={code} variant={getCodeVariant(code)}>
                    {code}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Filters & Actions */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">함수:</label>
            <Select value={functionFilter} onValueChange={setFunctionFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(stats.byFunction)
                  .sort((a, b) => b[1] - a[1])
                  .map(([fn, count]) => (
                    <SelectItem key={fn} value={fn}>{fn} ({count})</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">코드:</label>
            <Select value={codeFilter} onValueChange={setCodeFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(stats.byCode)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => (
                    <SelectItem key={code} value={code}>{code} ({count})</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => { loadLogs(); loadStats(); }} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            새로고침
          </Button>
        </div>

        {/* Error Logs List */}
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))
        ) : errorLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>"새로고침" 버튼을 눌러 에러 로그를 확인하세요</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {errorLogs.map(log => {
              const isExpanded = expandedIds.has(log.id);
              return (
                <div key={log.id} className="border rounded-lg overflow-hidden">
                  {/* Summary Row */}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {new Date(log.created_at).toLocaleString('ko-KR', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                    <Badge variant="outline" className="flex-shrink-0">{log.function_name}</Badge>
                    <Badge variant={getCodeVariant(log.error_code)} className="flex-shrink-0">
                      {log.error_code || 'N/A'}
                    </Badge>
                    <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                      {log.error_message?.slice(0, 120) || '-'}
                    </span>
                    {log.execution_time_ms && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {log.execution_time_ms}ms
                      </span>
                    )}
                  </button>

                  {/* Detail View */}
                  {isExpanded && (
                    <div className="border-t bg-muted/30 p-4 space-y-4">
                      {/* Error Message */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-destructive" />
                          에러 메시지
                        </h4>
                        <pre className="text-sm bg-card p-3 rounded-lg border overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                          {log.error_message || '(없음)'}
                        </pre>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Code className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">함수:</span>
                          <span className="font-medium">{log.function_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">코드:</span>
                          <span className="font-medium">{log.error_code || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">실행:</span>
                          <span className="font-medium">{log.execution_time_ms ? `${log.execution_time_ms}ms` : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">유저:</span>
                          <span className="font-mono text-xs truncate">{log.user_id?.slice(0, 8) || '-'}</span>
                        </div>
                      </div>

                      {/* Request Payload */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          요청 페이로드
                        </h4>
                        <pre className="text-xs bg-card p-3 rounded-lg border overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono">
                          {formatPayload(log.request_payload)}
                        </pre>
                      </div>

                      {/* Response Payload */}
                      {log.response_payload && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-destructive" />
                            응답 페이로드
                          </h4>
                          <pre className="text-xs bg-card p-3 rounded-lg border overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono">
                            {formatPayload(log.response_payload)}
                          </pre>
                        </div>
                      )}

                      {/* Full Timestamp */}
                      <div className="text-xs text-muted-foreground">
                        발생 시각: {new Date(log.created_at).toLocaleString('ko-KR', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
