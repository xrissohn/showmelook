import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Kakao SDK on app start
const initKakao = () => {
  const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
  const Kakao = (window as any).Kakao;
  
  if (Kakao && !Kakao.isInitialized() && kakaoKey) {
    try {
      Kakao.init(kakaoKey);
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
