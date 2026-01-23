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
