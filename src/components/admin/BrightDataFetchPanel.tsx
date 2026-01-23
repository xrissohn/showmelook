import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Database, RefreshCw, Download, CheckCircle2, XCircle, 
  Loader2, FileJson, Calendar, Package, AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Snapshot {
  id: string;
  status: string;
  created_at?: string;
  records_count?: number;
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

export const BrightDataFetchPanel = () => {
  const { toast } = useToast();
  
  const [datasetId, setDatasetId] = useState("j_mkbofq0p7l9tvl80j");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [fetchLimit, setFetchLimit] = useState("100");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [fetchProgress, setFetchProgress] = useState(0);

  const loadSnapshots = async () => {
    if (!datasetId.trim()) {
      toast({ title: "Dataset ID를 입력해주세요", variant: "destructive" });
      return;
    }

    setIsLoadingSnapshots(true);
    setSnapshots([]);
    setFetchResult(null);
    setSnapshotsLoaded(false);
    setRawResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke('brightdata-fetch', {
        body: { 
          action: 'list_snapshots', 
          dataset_id: datasetId.trim() 
        }
      });

      if (error) throw error;
      
      if (data.success) {
        setSnapshots(data.snapshots || []);
        setSnapshotsLoaded(true);
        if (data.raw_response) {
          setRawResponse(data.raw_response);
        }
        toast({ 
          title: "스냅샷 목록 로드 완료", 
          description: `${data.snapshots?.length || 0}개의 스냅샷을 찾았습니다.` 
        });
      } else {
        throw new Error(data.error || 'Failed to load snapshots');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ 
        title: "스냅샷 로드 실패", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  const fetchSnapshotData = async (snapshotId: string) => {
    setSelectedSnapshot(snapshotId);
    setIsFetching(true);
    setFetchResult(null);
    setFetchProgress(10);

    try {
      const limit = parseInt(fetchLimit) || 100;
      
      // 진행 상황 시뮬레이션
      const progressInterval = setInterval(() => {
        setFetchProgress(prev => Math.min(prev + 5, 90));
      }, 1000);

      const { data, error } = await supabase.functions.invoke('brightdata-fetch', {
        body: { 
          action: 'fetch_snapshot', 
          dataset_id: datasetId.trim(),
          snapshot_id: snapshotId,
          limit
        }
      });

      clearInterval(progressInterval);
      setFetchProgress(100);

      if (error) throw error;
      
      setFetchResult(data);
      
      if (data.success) {
        toast({ 
          title: "데이터 가져오기 완료!", 
          description: `${data.registered}개 상품 등록됨 (실패: ${data.failed}, 스킵: ${data.skipped})` 
        });
      } else {
        throw new Error(data.error || 'Fetch failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFetchResult({ success: false, error: errorMessage });
      toast({ 
        title: "데이터 가져오기 실패", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsFetching(false);
      setTimeout(() => setFetchProgress(0), 2000);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('ko-KR');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dataset ID 입력 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bright Data 데이터셋 연동
          </CardTitle>
          <CardDescription>
            Bright Data에서 수집된 상품 데이터를 API로 직접 가져옵니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Dataset ID</label>
              <Input
                placeholder="예: j_mkbofq0p7l9tvl80j"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="text-sm font-medium mb-1 block">가져올 개수</label>
              <Input
                type="number"
                value={fetchLimit}
                onChange={(e) => setFetchLimit(e.target.value)}
                min="10"
                max="1000"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={loadSnapshots}
                disabled={isLoadingSnapshots || !datasetId.trim()}
              >
                {isLoadingSnapshots ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                스냅샷 조회
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 스냅샷 없음 안내 */}
      {snapshotsLoaded && snapshots.length === 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-5 h-5" />
              스냅샷을 찾을 수 없습니다
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>가능한 원인:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Dataset ID가 올바른지 확인해주세요</li>
                <li>Bright Data에서 데이터 수집이 완료되었는지 확인해주세요</li>
                <li>API 키 권한이 해당 데이터셋에 접근 가능한지 확인해주세요</li>
              </ul>
            </div>
            
            {rawResponse && (
              <div className="mt-4">
                <p className="text-xs font-medium mb-2">API 응답 (디버깅용):</p>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                  {rawResponse}
                </pre>
              </div>
            )}
            
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Bright Data 대시보드에서 확인할 사항:</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>My Datasets → 해당 데이터셋 선택</li>
                <li>Runs 탭에서 수집 완료된 스냅샷 확인</li>
                <li>Delivery 설정에서 웹훅 URL 확인</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 스냅샷 목록 */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              스냅샷 목록 ({snapshots.length}개)
            </CardTitle>
            <CardDescription>
              가져올 스냅샷을 선택하세요. 각 스냅샷은 특정 시점의 수집 데이터입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {snapshots.map((snapshot) => (
                <div 
                  key={snapshot.id}
                  className={`p-4 rounded-lg border flex items-center justify-between transition-colors ${
                    selectedSnapshot === snapshot.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-mono text-sm">{snapshot.id}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(snapshot.created_at)}
                        {snapshot.records_count && (
                          <>
                            <Package className="w-3 h-3 ml-2" />
                            {snapshot.records_count.toLocaleString()}개 상품
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      snapshot.status === 'ready' ? 'default' :
                      snapshot.status === 'running' ? 'secondary' : 'outline'
                    }>
                      {snapshot.status}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => fetchSnapshotData(snapshot.id)}
                      disabled={isFetching || snapshot.status !== 'ready'}
                    >
                      {isFetching && selectedSnapshot === snapshot.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      가져오기
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 진행 상황 */}
      {isFetching && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>데이터 가져오는 중...</span>
                <span>{fetchProgress}%</span>
              </div>
              <Progress value={fetchProgress} />
              <p className="text-xs text-muted-foreground">
                상품 다운로드 → 이미지 저장 → DNA 생성 순으로 처리됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과 */}
      {fetchResult && (
        <Card className={fetchResult.success ? 'border-green-500' : 'border-red-500'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {fetchResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              {fetchResult.success ? '가져오기 완료!' : '가져오기 실패'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fetchResult.success ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{fetchResult.total_in_snapshot}</div>
                  <div className="text-sm text-muted-foreground">스냅샷 총 상품</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{fetchResult.processed}</div>
                  <div className="text-sm text-muted-foreground">처리됨</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{fetchResult.registered}</div>
                  <div className="text-sm text-muted-foreground">등록 완료</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{fetchResult.failed}</div>
                  <div className="text-sm text-muted-foreground">실패</div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg text-red-600">
                {fetchResult.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
