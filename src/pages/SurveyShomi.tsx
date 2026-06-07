import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Sparkles, X, ZoomIn } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// Public bucket paths — admin uploads images to these fixed paths in `generated-looks` bucket
const IMG_A = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-a.png`;
const IMG_B = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-b.png`;

const SurveyShomi = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [choice, setChoice] = useState<"A" | "B" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState<string>("");
  const [postFeedback, setPostFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const urlStatus = searchParams.get("status"); // "completed" | "already" | "error" | "invalid"
  const urlChoice = searchParams.get("choice"); // "A" | "B"

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // From email link: status set but user not logged in → mark submitted view anyway
      if (urlStatus === "completed" || urlStatus === "already") {
        setSubmitted(true);
      }
      setChecking(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("survey_responses")
        .select("id, feedback")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSubmitted(true);
        if (data.feedback) setFeedbackSaved(true);
      } else if (urlStatus === "completed" || urlStatus === "already") {
        setSubmitted(true);
      }
      setChecking(false);
    })();
  }, [user, authLoading, urlStatus]);

  const handleSubmitFeedback = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent("/survey/shomi")}`);
      return;
    }
    if (!postFeedback.trim()) {
      toast({ title: "의견을 입력해주세요", variant: "destructive" });
      return;
    }
    setSavingFeedback(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/grant-survey-credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ feedbackOnly: true, feedback: postFeedback.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackSaved(true);
        toast({ title: "의견 감사합니다! 💜", description: "소중한 피드백이 저장되었어요." });
      } else {
        toast({ title: "저장 실패", description: json.error || "잠시 후 다시 시도해주세요", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent("/survey/shomi")}`);
      return;
    }
    if (!choice) {
      toast({ title: "시안을 선택해주세요", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/grant-survey-credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ choice, feedback: feedback.trim() || null }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
        toast({ title: "감사합니다! 🎉", description: "10크레딧이 지급되었습니다." });
      } else if (json.already) {
        setSubmitted(true);
        toast({ title: "이미 참여하셨어요" });
      } else {
        toast({ title: "제출 실패", description: json.error || "잠시 후 다시 시도해주세요", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-3">
            <Sparkles className="w-4 h-4" /> 쇼미룩 AB 테스트
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            가상 인플루언서 '쇼미' 캐릭터, 어느 쪽이 더 좋으세요?
          </h1>
          <p className="text-muted-foreground">
            의견을 남겨주신 분께 <span className="text-accent font-semibold">무료 10크레딧</span>을 지급해드려요.
          </p>
        </header>

        {submitted ? (
          <Card>
            <CardContent className="p-8 md:p-10 space-y-5">
              <div className="text-center space-y-3">
                <CheckCircle2 className="w-16 h-16 text-accent mx-auto" />
                <h2 className="text-2xl font-bold">참여 완료!</h2>
                <p className="text-muted-foreground">
                  {urlChoice ? <>선택하신 <span className="font-semibold text-foreground">시안 {urlChoice}</span>가 정상 기록되었습니다. </> : null}
                  소중한 의견 감사합니다. 10크레딧이 계정에 적립되었어요.
                </p>
              </div>

              {user ? (
                feedbackSaved ? (
                  <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-center">
                    <p className="text-sm text-foreground font-medium">💜 의견이 저장되었습니다. 감사합니다!</p>
                  </div>
                ) : (
                  <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
                    <label className="text-sm font-medium text-foreground block">
                      ✍️ 주관식 의견을 남겨주세요 <span className="text-muted-foreground">(선택, 최대 500자)</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      추가 의견을 남기셔도 별도 크레딧은 지급되지 않지만, 서비스 개선에 큰 도움이 됩니다.
                    </p>
                    <Textarea
                      value={postFeedback}
                      onChange={(e) => setPostFeedback(e.target.value.slice(0, 500))}
                      placeholder="어떤 점이 마음에 드시나요? 개선했으면 하는 부분이 있나요?"
                      rows={4}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{postFeedback.length}/500</p>
                      <Button
                        size="sm"
                        disabled={!postFeedback.trim() || savingFeedback}
                        onClick={handleSubmitFeedback}
                      >
                        {savingFeedback ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />저장 중...</>
                        ) : (
                          "의견 등록"
                        )}
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-muted/40 border border-border rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    추가 의견을 남기시려면 로그인이 필요합니다.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/auth?redirect=${encodeURIComponent("/survey/shomi?status=completed")}`)}>
                    로그인하고 의견 남기기
                  </Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button onClick={() => navigate("/style")} size="lg">스타일 생성하러 가기</Button>
                <Button variant="outline" onClick={() => navigate("/mypage")} size="lg">크레딧 확인</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {([
                { key: "A" as const, src: IMG_A, label: "시안 A" },
                { key: "B" as const, src: IMG_B, label: "시안 B" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setChoice(opt.key)}
                  className={`group relative rounded-2xl overflow-hidden border-2 transition-all bg-card ${
                    choice === opt.key
                      ? "border-accent shadow-lg scale-[1.01]"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="aspect-[3/4] bg-muted relative">
                    <img
                      src={opt.src}
                      alt={opt.label}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomImage(opt.src);
                        setZoomLabel(opt.label);
                      }}
                      className="absolute bottom-3 right-3 p-2 rounded-full bg-background/80 hover:bg-background text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${opt.label} 확대 보기`}
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-background/90 text-foreground font-bold text-sm">
                    {opt.label}
                  </div>
                  {choice === opt.key && (
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <Card className="mb-6">
              <CardContent className="p-6 space-y-3">
                <label className="text-sm font-medium text-foreground">
                  의견을 자유롭게 남겨주세요 <span className="text-muted-foreground">(선택, 최대 500자)</span>
                </label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
                  placeholder="어떤 점이 마음에 드시나요? 개선했으면 하는 부분이 있나요?"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground text-right">{feedback.length}/500</p>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full"
              disabled={!choice || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />제출 중...</>
              ) : (
                "제출하고 10크레딧 받기"
              )}
            </Button>
            {!user && (
              <p className="text-center text-sm text-muted-foreground mt-3">
                제출하려면 로그인이 필요합니다.
              </p>
            )}
          </>
        )}
      </div>

      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-4xl w-full">
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="닫기"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={zoomImage}
              alt={zoomLabel}
              className="w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-center text-white/80 mt-3 text-sm font-medium">{zoomLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyShomi;
