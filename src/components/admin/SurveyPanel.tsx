import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Copy, Loader2, RefreshCw, Send, Mail } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const IMG_A_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-a.png`;
const IMG_B_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-b.png`;

const DEFAULT_TEMPLATE = `안녕하세요, 쇼미룩입니다 ✨

가상 인플루언서 '쇼미' 캐릭터를 새로 디자인 중이에요.
두 가지 시안 중 어느 쪽이 더 마음에 드시는지 의견을 주시면,
참여해주신 모든 분께 무료 10크레딧을 즉시 지급해드립니다.

👉 설문 참여하기: https://showmelook.com/survey/shomi

소중한 의견이 더 멋진 쇼미를 만듭니다. 감사합니다!

— 쇼미룩 팀`;

type Stats = { total: number; a: number; b: number };
type Resp = { id: string; choice: string; feedback: string | null; created_at: string; user_id: string };

export const SurveyPanel = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ total: 0, a: 0, b: 0 });
  const [recent, setRecent] = useState<Resp[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState<"A" | "B" | null>(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [imgVersion, setImgVersion] = useState(Date.now());

  const loadStats = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("survey_responses")
      .select("id,choice,feedback,created_at,user_id")
      .order("created_at", { ascending: false });
    const rows = (data || []) as Resp[];
    setRecent(rows.slice(0, 50));
    setStats({
      total: rows.length,
      a: rows.filter((r) => r.choice === "A").length,
      b: rows.filter((r) => r.choice === "B").length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleUpload = async (which: "A" | "B", file: File) => {
    setUploading(which);
    try {
      const path = `survey/shomi-${which.toLowerCase()}.png`;
      const { error } = await supabase.storage
        .from("generated-looks")
        .upload(path, file, { upsert: true, contentType: file.type || "image/png", cacheControl: "60" });
      if (error) throw error;
      setImgVersion(Date.now());
      toast({ title: `시안 ${which} 업로드 완료` });
    } catch (e: any) {
      toast({ title: "업로드 실패", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const exportEmailsCsv = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-users`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const json = await res.json();
      const users: Array<{ email: string; full_name: string | null; created_at: string }> = json.users || [];
      const rows = [
        ["email", "full_name", "created_at"],
        ...users
          .filter((u) => u.email)
          .map((u) => [u.email, u.full_name || "", u.created_at]),
      ];
      const csv = rows
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `showmelook-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${users.length}명의 이메일을 내보냈습니다` });
    } catch (e: any) {
      toast({ title: "내보내기 실패", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const copyBccList = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-users`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const json = await res.json();
      const emails: string[] = (json.users || [])
        .map((u: any) => u.email)
        .filter(Boolean);
      await navigator.clipboard.writeText(emails.join(", "));
      toast({ title: `${emails.length}개 이메일을 클립보드에 복사했습니다`, description: "Gmail BCC 칸에 붙여넣으세요" });
    } catch (e: any) {
      toast({ title: "복사 실패", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const copyTemplate = async () => {
    await navigator.clipboard.writeText(template);
    toast({ title: "메일 본문을 복사했습니다" });
  };

  const exportResponsesCsv = () => {
    const rows = [
      ["created_at", "choice", "feedback", "user_id"],
      ...recent.map((r) => [r.created_at, r.choice, r.feedback || "", r.user_id]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Image upload */}
      <Card>
        <CardHeader>
          <CardTitle>1. 시안 이미지 업로드</CardTitle>
          <CardDescription>
            두 시안을 업로드하면 /survey/shomi 페이지에 즉시 반영됩니다. 같은 파일명으로 덮어쓰기됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {(["A", "B"] as const).map((k) => (
              <div key={k} className="space-y-2">
                <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden border">
                  <img
                    src={`${k === "A" ? IMG_A_URL : IMG_B_URL}?v=${imgVersion}`}
                    alt={`시안 ${k}`}
                    className="w-full h-full object-contain"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.2")}
                  />
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(k, f);
                    }}
                  />
                  <Button asChild variant="outline" className="w-full cursor-pointer" disabled={uploading === k}>
                    <span>
                      {uploading === k ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />업로드 중...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" />시안 {k} 업로드</>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email sending */}
      <Card>
        <CardHeader>
          <CardTitle>2. 가입자에게 메일 발송</CardTitle>
          <CardDescription>
            대량 발송은 Gmail에서 직접 BCC로 보내주세요. (Gmail은 1일 약 500건 제한, 초과 시 분할 발송)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportEmailsCsv} disabled={exporting} variant="outline">
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              이메일 CSV 다운로드
            </Button>
            <Button onClick={copyBccList} disabled={exporting} variant="outline">
              <Copy className="w-4 h-4 mr-2" />BCC용 전체 이메일 복사
            </Button>
            <Button onClick={copyTemplate} variant="default">
              <Copy className="w-4 h-4 mr-2" />메일 본문 복사
            </Button>
          </div>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>3. 응답 통계</CardTitle>
            <CardDescription>실시간 집계</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadStats} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />새로고침
            </Button>
            <Button size="sm" variant="outline" onClick={exportResponsesCsv} disabled={!recent.length}>
              <Download className="w-4 h-4 mr-1" />응답 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-3xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">전체 응답</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-3xl font-bold text-foreground">{stats.a}</div>
              <div className="text-xs text-muted-foreground mt-1">시안 A ({pct(stats.a)}%)</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-3xl font-bold text-foreground">{stats.b}</div>
              <div className="text-xs text-muted-foreground mt-1">시안 B ({pct(stats.b)}%)</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">최근 응답</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">아직 응답이 없습니다.</p>
              )}
              {recent.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Badge variant={r.choice === "A" ? "default" : "secondary"}>{r.choice}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground break-words">
                      {r.feedback || <span className="text-muted-foreground italic">(의견 없음)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SurveyPanel;
