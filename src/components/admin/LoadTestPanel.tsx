import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Play, 
  Square, 
  Trash2, 
  RefreshCw, 
  Timer, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Zap,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTimeMs: number;
  startTime: Date | null;
  endTime: Date | null;
}

export const LoadTestPanel = () => {
  const [jobCount, setJobCount] = useState(100);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<TestStats>({
    total: 0,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    avgProcessingTimeMs: 0,
    startTime: null,
    endTime: null,
  });
  const [testUserId] = useState('00000000-0000-0000-0000-000000000000');
  const { toast } = useToast();

  const loadStats = useCallback(async () => {
    try {
      // 테스트 Job들 조회
      const { data: jobs, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('user_id', testUserId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!jobs || jobs.length === 0) {
        setStats({
          total: 0,
          queued: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          avgProcessingTimeMs: 0,
          startTime: null,
          endTime: null,
        });
        setIsRunning(false);
        return;
      }

      const queued = jobs.filter(j => j.status === 'queued').length;
      const processing = jobs.filter(j => j.status === 'processing' || j.status === 'generating_style' || j.status === 'generating_image').length;
      const completed = jobs.filter(j => j.status === 'completed').length;
      const failed = jobs.filter(j => j.status === 'failed').length;

      // 평균 처리 시간 계산
      const completedJobs = jobs.filter(j => j.status === 'completed' && j.started_at && j.completed_at);
      const avgTimeMs = completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => {
            const start = new Date(j.started_at!).getTime();
            const end = new Date(j.completed_at!).getTime();
            return sum + (end - start);
          }, 0) / completedJobs.length
        : 0;

      // 시작/종료 시간
      const startTime = jobs.length > 0 ? new Date(jobs[0].created_at!) : null;
      const allDone = queued === 0 && processing === 0 && jobs.length > 0;
      const endTime = allDone && completedJobs.length > 0
        ? new Date(Math.max(...completedJobs.map(j => new Date(j.completed_at!).getTime())))
        : null;

      setStats({
        total: jobs.length,
        queued,
        processing,
        completed,
        failed,
        avgProcessingTimeMs: avgTimeMs,
        startTime,
        endTime,
      });

      setIsRunning(queued > 0 || processing > 0);
    } catch (err) {
      console.error('Failed to load test stats:', err);
    }
  }, [testUserId]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 2000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const createTestJobs = async () => {
    setIsCreating(true);
    try {
      // 기존 테스트 Job 삭제
      await supabase
        .from('generation_jobs')
        .delete()
        .eq('user_id', testUserId);

      // 새 테스트 Job 생성
      const jobs = Array.from({ length: jobCount }, (_, i) => ({
        user_id: testUserId,
        status: 'queued',
        priority: Math.random() < 0.1 ? 1 : Math.random() < 0.3 ? 3 : 5, // 10% Premium, 20% Pro, 70% Free
        request_payload: {
          userRequest: `Load test job ${i + 1}`,
          gender: Math.random() < 0.5 ? '남성' : '여성',
          budget: Math.floor(Math.random() * 400000) + 100000,
          isLoadTest: true,
        },
      }));

      const { error } = await supabase
        .from('generation_jobs')
        .insert(jobs);

      if (error) throw error;

      toast({
        title: "테스트 Job 생성 완료",
        description: `${jobCount}개의 테스트 Job이 생성되었습니다.`,
      });

      loadStats();
    } catch (err) {
      console.error('Failed to create test jobs:', err);
      toast({
        title: "오류",
        description: "테스트 Job 생성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const triggerProcessing = async () => {
    try {
      const response = await supabase.functions.invoke('process-generation-queue', {
        body: { chainDepth: 0 },
      });

      if (response.error) throw response.error;

      toast({
        title: "처리 시작",
        description: "큐 처리가 시작되었습니다.",
      });
    } catch (err) {
      console.error('Failed to trigger processing:', err);
      toast({
        title: "오류",
        description: "큐 처리 시작에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const clearTestJobs = async () => {
    try {
      await supabase
        .from('generation_jobs')
        .delete()
        .eq('user_id', testUserId);

      toast({
        title: "삭제 완료",
        description: "모든 테스트 Job이 삭제되었습니다.",
      });

      loadStats();
    } catch (err) {
      console.error('Failed to clear test jobs:', err);
      toast({
        title: "오류",
        description: "테스트 Job 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const getElapsedTime = () => {
    if (!stats.startTime) return '-';
    const endTime = stats.endTime || new Date();
    const elapsedMs = endTime.getTime() - stats.startTime.getTime();
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    return `${minutes}분 ${seconds}초`;
  };

  const getThroughput = () => {
    if (!stats.startTime || stats.completed === 0) return 0;
    const endTime = stats.endTime || new Date();
    const elapsedMin = (endTime.getTime() - stats.startTime.getTime()) / 60000;
    return (stats.completed / elapsedMin).toFixed(1);
  };

  const progressPercentage = stats.total > 0 
    ? ((stats.completed + stats.failed) / stats.total) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          부하 테스트
        </CardTitle>
        <CardDescription>
          대량 Job 생성 및 처리 성능 측정
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 테스트 설정 */}
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label>테스트 Job 수</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={jobCount}
              onChange={(e) => setJobCount(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>
          <Button 
            onClick={createTestJobs} 
            disabled={isCreating || isRunning}
            className="min-w-[120px]"
          >
            {isCreating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Job 생성
          </Button>
        </div>

        {/* 경고 */}
        {stats.total > 0 && !isRunning && stats.queued > 0 && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              {stats.queued}개의 Job이 대기 중입니다. "처리 시작"을 클릭하여 테스트를 시작하세요.
            </AlertDescription>
          </Alert>
        )}

        {/* 진행 상황 */}
        {stats.total > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">진행률</span>
              <span className="text-sm text-muted-foreground">
                {stats.completed + stats.failed} / {stats.total}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            
            {/* 상태 배지 */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50">
                <Clock className="w-3 h-3 mr-1" />
                대기: {stats.queued}
              </Badge>
              <Badge variant="outline" className="bg-yellow-50">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                처리 중: {stats.processing}
              </Badge>
              <Badge variant="outline" className="bg-green-50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                완료: {stats.completed}
              </Badge>
              <Badge variant="outline" className="bg-red-50">
                <XCircle className="w-3 h-3 mr-1" />
                실패: {stats.failed}
              </Badge>
            </div>
          </div>
        )}

        {/* 성능 지표 */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{getElapsedTime()}</div>
              <div className="text-xs text-muted-foreground">경과 시간</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{getThroughput()}</div>
              <div className="text-xs text-muted-foreground">처리량 (jobs/min)</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {stats.avgProcessingTimeMs > 0 ? `${(stats.avgProcessingTimeMs / 1000).toFixed(1)}초` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">평균 처리 시간</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {stats.completed > 0 ? `${((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1)}%` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">성공률</div>
            </div>
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex gap-2">
          <Button 
            onClick={triggerProcessing}
            disabled={stats.queued === 0}
            variant="default"
          >
            <Play className="w-4 h-4 mr-2" />
            처리 시작
          </Button>
          <Button 
            onClick={loadStats}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button 
            onClick={clearTestJobs}
            variant="destructive"
            disabled={isRunning}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            전체 삭제
          </Button>
        </div>

        {/* 테스트 완료 결과 */}
        {stats.endTime && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>테스트 완료!</strong> {stats.total}개 Job을 {getElapsedTime()}에 처리했습니다. 
              평균 {getThroughput()} jobs/min, 성공률 {((stats.completed / stats.total) * 100).toFixed(1)}%
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
