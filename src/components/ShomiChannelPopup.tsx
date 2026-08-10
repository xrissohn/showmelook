import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import shomiHero from "@/assets/shomi-channel-hero.png.asset.json";
import { SHOMI_CHANNELS } from "@/lib/shomiChannels";

const STORAGE_KEY = "shomi_channel_popup_dismissed_at";
const HIDE_DAYS = 7;

const CHANNELS = SHOMI_CHANNELS;

// Brand SVG icons (official monograms)
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.86 5.86 0 0 0-2.13 1.38A5.86 5.86 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.73 1.46 1.38 2.13.67.65 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.13-1.38 5.86 5.86 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.13A5.86 5.86 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0z"/>
    <path d="M12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4z"/>
    <circle cx="18.41" cy="5.59" r="1.44"/>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/>
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.51a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.94z" />
  </svg>
);

const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.18 24h-.05C8.61 23.98 5.92 22.84 4.13 20.6 2.55 18.6 1.74 15.84 1.71 12.4v-.02C1.74 8.94 2.55 6.18 4.13 4.18 5.92 1.94 8.61.8 12.13.78h.05c2.7.02 4.95.66 6.7 1.92 1.65 1.18 2.81 2.86 3.45 4.99l-2.04.62c-1.09-3.6-3.74-5.44-7.92-5.47-2.78.02-4.88.92-6.25 2.66-1.28 1.62-1.94 3.97-1.97 6.98.03 3.01.69 5.36 1.97 6.98 1.37 1.74 3.47 2.64 6.25 2.66 2.51-.02 4.17-.61 5.55-1.97.61-.6 1.05-1.27 1.36-2.01-.45-2.02-2.01-3.18-4.93-3.65-2.07-.34-3.99-.04-5.13.79-.71.52-1.04 1.18-.97 1.96.13 1.4 1.79 2.34 3.93 2.18 2.6-.2 3.61-1.5 3.45-4.21l1.92-.7c.16 2.45-.62 4.21-2.34 5.4-1.4.97-3.36 1.31-5.31 1.13-2.7-.25-4.81-1.95-5.05-4.61-.13-1.42.39-2.7 1.49-3.51 1.46-1.07 3.78-1.45 6.27-1.04 3.13.51 5.41 2.13 6.43 4.59l.06.16-.07.16c-.44 1.02-1.04 1.92-1.81 2.66-1.78 1.74-3.91 2.5-6.96 2.52z" />
  </svg>
);

export default function ShomiChannelPopup() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isForced =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("showPopup") === "1";

  useEffect(() => {
    // Landing page only (or forced via ?showPopup=1)
    if (location.pathname !== "/" && !isForced) return;

    if (!isForced) {
      try {
        const dismissedAt = localStorage.getItem(STORAGE_KEY);
        if (dismissedAt) {
          const elapsed = Date.now() - parseInt(dismissedAt, 10);
          if (elapsed < HIDE_DAYS * 24 * 60 * 60 * 1000) return;
        }
      } catch {
        /* ignore */
      }
    }
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [location.pathname, isForced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = () => {
    if (!isForced) {
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  if (!open) return null;

  const channelButtons = [
    {
      label: "Instagram",
      href: CHANNELS.instagram,
      icon: <InstagramIcon className="w-5 h-5" />,
      style: "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white",
    },
    {
      label: "YouTube",
      href: CHANNELS.youtube,
      icon: <YoutubeIcon className="w-5 h-5" />,
      style: "bg-[#FF0000] text-white",
    },
    {
      label: "TikTok",
      href: CHANNELS.tiktok,
      icon: <TikTokIcon className="w-5 h-5" />,
      style: "bg-black text-white",
    },
    {
      label: "Threads",
      href: CHANNELS.threads,
      icon: <ThreadsIcon className="w-5 h-5" />,
      style: "bg-[#101010] text-white",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shomi-popup-title"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0a0a1f]/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[90vw] max-w-[480px] max-h-[92vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#fff7fb] via-white to-[#fdf2f7] shadow-[0_25px_80px_-20px_rgba(30,27,75,0.45)] ring-1 ring-pink-100 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-sm flex items-center justify-center text-[#1e1b4b] transition"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero image */}
        <div className="relative w-full aspect-[4/5] sm:aspect-[5/4] overflow-hidden rounded-t-3xl bg-gradient-to-br from-pink-100 to-indigo-100">
          <img
            src={shomiHero.url}
            alt="쇼미 - 네이비와 핑크 스타일"
            className="w-full h-full object-cover object-top"
            loading="eager"
          />
          {/* Soft gradient overlay at bottom for text continuity */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/60 to-transparent" />
          {/* Brand chip */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur text-[11px] font-semibold tracking-wide text-[#1e1b4b]">
            SHOWMELOOK · 쇼미
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-6 sm:px-7 sm:pt-6 sm:pb-7">
          <h2
            id="shomi-popup-title"
            className="text-[22px] sm:text-2xl font-bold leading-snug text-[#1e1b4b] tracking-tight"
          >
            쇼미의 스타일 채널이 오픈됐어 <span className="text-pink-500">✨</span>
          </h2>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-600">
            성수동 일상, 룩 추천, 스타일 팁을
            <br />
            <span className="font-medium text-[#1e1b4b]">Instagram · YouTube · TikTok · Threads</span>
            에서 만나봐.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-pink-500/90 font-medium">
            룩 고민되면 쇼미에게 물어봐. 추천해줄게.
          </p>

          {/* Channel buttons */}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {channelButtons.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${c.style}`}
              >
                {c.icon}
                <span>{c.label}</span>
              </a>
            ))}
          </div>

          {/* Dismiss */}
          <button
            onClick={handleClose}
            className="mt-4 w-full text-center text-[13px] text-slate-400 hover:text-slate-600 transition py-2"
          >
            나중에 볼게 · 7일 동안 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
