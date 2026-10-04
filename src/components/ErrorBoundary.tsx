import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

const COPY = {
  ko: {
    title: "화면을 불러오는 중 문제가 있었어요",
    body: "잠깐의 오류로 화면이 닫혔어요. 새로고침하면 대부분 바로 다시 사용할 수 있어요.",
    reload: "새로고침",
    home: "홈으로",
  },
  en: {
    title: "Something went wrong while loading this screen",
    body: "A brief error closed the screen. Refreshing usually gets you right back in.",
    reload: "Refresh",
    home: "Go home",
  },
};

/**
 * Keeps a render or effect-cleanup crash from blanking the whole page:
 * the subtree is dropped and a recovery card is shown instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ShowMeLook screen error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    let en = false;
    try {
      en = localStorage.getItem("lang") === "en";
    } catch {
      en = false;
    }
    const t = en ? COPY.en : COPY.ko;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            !
          </div>
          <h1 className="font-korean text-lg font-semibold">{t.title}</h1>
          <p className="font-korean mt-2 text-sm text-muted-foreground">{t.body}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="font-korean rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t.reload}
            </button>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="font-korean rounded-full border border-border px-5 py-2 text-sm"
            >
              {t.home}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
