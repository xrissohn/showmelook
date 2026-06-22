import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Mail, Eye } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const DEFAULT_SUBJECT = "[쇼미룩] 쇼미룩의 모델 '쇼미'를 소개합니다 ✨ 채널 4곳도 함께 오픈!";
const DEFAULT_BODY = `안녕하세요, 쇼미룩입니다.

쇼미룩을 대표하는 가상 모델 '쇼미'가 새롭게 선정됐어요.
성수동 감성의 일상룩, 트렌디한 코디, 스타일 팁을
쇼미와 함께 더 가깝게 만나보실 수 있도록
인스타그램 · 유튜브 · 틱톡 · 스레드 4개 채널을 동시에 오픈했습니다.

룩이 고민될 땐 언제든 쇼미에게 물어봐 주세요.
쇼미룩 AI가 당신에게 어울리는 코디를 추천해드립니다.`;

export const ShomiChannelBroadcastPanel = () => {
  const { toast } = useToast();
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [bodyText, setBodyText] = useState(DEFAULT_BODY);
  const [preview, setPreview] = useState<{ totalUsers: number; alreadySent: number; optOut: number; toSend: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string } | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [includeAlreadySent, setIncludeAlreadySent] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-shomi-channel-broadcast`, {
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

  const renderPreview = async () => {
    setRenderingPreview(true);
    try {
      const r = await call({ mode: "render", subject, bodyText });
      setEmailPreview(r);
    } catch (e: any) {
      toast({ title: "미리보기 실패", description: e?.message, variant: "destructive" });
    } finally {
      setRenderingPreview(false);
    }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const r = await call({ mode: "preview", includeAlreadySent });
      setPreview(r);
    } catch (e: any) {
      toast({ title: "수신자 미리보기 실패", description: e?.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail) { toast({ title: "이메일을 입력하세요", variant: "destructive" }); return; }
    setTestSending(true);
    try {
      const r = await call({ mode: "test", testEmail, subject, bodyText });
      if (r.ok) toast({ title: "테스트 메일 발송 완료", description: testEmail });
      else throw new Error(r.error || "전송 실패");
    } catch (e: any) {
      toast({ title: "테스트 실패", description: e?.message, variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  const broadcast = async () => {
    if (!confirmedPreview) {
      toast({ title: "먼저 미리보기를 확인하세요", variant: "destructive" });
      return;
    }
    if (!confirm(`정말 ${preview?.toSend ?? "?"}명에게 발송하시겠습니까?`)) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const r = await call({ mode: "broadcast", subject, bodyText, includeAlreadySent });
      setBroadcastResult(r);
      toast({ title: "발송 완료", description: `성공 ${r.sent} / 실패 ${r.failed}` });
    } catch (e: any) {
      toast({ title: "발송 실패", description: e?.message, variant: "destructive" });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> 쇼미 모델 & 채널 개설 안내 메일
          </CardTitle>
          <CardDescription>
            팝업 이미지와 4개 SNS 채널 링크를 포함한 단체 메일을 발송합니다. 수신거부한 사용자는 자동 제외됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">제목</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">본문</label>
            <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={9} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={renderPreview} variant="outline" disabled={renderingPreview}>
              {renderingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              메일 미리보기
            </Button>
            <Button onClick={loadPreview} variant="outline" disabled={previewLoading}>
              {previewLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              수신자 수 확인
            </Button>
          </div>

          {emailPreview && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 text-sm font-medium">제목: {emailPreview.subject}</div>
              <iframe
                srcDoc={emailPreview.html}
                title="email-preview"
                className="w-full"
                style={{ height: 700, background: "#f3f4f6" }}
              />
              <div className="p-3 bg-muted/50 text-right">
                <Button size="sm" variant={confirmedPreview ? "default" : "outline"} onClick={() => setConfirmedPreview(true)}>
                  {confirmedPreview ? "✓ 미리보기 확인됨" : "미리보기 확인했어요"}
                </Button>
              </div>
            </div>
          )}

          {preview && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">전체 회원: {preview.totalUsers}</Badge>
              <Badge variant="outline">이미 발송: {preview.alreadySent}</Badge>
              <Badge variant="outline">수신거부: {preview.optOut}</Badge>
              <Badge>발송 대상: {preview.toSend}</Badge>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <input
              id="include-sent"
              type="checkbox"
              checked={includeAlreadySent}
              onChange={(e) => setIncludeAlreadySent(e.target.checked)}
            />
            <label htmlFor="include-sent">이미 발송된 사용자에게도 다시 보내기 (재발송)</label>
          </div>

          <div className="border-t pt-4 space-y-2">
            <label className="text-sm font-medium">테스트 발송</label>
            <div className="flex gap-2">
              <Input
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button onClick={sendTest} disabled={testSending} variant="secondary">
                {testSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                테스트
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Button
              onClick={broadcast}
              disabled={broadcasting || !confirmedPreview || !preview}
              className="w-full"
              size="lg"
            >
              {broadcasting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              전체 발송 ({preview?.toSend ?? "?"}명)
            </Button>
            {!confirmedPreview && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                먼저 메일 미리보기를 확인하고 "미리보기 확인했어요" 버튼을 눌러야 발송할 수 있어요.
              </p>
            )}
          </div>

          {broadcastResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <div className="font-semibold text-green-800">발송 완료</div>
              <div className="mt-1 text-green-700">
                전체 {broadcastResult.total} · 성공 {broadcastResult.sent} · 실패 {broadcastResult.failed}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
