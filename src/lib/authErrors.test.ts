import { describe, it, expect } from 'vitest';
import { pickAuthLocale, normalizeAuthErrorCode, authErrorMessage } from './authErrors';
import { isPasswordAcceptable } from './passwordPolicy';

describe('auth error language', () => {
  it('Korean app always shows Korean', () => {
    expect(pickAuthLocale('ko', 'ja-JP')).toBe('ko');
  });
  it('English app follows supported browser languages', () => {
    expect(pickAuthLocale('en', 'ja-JP')).toBe('ja');
    expect(pickAuthLocale('en', 'zh-CN')).toBe('zhCN');
    expect(pickAuthLocale('en', 'zh-TW')).toBe('zhTW');
    expect(pickAuthLocale('en', 'vi-VN')).toBe('vi');
    expect(pickAuthLocale('en', 'es-MX')).toBe('es');
  });
  it('English app falls back to English for other browser languages', () => {
    expect(pickAuthLocale('en', 'fr-FR')).toBe('en');
    expect(pickAuthLocale('en', 'ko-KR')).toBe('en');
  });
});

describe('auth error codes', () => {
  it('maps Supabase codes and messages', () => {
    expect(normalizeAuthErrorCode('email_exists')).toBe('user_already_exists');
    expect(normalizeAuthErrorCode('over_email_send_rate_limit')).toBe('rate_limited');
    expect(normalizeAuthErrorCode(undefined, 'Invalid login credentials')).toBe('invalid_credentials');
    expect(normalizeAuthErrorCode(undefined, 'Failed to fetch')).toBe('network_error');
  });
  it('never shows the raw English server text in Korean', () => {
    expect(authErrorMessage('ko', normalizeAuthErrorCode(undefined, 'Email not confirmed'))).not.toMatch(/Email not confirmed/);
  });
});

describe('password rule (min 6 characters)', () => {
  it('rejects 5 characters and accepts 6', () => {
    expect(isPasswordAcceptable('abcde')).toBe(false);
    expect(isPasswordAcceptable('abcdef')).toBe(true);
  });
});
