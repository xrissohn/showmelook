import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Meh, RefreshCw, ThumbsDown, ThumbsUp, X, Mail } from "lucide-react";
import { MODERATION_LABELS_KO, type ModerationCategory } from "../../../supabase/functions/_shared/feedbackLearning";

type Flagged = {
  id: string;
  rating: number;
  comment: string | null;
  moderation_categories: string[];
  prompt_used: string | null;
  look_id: string;
  created_at: string;
};
type Insight = { id: string; summary: string; insight_lines: string[]; status: string; source_feedback_count: number; created_at: string };
type Report = { id: string; created_at: string; stats: { total?: number; up?: number; neutral?: number; down?: number; usableComments?: number }; flagged_count: number; email_recipients: string[]; emailed_at: string | null; summary: string };

const RatingIcon = ({ rating }: { rating: number }) =>
  rating > 0 ? <ThumbsUp className="w-4 h-4 text-green-600" /> : rating < 0 ? <ThumbsDown className="w-4 h-4 text-orange-600" /> : <Meh className="w-4 h-4 text-amber-600" />;

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 피드백 & 학습: 보류된(민감한) 의견을 결정하고, 학습으로 만들어진 추천 가이드를 켜고 끄고, 리포트를 본다.
 * 선정적·종교·정치·혐오 등 민감한 의견은 학습에 쓰이지 않고 여기서 관리자가 승인/제외를 결정한다.
 */
export const FeedbackLearningPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [counts, setCounts] = useState({ total: 0, up: 0, neutral: 0, down: 0 });
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const [recent, pending, ins, rep] = await Promise.all([
      supabase.from("look_feedback").select("rating").gte("created_at", since).limit(5000),
      supabase.from("look_feedback").select("id, rating, comment, moderation_categories, prompt_used, look_id, created_at").eq("moderation_status", "flagged").order("created_at", { ascending: false }).limit(50),
      supabase.from("recommendation_insights").select("id, summary, insight_lines, status, source_feedback_count, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("feedback_reports").select("id, created_at, stats, flagged_count, email_recipients, emailed_at, summary").order("created_at", { ascending: false }).limit(10),
    ]);
    const rows = (recent.data ?? []) as Array<{ rating: number }>;
    setCounts({ total: rows.length, up: rows.filter((r) => r.rating > 0).length, neutral: rows.filter((r) => r.rating === 0).length, down: rows.filter((r) => r.rating < 0).length });
    setFlagged((pending.data ?? []) as Flagged[]);
    setInsights((ins.data ?? []) as Insight[]);
    setReports((rep.data ?? []) as unknown as Report[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    setBusyId(id);
    const { error } = await supabase.from("look_feedback").update({ moderation_status: status, decided_by: user.id, decided_at: new Date().toISOString() }).eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "처리하지 못했어요", description: error.message, variant: "destructive" });
      return;
    }
    setFlagged((f) => f.filter((x) => x.id !== id));
    toast({ title: status === "approved" ? "승인했어요 — 다음 학습부터 반영돼요" : "제외했어요 — 학습에 쓰지 않아요" });
  };

  const toggleInsight = async (i: Insight) => {
    if (!user) return;
    const next = i.status === "active" ? "disabled" : "active";
    setBusyId(i.id);
    const { error } = await supabase.from("recommendation_insights").update({ status: next, decided_by: user.id, decided_at: new Date().toISOString() }).eq("id", i.id);
    setBusyId(null);
    if (error) {
      toast({ title: "변경하지 못했어요", description: error.message, variant: "destructive" });
      return;
    }
    setInsights((list) => list.map((x) => (x.id === i.id ? { ...x, status: next } : x)));
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("feedback-learning-report", { body: { force: true } });
      if (error) throw error;
      toast({
        title: data?.skipped ? "새 피드백이 없어요" : "리포트를 만들었어요",
        description: data?.reportId ? `반영한 가이드 ${data.insightsApplied ?? 0}개 · 이메일 ${data.emailsQueued ?? 0}통${data.warning === "no_recipients" ? " (수신자가 없어요)" : ""}` : undefined,
      });
      await load();
    } catch (e) {
      toast({ title: "리포트를 만들지 못했어요", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">피드백 & 학습</h2>
          <p className="text-sm text-muted-foreground">
            사용자의 좋아요/보통/별로예요와 의견으로 추천이 자동으로 업그레이드돼요. 민감한 의견은 학습에서 빼고 여기서 결정해요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
            지금 리포트 만들기
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "최근 30일 피드백", value: counts.total },
          { label: "좋아요", value: counts.up },
          { label: "보통", value: counts.neutral },
          { label: "별로예요", value: counts.down },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            결정이 필요한 의견 <Badge variant={flagged.length ? "destructive" : "secondary"}>{flagged.length}</Badge>
          </CardTitle>
          <CardDescription>선정적·종교·정치·혐오·폭력·불법·개인정보·욕설·스팸으로 분류된 의견이에요. 승인하면 다음 학습부터 쓰이고, 제외하면 쓰이지 않아요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {flagged.length === 0 && <p className="text-sm text-muted-foreground">결정을 기다리는 의견이 없어요.</p>}
          {flagged.map((f) => (
            <div key={f.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <RatingIcon rating={f.rating} />
                <span>{fmt(f.created_at)}</span>
                {f.moderation_categories.map((c) => (
                  <Badge key={c} variant="outline">{MODERATION_LABELS_KO[c as ModerationCategory] ?? c}</Badge>
                ))}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{f.comment}</p>
              {f.prompt_used && <p className="text-xs text-muted-foreground">요청: {f.prompt_used}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busyId === f.id} onClick={() => decide(f.id, "approved")}>
                  <Check className="w-4 h-4 mr-1" /> 승인 (학습에 사용)
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === f.id} onClick={() => decide(f.id, "rejected")}>
                  <X className="w-4 h-4 mr-1" /> 제외
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">학습한 추천 가이드</CardTitle>
          <CardDescription>켜져 있는 가이드는 다음 추천부터 AI 프롬프트에 참고로 들어가요(사용자의 이번 요청이 항상 우선). 이상하면 꺼 주세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 && <p className="text-sm text-muted-foreground">아직 학습된 가이드가 없어요.</p>}
          {insights.map((i) => (
            <div key={i.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{fmt(i.created_at)} · 피드백 {i.source_feedback_count}건 기준</span>
                <Button size="sm" variant={i.status === "active" ? "default" : "outline"} disabled={busyId === i.id} onClick={() => toggleInsight(i)}>
                  {i.status === "active" ? "켜짐" : "꺼짐"}
                </Button>
              </div>
              {i.summary && <p className="text-sm">{i.summary}</p>}
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {i.insight_lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">리포트 기록</CardTitle>
          <CardDescription>리포트는 만들어질 때마다 관리자 이메일로도 발송돼요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 && <p className="text-sm text-muted-foreground">아직 리포트가 없어요. 새 피드백이 쌓이면 하루 한 번 자동으로 만들어져요.</p>}
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium">{fmt(r.created_at)}</span>
                <span className="text-xs text-muted-foreground">
                  👍{r.stats.up ?? 0} · 😐{r.stats.neutral ?? 0} · 👎{r.stats.down ?? 0} · 보류 {r.flagged_count}건 ·{" "}
                  {r.emailed_at ? `이메일 ${r.email_recipients.length}명 발송` : "이메일 미발송"}
                </span>
              </div>
              {r.summary && <p className="text-muted-foreground mt-1">{r.summary}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackLearningPanel;
