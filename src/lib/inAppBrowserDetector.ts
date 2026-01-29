/**
 * 인앱 브라우저 감지 유틸리티
 * Google OAuth는 보안 정책상 WebView/인앱 브라우저에서 차단됨
 */

export interface InAppBrowserInfo {
  isInAppBrowser: boolean;
  browserName: string | null;
  isIOS: boolean;
  isAndroid: boolean;
}

/**
 * 인앱 브라우저 목록 (User-Agent 키워드)
 */
const IN_APP_BROWSER_PATTERNS = [
  // 한국 메신저
  { pattern: /KAKAOTALK/i, name: '카카오톡' },
  { pattern: /NAVER\(/i, name: '네이버 앱' },
  
  // 글로벌 메신저
  { pattern: /Line\//i, name: '라인' },
  { pattern: /WhatsApp/i, name: 'WhatsApp' },
  { pattern: /Telegram/i, name: '텔레그램' },
  
  // Meta 계열
  { pattern: /Instagram/i, name: '인스타그램' },
  { pattern: /FBAN|FBAV/i, name: '페이스북' },
  { pattern: /FB_IAB/i, name: '페이스북' },
  { pattern: /Messenger/i, name: 'Messenger' },
  
  // SNS
  { pattern: /Twitter/i, name: '트위터/X' },
  { pattern: /Snapchat/i, name: '스냅챗' },
  { pattern: /BytedanceWebview|TikTok/i, name: '틱톡' },
  { pattern: /Pinterest/i, name: '핀터레스트' },
  
  // 기타
  { pattern: /DaumApps/i, name: '다음 앱' },
  { pattern: /BAND\//i, name: '밴드' },
  
  // 일반 WebView 패턴 (마지막 체크)
  { pattern: /\bwv\b/i, name: '앱 내 브라우저' },
  { pattern: /WebView/i, name: '앱 내 브라우저' },
];

/**
 * 현재 브라우저가 인앱 브라우저인지 감지
 */
export function detectInAppBrowser(): InAppBrowserInfo {
  const userAgent = navigator.userAgent || '';
  
  // iOS/Android 감지
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  
  // 인앱 브라우저 감지
  for (const { pattern, name } of IN_APP_BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      return {
        isInAppBrowser: true,
        browserName: name,
        isIOS,
        isAndroid,
      };
    }
  }
  
  // 추가: iOS에서 Safari가 아닌 경우 WebView일 가능성
  if (isIOS && !/Safari/i.test(userAgent) && /AppleWebKit/i.test(userAgent)) {
    return {
      isInAppBrowser: true,
      browserName: '앱 내 브라우저',
      isIOS,
      isAndroid,
    };
  }
  
  return {
    isInAppBrowser: false,
    browserName: null,
    isIOS,
    isAndroid,
  };
}

/**
 * 외부 브라우저로 열기 위한 URL 생성 (Android Intent)
 */
export function getExternalBrowserUrl(url: string, isAndroid: boolean): string | null {
  if (isAndroid) {
    // Android Chrome Intent
    const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
    return `intent://${urlWithoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  // iOS는 직접 URL을 열어야 하므로 null 반환 (사용자가 링크 복사 필요)
  return null;
}

/**
 * 클립보드에 URL 복사
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}
