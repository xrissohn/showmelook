import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Send, X, Loader2 } from "lucide-react";
import shomiAvatar from "@/assets/shomi-face-profile.png.asset.json";
import { useLanguage } from "@/contexts/LanguageContext";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/shomi-chat`;
const HIDDEN_PATHS = ["/cafe24-fitting", "/admin"];

function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export default function ShomiChatbot() {
  const { language } = useLanguage();
  const en = language === "en";
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Block body on purpose: a bare `() => el.scrollIntoView(...)` would hand
  // whatever the browser method returns to React as the cleanup function.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  const greeting = en
    ? "Hi, I'm Shomi! Ask me anything about ShowMeLook or what to wear today."
    : "안녕, 난 쇼미야! 쇼미룩 사용법이나 오늘 뭐 입을지 뭐든 물어봐.";
  const suggestions = en
    ? ["Who are you?", "How do tiers work?", "Date look ideas?"]
    : ["쇼미는 누구야?", "등급은 어떻게 올라가?", "데이트룩 추천해줘"];

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";
    const update = (content: string) =>
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content }]);
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ language, messages: history.slice(-6) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        update(err.error || (en ? "Shomi can't answer right now." : "쇼미가 지금 답하기 어려워."));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              update(acc);
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      if (!acc) update(en ? "Shomi can't answer right now." : "쇼미가 지금 답하기 어려워.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") update(en ? "Connection problem. Try again." : "연결이 불안정해. 다시 시도해 줘.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[60] flex h-[min(560px,calc(100vh-8rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <img src={shomiAvatar.url} alt="" className="h-9 w-9 rounded-full bg-background object-cover object-center" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{en ? "Shomi" : "쇼미"}</div>
              <div className="text-xs opacity-80">{en ? "ShowMeLook style curator" : "쇼미룩 스타일 큐레이터"}</div>
            </div>
            <button onClick={() => { abortRef.current?.abort(); setOpen(false); }} aria-label={en ? "Close chat" : "채팅 닫기"} className="rounded-full p-1.5 hover:bg-primary-foreground/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">{greeting}</div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                    m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted"
                  }`}
                >
                  {m.content ? renderText(m.content) : <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder={en ? "Ask Shomi..." : "쇼미에게 물어봐..."}
              className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label={en ? "Send" : "보내기"} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={en ? "Chat with Shomi" : "쇼미와 대화하기"}
        className="fixed bottom-5 right-4 z-[60] h-16 w-16 overflow-hidden rounded-full border-2 border-primary bg-background shadow-xl transition hover:scale-105"
      >
        <img src={shomiAvatar.url} alt="" className="h-full w-full object-cover object-center" />
      </button>
    </>
  );
}
