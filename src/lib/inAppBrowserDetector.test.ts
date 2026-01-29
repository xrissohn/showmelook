import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 테스트를 위해 navigator.userAgent를 모킹할 수 있도록 함수를 수정
const IN_APP_BROWSER_PATTERNS = [
  { pattern: /KAKAOTALK/i, name: '카카오톡' },
  { pattern: /NAVER\(/i, name: '네이버 앱' },
  { pattern: /Line\//i, name: '라인' },
  { pattern: /WhatsApp/i, name: 'WhatsApp' },
  { pattern: /Telegram/i, name: '텔레그램' },
  { pattern: /Instagram/i, name: '인스타그램' },
  { pattern: /FBAN|FBAV/i, name: '페이스북' },
  { pattern: /FB_IAB/i, name: '페이스북' },
  { pattern: /Messenger/i, name: 'Messenger' },
  { pattern: /Twitter/i, name: '트위터/X' },
  { pattern: /Snapchat/i, name: '스냅챗' },
  { pattern: /BytedanceWebview|TikTok/i, name: '틱톡' },
  { pattern: /Pinterest/i, name: '핀터레스트' },
  { pattern: /DaumApps/i, name: '다음 앱' },
  { pattern: /BAND\//i, name: '밴드' },
  { pattern: /\bwv\b/i, name: '앱 내 브라우저' },
  { pattern: /WebView/i, name: '앱 내 브라우저' },
];

function detectInAppBrowserFromUA(userAgent: string) {
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  
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

describe('인앱 브라우저 감지', () => {
  describe('카카오톡', () => {
    it('Android 카카오톡 감지', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.3';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('카카오톡');
      expect(result.isAndroid).toBe(true);
    });
    
    it('iOS 카카오톡 감지', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.3';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('카카오톡');
      expect(result.isIOS).toBe(true);
    });
  });
  
  describe('네이버 앱', () => {
    it('Android 네이버 앱 감지', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1100; 12.8.3)';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('네이버 앱');
    });
  });
  
  describe('인스타그램', () => {
    it('Android 인스타그램 감지', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 320.0.0.0.64';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('인스타그램');
    });
    
    it('iOS 인스타그램 감지', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.64';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('인스타그램');
      expect(result.isIOS).toBe(true);
    });
  });
  
  describe('페이스북', () => {
    it('페이스북 앱 감지 (FBAN)', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/450.0.0.0;FBBV/123456789]';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('페이스북');
    });
  });
  
  describe('라인', () => {
    it('라인 앱 감지', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.0.0';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('라인');
    });
  });
  
  describe('틱톡', () => {
    it('틱톡 앱 감지', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 BytedanceWebview/d8a21c6';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('틱톡');
    });
  });
  
  describe('일반 브라우저 (인앱 아님)', () => {
    it('Chrome 브라우저는 인앱 브라우저가 아님', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(false);
      expect(result.browserName).toBeNull();
    });
    
    it('Safari 브라우저는 인앱 브라우저가 아님', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(false);
      expect(result.browserName).toBeNull();
      expect(result.isIOS).toBe(true);
    });
    
    it('삼성 인터넷 브라우저는 인앱 브라우저가 아님', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(false);
      expect(result.browserName).toBeNull();
    });
  });
  
  describe('밴드/다음', () => {
    it('밴드 앱 감지', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 BAND/9.5.0';
      const result = detectInAppBrowserFromUA(ua);
      
      expect(result.isInAppBrowser).toBe(true);
      expect(result.browserName).toBe('밴드');
    });
  });
});
