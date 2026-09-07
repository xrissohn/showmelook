import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Kakao JavaScript App Key (Publishable)
const KAKAO_JS_KEY = 'e5f9085240afd55f52cc0a0a37081761';

// Initialize Kakao SDK on app start
const initKakao = () => {
  const Kakao = (window as any).Kakao;
  
  if (Kakao && !Kakao.isInitialized() && KAKAO_JS_KEY) {
    try {
      Kakao.init(KAKAO_JS_KEY);
      console.log('Kakao SDK initialized successfully');
    } catch (e) {
      console.error('Kakao SDK initialization error:', e);
    }
  }
};

// Wait for Kakao SDK to load then initialize
if (document.readyState === 'complete') {
  initKakao();
} else {
  window.addEventListener('load', initKakao);
}

createRoot(document.getElementById("root")!).render(<App />);

// Auto-recover from stale chunk references (after redeploys).
// A missing chunk can surface either as a window error or as an unhandled
// promise rejection (React.lazy), so both are handled.
const isStaleChunkError = (message: string) =>
  message.includes('Failed to fetch dynamically imported module') ||
  message.includes('Importing a module script failed') ||
  message.includes('error loading dynamically imported module');

const recoverFromStaleChunk = () => {
  const reloadKey = '__chunk_reload_attempted__';
  if (sessionStorage.getItem(reloadKey)) return;
  sessionStorage.setItem(reloadKey, '1');

  const hardReload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', Date.now().toString(36));
    window.location.replace(url.toString());
  };

  const cleanup: Promise<unknown>[] = [];
  if ('serviceWorker' in navigator) {
    cleanup.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined),
    );
  }
  if ('caches' in window) {
    cleanup.push(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => undefined),
    );
  }
  Promise.all(cleanup).finally(hardReload);
};

window.addEventListener('error', (event) => {
  if (isStaleChunkError(event?.message || '')) recoverFromStaleChunk();
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const message = typeof reason === 'string' ? reason : reason?.message || '';
  if (isStaleChunkError(message)) recoverFromStaleChunk();
});



