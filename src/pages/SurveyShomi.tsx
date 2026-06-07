import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Sparkles, X, ZoomIn, Gift } from "lucide-react";
import showmelookLogo from "@/assets/showmelook-korean-logo.png";
import showmelookFullLogo from "@/assets/showmelook-full-logo.png.asset.json";
import shomiACharacter from "@/assets/shomi-a-character.png.asset.json";
import shomiBCharacter from "@/assets/shomi-b-character.png.asset.json";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const IMG_A = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-a.png`;
const IMG_B = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-b.png`;

const SurveyShomi = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [choice, setChoice] = useState<"A" | "B" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState<string>("");

  const urlStatus = searchParams.get("status");
  const urlChoice = searchParams.get("choice");
  const urlToken = searchParams.get("token");

  useEffect(() => {
    if (authLoading) return;

    // Email-link flow: token + choice present → submit directly via HMAC token (no login required)
    if (urlToken && (urlChoice === "A" || urlChoice === "B") && urlStatus !== "completed" && urlStatus !== "already") {
      (async () => {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/grant-survey-credit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: urlToken, choice: urlChoice }),
          });
          const json = await res.json().catch(() => ({}));
          if (json?.success || json?.already) {
            setSubmitted(true);
          } else {
            toast({ title: "제출 실패", description: json?.error || "다시 시도해주세요", variant: "destructive" });
          }
        } catch {
          toast({ title: "네트워크 오류", variant: "destructive" });
        } finally {
          setChecking(false);
        }
      })();
      return;
    }

    if (!user) {
      if (urlStatus === "completed" || urlStatus === "already") setSubmitted(true);
      setChecking(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("survey_responses")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data || urlStatus === "completed" || urlStatus === "already") setSubmitted(true);
      setChecking(false);
    })();
  }, [user, authLoading, urlStatus, urlToken, urlChoice, toast]);


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
        body: JSON.stringify({ choice }),
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

  if (submitted) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-background to-accent/5">
        {/* Decorative blurs */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative max-w-xl mx-auto px-4 py-10 md:py-16">
          <div className="flex justify-center mb-8">
            <img src={showmelookFullLogo.url} alt="ShowMeLook" className="h-24 md:h-28 w-auto" />
          </div>

          <Card className="border-accent/20 shadow-2xl backdrop-blur-sm bg-card/95">
            <CardContent className="p-8 md:p-12 text-center space-y-6">
              {(() => {
                const selected = (urlChoice || choice) as "A" | "B" | null;
                const characterSrc = selected === "B" ? shomiBCharacter.url : shomiACharacter.url;
                return (
                  <div className="relative mx-auto w-48 h-48 md:w-56 md:h-56">
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-accent via-primary to-magenta opacity-40 blur-2xl" />
                    <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-accent/40 shadow-2xl bg-gradient-to-br from-accent/10 to-primary/10">
                      <img
                        src={characterSrc}
                        alt={`시안 ${selected ?? "A"} 캐릭터`}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> 참여 완료
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  소중한 의견 감사합니다 💜
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                  {urlChoice ? (
                    <>선택하신 <span className="font-semibold text-foreground">시안 {urlChoice}</span>가 정상 기록되었습니다.</>
                  ) : (
                    <>응답이 정상 기록되었습니다.</>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-primary/5 p-5">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">지급 완료</p>
                    <p className="text-lg font-bold text-foreground">무료 10크레딧</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={() => navigate("/style")} size="lg" className="flex-1 bg-gradient-to-r from-accent to-primary hover:opacity-90">
                  <Sparkles className="w-4 h-4 mr-2" /> 스타일 만들러 가기
                </Button>
                <Button variant="outline" onClick={() => navigate("/mypage")} size="lg" className="flex-1">
                  크레딧 확인
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} ShowMeLook · AI 가상 피팅 서비스
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={showmelookLogo} alt="ShowMeLook" className="h-8 md:h-10 w-auto" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-3">
            <Sparkles className="w-4 h-4" /> 쇼미룩 AB 테스트
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            가상 인플루언서 '쇼미' 캐릭터, 어느 쪽이 더 좋으세요?
          </h1>
          <p className="text-muted-foreground">
            선택해주신 분께 <span className="text-accent font-semibold">무료 10크레딧</span>을 지급해드려요.
          </p>
        </header>

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
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setZoomImage(opt.src); setZoomLabel(opt.label); }}
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
