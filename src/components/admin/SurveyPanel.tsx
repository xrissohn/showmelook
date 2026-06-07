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

const DEFAULT_SUBJECT = "[쇼미룩] 쇼미 캐릭터 AB 테스트 — 참여하고 무료 10크레딧 받으세요";

const DEFAULT_TEMPLATE = `안녕하세요, 쇼미룩입니다.

가상 인플루언서 '쇼미' 캐릭터를 새로 디자인 중이에요.
두 가지 시안 중 어느 쪽이 더 마음에 드시는지 의견을 들려주세요.

설문에 참여해주신 모든 분께 무료 10크레딧을 즉시 지급해드립니다.`;

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
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [imgVersion, setImgVersion] = useState(Date.now());
  const [preview, setPreview] = useState<{ totalUsers: number; responded: number; alreadySent: number; optOut: number; toSend: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string } | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [includeAlreadySent, setIncludeAlreadySent] = useState(true);

  const callBroadcast = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-survey-broadcast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const r = await callBroadcast({ mode: "preview", includeAlreadySent });
      setPreview(r);
    } catch (e: any) {
      toast({ title: "미리보기 실패", description: e?.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail) { toast({ title: "이메일을 입력하세요", variant: "destructive" }); return; }
    setTestSending(true);
    try {
      const r = await callBroadcast({ mode: "test", testEmail, subject, bodyText: template });
      if (r.ok) toast({ title: "테스트 메일 발송 완료", description: testEmail });
      else throw new Error(r.error || "발송 실패");
    } catch (e: any) {
      toast({ title: "테스트 실패", description: e?.message, variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  const renderEmailPreview = async () => {
    setRenderingPreview(true);
    try {
      const r = await callBroadcast({ mode: "render", subject, bodyText: template });
      setEmailPreview({ subject: r.subject, html: r.html });
    } catch (e: any) {
      toast({ title: "미리보기 생성 실패", description: e?.message, variant: "destructive" });
    } finally {
      setRenderingPreview(false);
    }
  };

  const runBroadcast = async () => {
    if (!preview || preview.toSend === 0) {
      toast({ title: "발송 대상이 없습니다", description: "먼저 미리보기를 실행하세요", variant: "destructive" });
      return;
    }
    if (!confirmedPreview) {
      toast({ title: "메일 미리보기 확인 필요", description: "발송 전 최종 메일 미리보기를 확인하고 체크박스에 동의하세요.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`${preview.toSend}명에게 실제 메일이 발송됩니다. 진행하시겠습니까?`)) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const r = await callBroadcast({ mode: "broadcast", subject, bodyText: template, includeAlreadySent });
      setBroadcastResult({ total: r.total, sent: r.sent, failed: r.failed });
      toast({ title: "발송 완료", description: `성공 ${r.sent} / 실패 ${r.failed}` });
      await loadPreview();
    } catch (e: any) {
      toast({ title: "발송 실패", description: e?.message, variant: "destructive" });
    } finally {
      setBroadcasting(false);
    }
  };

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

      {/* App-direct broadcast */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />2. 앱에서 직접 발송 (noreply@showmelook.com)</CardTitle>
          <CardDescription>
            가입자에게 noreply@showmelook.com으로 발송합니다. 메일 안의 A/B 버튼을 누르면 바로 응답 저장과 크레딧 지급이 완료됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Editable subject + body (drives both test, broadcast, and section 3) */}
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-sm font-medium">메일 제목 & 본문 (수정 시 즉시 적용)</p>
            <Input
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setConfirmedPreview(false); setEmailPreview(null); }}
              placeholder="메일 제목"
              className="font-medium"
            />
            <Textarea
              value={template}
              onChange={(e) => { setTemplate(e.target.value); setConfirmedPreview(false); setEmailPreview(null); }}
              rows={10}
              className="font-mono text-sm"
              placeholder="메일 본문 (빈 줄로 단락 구분, 줄바꿈 유지)"
            />
            <p className="text-[11px] text-muted-foreground">로고·헤더·A/B 이미지·선택 버튼·푸터는 자동으로 추가되며 위 본문만 메일 중앙에 들어갑니다.</p>
          </div>

          {/* Final email preview */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">최종 메일 미리보기 (실제 발송되는 형태)</p>
              <Button size="sm" variant="outline" onClick={renderEmailPreview} disabled={renderingPreview}>
                {renderingPreview ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                미리보기 생성
              </Button>
            </div>
            {emailPreview ? (
              <>
                <div className="rounded border bg-muted/30 px-2 py-1 text-xs">
                  <span className="text-muted-foreground">제목: </span>
                  <span className="font-medium">{emailPreview.subject}</span>
                </div>
                <iframe
                  title="email-preview"
                  srcDoc={emailPreview.html}
                  className="w-full h-[520px] rounded border bg-white"
                  sandbox=""
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmedPreview}
                    onChange={(e) => setConfirmedPreview(e.target.checked)}
                  />
                  <span>미리보기를 확인했고 이 내용 그대로 발송하는 것에 동의합니다.</span>
                </label>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">"미리보기 생성" 버튼을 눌러 실제 발송되는 메일을 확인하세요.</p>
            )}
          </div>

          {/* Test send */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">테스트 발송 (현재 제목/본문 그대로 1건만)</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="본인 이메일 (예: you@gmail.com)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button onClick={sendTest} disabled={testSending} variant="outline">
                {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>


          {/* Preview */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">발송 대상 미리보기</p>
              <Button size="sm" variant="outline" onClick={loadPreview} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                계산
              </Button>
            </div>
            <label className="flex items-start gap-2 rounded border bg-muted/20 p-2 text-sm">
              <input
                type="checkbox"
                checked={includeAlreadySent}
                onChange={(e) => { setIncludeAlreadySent(e.target.checked); setPreview(null); }}
                className="mt-1"
              />
              <span>이미 기존 설문 메일을 받은 미응답자에게도 새 이메일 설문을 다시 발송합니다.</span>
            </label>
            {preview ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
                <div className="rounded border p-2"><div className="text-lg font-bold">{preview.totalUsers}</div><div className="text-muted-foreground">전체 가입자</div></div>
                <div className="rounded border p-2"><div className="text-lg font-bold">{preview.responded}</div><div className="text-muted-foreground">이미 응답</div></div>
                <div className="rounded border p-2"><div className="text-lg font-bold">{preview.alreadySent}</div><div className="text-muted-foreground">이미 발송</div></div>
                <div className="rounded border p-2"><div className="text-lg font-bold">{preview.optOut}</div><div className="text-muted-foreground">수신거부</div></div>
                <div className="rounded border-2 border-primary p-2 bg-primary/5"><div className="text-lg font-bold text-primary">{preview.toSend}</div><div className="text-muted-foreground">실제 발송</div></div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">"계산" 버튼을 눌러 발송 대상을 확인하세요.</p>
            )}
          </div>

          {/* Broadcast */}
          <Button
            onClick={runBroadcast}
            disabled={broadcasting || !preview || preview.toSend === 0 || !confirmedPreview}
            className="w-full"
            size="lg"
          >
            {broadcasting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />발송 중... (잠시만 기다려주세요)</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />{preview ? `${preview.toSend}명에게 전체 발송` : "전체 발송"}{!confirmedPreview ? " (미리보기 확인 필요)" : ""}</>
            )}
          </Button>


          {broadcastResult && (
            <div className="rounded-lg border p-3 bg-muted/30 text-sm">
              <p className="font-medium mb-1">발송 결과</p>
              <p className="text-muted-foreground">총 {broadcastResult.total}명 · 성공 {broadcastResult.sent} · 실패 {broadcastResult.failed}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            ※ Resend 발송 한도(플랜에 따라 다름)를 초과하면 일부 메일이 실패할 수 있습니다. 메일 푸터에 수신거부 링크가 포함됩니다.
          </p>
        </CardContent>
      </Card>

      {/* Email sending (Gmail BCC backup) */}
      <Card>
        <CardHeader>
          <CardTitle>3. (백업) Gmail BCC로 직접 발송</CardTitle>
          <CardDescription>
            Resend 발송이 어렵거나 수동 검토가 필요한 경우 사용하세요.
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
            <CardTitle>4. 응답 통계</CardTitle>
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
