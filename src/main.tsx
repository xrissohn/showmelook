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

// Auto-recover from stale chunk references (after redeploys)
// When a dynamic import fails because the old chunk no longer exists,
// unregister the service worker and reload once to fetch the fresh index.html.
window.addEventListener('error', (event) => {
  const message = event?.message || '';
  if (message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed')) {
    const reloadKey = '__chunk_reload_attempted__';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          Promise.all(regs.map((r) => r.unregister())).finally(() => window.location.reload());
        }).catch(() => window.location.reload());
      } else {
        window.location.reload();
      }
    }
  }
});

// Register service worker after initial render (non-blocking)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
