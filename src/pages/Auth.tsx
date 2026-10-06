import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, User, Loader2, Gift, Home, Check } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';
import { detectInAppBrowser, getExternalBrowserUrl, copyToClipboard } from '@/lib/inAppBrowserDetector';
import { SEOHead } from '@/components/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';
import { authErrorMessage, authText, browserLanguage, normalizeAuthErrorCode, pickAuthLocale, type AuthLocale } from '@/lib/authErrors';
import { isPasswordAcceptable, passwordStrength, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';

const STRENGTH_BAR = ['bg-muted', 'bg-destructive', 'bg-destructive/70', 'bg-accent', 'bg-primary'];

const PasswordRules = ({ password, locale }: { password: string; locale: AuthLocale }) => {
  const level = passwordStrength(password);
  const lengthOk = password.length >= PASSWORD_MIN_LENGTH;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{authText(locale, 'strength')}</span>
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${level >= i ? STRENGTH_BAR[level] : 'bg-muted'}`} />
          ))}
        </div>
        <span className="min-w-[4.5rem] text-right text-muted-foreground">
          {level > 0 ? authText(locale, `strength${level}` as 'strength1') : ''}
        </span>
      </div>
      <p className="font-medium text-foreground">{authText(locale, 'ruleTitle')}</p>
      <ul className="space-y-1">
        <li className={`flex items-center gap-1.5 ${lengthOk ? 'text-foreground' : 'text-muted-foreground'}`}>
          <Check className={`h-3.5 w-3.5 ${lengthOk ? 'text-primary' : 'opacity-30'}`} /> {authText(locale, 'ruleLength')}
        </li>
        <li className="flex items-center gap-1.5 text-muted-foreground">
          <Check className="h-3.5 w-3.5 opacity-30" /> {authText(locale, 'ruleLeaked')}
        </li>
      </ul>
    </div>
  );
};

// Google icon component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

type AuthMode = 'login' | 'signup' | 'forgot';
type SignupStep = 'email' | 'verify' | 'details';
type ForgotStep = 'email' | 'verify' | 'newPassword';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const Auth = () => {
  const { t, language } = useLanguage();
  const authLocale = useMemo(() => pickAuthLocale(language, browserLanguage()), [language]);
  const [mode, setMode] = useState<AuthMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'login'
  );
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>('email');
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [hasStoredReferral, setHasStoredReferral] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  
  
  const { signIn, completeSignup, user, sendVerificationEmail, verifyEmailCode, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const browserInfo = useMemo(() => detectInAppBrowser(), []);

  const showAuthError = (code?: string | null, message?: string | null, opts: { remainingAttempts?: number; reasons?: string[] } = {}) => {
    const normalized = normalizeAuthErrorCode(code, message);
    toast({ title: t('common.error'), description: authErrorMessage(authLocale, normalized, opts), variant: 'destructive' });
    return normalized;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
      localStorage.setItem('referral_code', refCode.toUpperCase());
      localStorage.setItem('referral_code_expiry', expiry.toString());
      urlParams.delete('ref');
      const rest = urlParams.toString();
      window.history.replaceState({}, '', rest ? `/auth?${rest}` : '/auth');
      
      toast({
        title: t('auth.referralToast'),
        description: t('auth.referralToastDesc'),
      });
    }
  }, [toast, t]);

  useEffect(() => {
    const storedCode = localStorage.getItem('referral_code');
    const expiry = localStorage.getItem('referral_code_expiry');
    if (storedCode && expiry && Date.now() < parseInt(expiry)) {
      setHasStoredReferral(true);
    }
  }, []);

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Redirect if already logged in
  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('height, weight, style_preferences')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.height || !profile?.style_preferences?.length) {
        navigate('/profile-setup');
      } else {
        navigate('/style');
      }
    };
    checkProfileAndRedirect();
  }, [user, navigate]);

  const handleSendCode = async (purpose: 'signup' | 'password_reset') => {
    if (!email) {
      showAuthError('invalid_email');
      return;
    }
    setAlreadyRegistered(false);
    setIsLoading(true);
    const result = await sendVerificationEmail(email, purpose);
    setIsLoading(false);
    
    if (result.success) {
      setResendCooldown(60);
      if (result.expiresAt) setExpiresAt(new Date(result.expiresAt));
      
      if (purpose === 'signup') setSignupStep('verify');
      else setForgotStep('verify');
      
      toast({ title: t('auth.codeSent'), description: t('auth.checkEmail') });
    } else {
      const code = showAuthError(result.errorCode, result.error);
      if (code === 'email_already_registered' && purpose === 'signup') setAlreadyRegistered(true);
    }
  };

  const handleVerifyCode = async (purpose: 'signup' | 'password_reset') => {
    if (otpCode.length !== 6) {
      toast({ title: t('auth.sixDigitCode'), variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await verifyEmailCode(email, otpCode, purpose);
    setIsLoading(false);
    
    if (result.verified) {
      if (result.verificationId) setVerificationId(result.verificationId);
      
      if (purpose === 'signup') setSignupStep('details');
      else setForgotStep('newPassword');
      
      toast({ title: t('auth.emailVerified') });
    } else {
      showAuthError(result.errorCode, result.error, { remainingAttempts: result.remainingAttempts });
    }
  };

  const handleSignup = async () => {
    if (!isPasswordAcceptable(password)) {
      showAuthError('weak_password', null, { reasons: ['length'] });
      return;
    }

    let finalReferralCode = referralCode;
    if (!finalReferralCode) {
      const storedCode = localStorage.getItem('referral_code');
      const expiry = localStorage.getItem('referral_code_expiry');
      if (storedCode && expiry && Date.now() < parseInt(expiry)) finalReferralCode = storedCode;
    }

    setIsLoading(true);
    const result = await completeSignup({
      email: email.trim(),
      password,
      fullName,
      verificationId,
      referralCode: finalReferralCode || undefined,
      language,
    });

    if (!result.success) {
      setIsLoading(false);
      const code = showAuthError(result.errorCode, result.error, { reasons: result.reasons });
      if (code === 'verification_required') {
        setVerificationId('');
        setOtpCode('');
        setSignupStep('email');
      } else if (code === 'user_already_exists') {
        setSignupStep('email');
        setAlreadyRegistered(true);
      }
      return;
    }

    if (finalReferralCode) {
      localStorage.removeItem('referral_code');
      localStorage.removeItem('referral_code_expiry');
    }

    // Account is created and confirmed on the server; sign in so the redirect effect runs.
    const { error } = await signIn(email.trim(), password);
    setIsLoading(false);
    if (error) {
      showAuthError(error.code, error.message);
      setMode('login');
      return;
    }
    toast({ title: t('auth.signupDone'), description: t('auth.setupProfile') });
  };

  const handleResetPassword = async () => {
    if (!isPasswordAcceptable(password)) {
      showAuthError('weak_password', null, { reasons: ['length'] });
      return;
    }
    if (password !== confirmPassword) {
      showAuthError('password_mismatch');
      return;
    }
    
    setIsLoading(true);
    const result = await resetPassword(email, password, verificationId);
    setIsLoading(false);
    
    if (result.success) {
      toast({ title: t('auth.passwordChanged'), description: t('auth.loginWithNew') });
      resetForm();
      setMode('login');
    } else {
      showAuthError(result.errorCode, result.error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (error) {
      const code = normalizeAuthErrorCode(error.code, error.message);
      toast({ title: t('auth.loginFail'), description: authErrorMessage(authLocale, code), variant: 'destructive' });
    } else {
      toast({ title: t('auth.loginSuccess'), description: t('auth.welcome') });
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setOtpCode('');
    setVerificationId('');
    setReferralCode('');
    setSignupStep('email');
    setForgotStep('email');
    setResendCooldown(0);
    setExpiresAt(null);
    setAlreadyRegistered(false);
  };

  const handleModeChange = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleGoogleSignIn = async () => {
    if (browserInfo.isInAppBrowser) {
      const currentUrl = window.location.href;
      
      if (browserInfo.isAndroid) {
        const externalUrl = getExternalBrowserUrl(currentUrl, true);
        if (externalUrl) {
          toast({
            title: t('sharedLook.openExternal'),
            description: t('sharedLook.openInChrome'),
          });
          setTimeout(() => {
            window.location.href = externalUrl;
          }, 500);
          return;
        }
      } else if (browserInfo.isIOS) {
        const copied = await copyToClipboard(currentUrl);
        if (copied) {
          toast({
            title: t('sharedLook.linkCopied'),
            description: t('sharedLook.pasteInSafari'),
          });
        } else {
          toast({
            title: t('sharedLook.openExternal'),
            description: `${currentUrl}`,
          });
        }
        return;
      }
    }
    
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile-setup`,
      },
    });
    if (error) {
      const code = normalizeAuthErrorCode((error as { code?: string }).code, error.message);
      toast({ title: t('auth.loginFail'), description: authErrorMessage(authLocale, code), variant: 'destructive' });
      setIsGoogleLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'login') return t('auth.welcomeBack');
    if (mode === 'forgot') return t('auth.findPassword');
    if (signupStep === 'email') return t('auth.emailVerify');
    if (signupStep === 'verify') return t('auth.enterCode');
    return t('auth.enterAccountInfo');
  };

  const getSubtitle = () => {
    if (mode === 'login') return t('auth.loginToAccount');
    if (mode === 'forgot') {
      if (forgotStep === 'email') return t('auth.enterRegisteredEmail');
      if (forgotStep === 'verify') return t('auth.enterCodeSent');
      return t('auth.setNewPassword');
    }
    if (signupStep === 'email') return t('auth.verifyAndStart');
    if (signupStep === 'verify') return t('auth.enterCodeFromEmail');
    return t('auth.lastStep');
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex">
      <SEOHead pageKey="auth" />
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-gradient-brand rounded-full blur-3xl opacity-20 animate-gradient-flow" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-gradient-sky rounded-full blur-3xl opacity-15 animate-gradient-flow" style={{ animationDelay: '1s' }} />
        <div className="relative z-10 text-center">
          <Link to="/" aria-label={language === 'ko' ? '쇼미룩 홈으로' : 'ShowMeLook home'} className="flex items-center justify-center gap-0 mb-6">
            <img src={showmelookLogo} alt="" width={40} height={40} className="w-10 h-10 object-contain" />
            <img src={showmelookKoreanLogo} alt="" width={90} height={90} className="h-[90px] object-contain -ml-3" />
          </Link>
          <p className="text-primary-foreground/80 text-xl font-korean font-light max-w-md">{t('auth.aiStyle')}</p>
          <p className="text-primary-foreground/60 mt-4 text-lg font-korean">{t('auth.experienceFashion')}</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Browse (back to home) — also the way out when installed as an app */}
          <div className="flex justify-end mb-2">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-korean">
              <Home className="w-4 h-4" /> {language === 'ko' ? '둘러보기' : 'Browse'}
            </Link>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" aria-label={language === 'ko' ? '쇼미룩 홈으로' : 'ShowMeLook home'} className="flex items-center justify-center gap-0 mb-2">
              <img src={showmelookLogo} alt="" width={32} height={32} className="w-8 h-8 object-contain" />
              <img src={showmelookKoreanLogo} alt="" width={70} height={70} className="h-[70px] object-contain -ml-2" />
            </Link>
            <p className="text-muted-foreground font-korean text-sm">{t('auth.aiStyle')}</p>
          </div>

          {/* Back button for multi-step flows */}
          {((mode === 'signup' && signupStep !== 'email') || (mode === 'forgot' && forgotStep !== 'email')) && (
            <button 
              onClick={() => {
                if (mode === 'signup') setSignupStep(signupStep === 'details' ? 'verify' : 'email');
                else setForgotStep(forgotStep === 'newPassword' ? 'verify' : 'email');
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {t('auth.previous')}
            </button>
          )}

          <div className="mb-6">
            <h2 className="font-korean text-2xl sm:text-3xl text-foreground mb-2">{getTitle()}</h2>
            <p className="text-muted-foreground font-korean text-sm">{getSubtitle()}</p>
          </div>

          {/* LOGIN MODE */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-korean">{t('auth.email')}</Label>
                <Input id="email" type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-korean">{t('auth.password')}</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => handleModeChange('forgot')} className="text-sm text-muted-foreground hover:text-accent transition-colors font-korean">
                {t('auth.forgotPassword')}
              </button>
              <Button type="submit" variant="hero" size="xl" className="w-full font-korean" disabled={isLoading}>
                {isLoading ? t('auth.loggingIn') : t('auth.loginBtn')}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground font-korean">{t('auth.or')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full font-korean gap-3"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                {t('auth.continueGoogle')}
              </Button>
            </form>
          )}

          {/* SIGNUP MODE */}
          {mode === 'signup' && signupStep === 'email' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><Mail className="w-4 h-4" /> {t('auth.email')}</Label>
                <Input type="email" placeholder="hello@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setAlreadyRegistered(false); }} />
              </div>
              {alreadyRegistered && (
                <div role="alert" className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                  <p className="text-sm text-foreground font-korean">{authText(authLocale, 'email_already_registered')}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { const e = email; handleModeChange('login'); setEmail(e); }}>
                      {authText(authLocale, 'goLogin')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { const e = email; handleModeChange('forgot'); setEmail(e); }}>
                      {authText(authLocale, 'goForgot')}
                    </Button>
                  </div>
                </div>
              )}
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={() => handleSendCode('signup')}>
                {isLoading ? t('auth.sending') : t('auth.getCode')}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground font-korean">{t('auth.or')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full font-korean gap-3"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                {t('auth.continueGoogle')}
              </Button>
            </div>
          )}

          {mode === 'signup' && signupStep === 'verify' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label className="font-korean">{t('auth.sixDigitCode')}</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-sm text-muted-foreground text-center font-korean">{t('auth.sentTo')} {email}</p>
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading || otpCode.length !== 6} onClick={() => handleVerifyCode('signup')}>
                {isLoading ? t('auth.verifying') : t('auth.verifyBtn')}
              </Button>
              <button type="button" disabled={resendCooldown > 0} onClick={() => handleSendCode('signup')} className="w-full text-sm text-muted-foreground hover:text-accent disabled:opacity-50 font-korean">
                {resendCooldown > 0 ? `${t('auth.resendIn')} (${resendCooldown}s)` : t('auth.resend')}
              </button>
            </div>
          )}

          {mode === 'signup' && signupStep === 'details' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><User className="w-4 h-4" /> {t('auth.name')}</Label>
                <Input type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><KeyRound className="w-4 h-4" /> {t('auth.password')}</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} placeholder={authText(authLocale, 'ruleLength')} value={password} onChange={(e) => setPassword(e.target.value)} minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <PasswordRules password={password} locale={authLocale} />
              </div>
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><Gift className="w-4 h-4" /> {t('auth.referralCode')} <span className="text-xs text-muted-foreground">({t('auth.optional')})</span></Label>
                <Input 
                  type="text" 
                  placeholder={t('auth.referralPlaceholder')} 
                  value={referralCode} 
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())} 
                  maxLength={8}
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground font-korean">{t('auth.referralBonus')}</p>
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={handleSignup}>
                {isLoading ? t('auth.signingUp') : t('auth.signupComplete')}
              </Button>
            </div>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === 'forgot' && forgotStep === 'email' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><Mail className="w-4 h-4" /> {t('auth.email')}</Label>
                <Input type="email" placeholder={t('auth.enterRegisteredEmail')} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={() => handleSendCode('password_reset')}>
                {isLoading ? t('auth.sending') : t('auth.getCode')}
              </Button>
            </div>
          )}

          {mode === 'forgot' && forgotStep === 'verify' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label className="font-korean">{t('auth.sixDigitCode')}</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading || otpCode.length !== 6} onClick={() => handleVerifyCode('password_reset')}>
                {isLoading ? t('auth.verifying') : t('auth.verifyBtn')}
              </Button>
              <button type="button" disabled={resendCooldown > 0} onClick={() => handleSendCode('password_reset')} className="w-full text-sm text-muted-foreground hover:text-accent disabled:opacity-50 font-korean">
                {resendCooldown > 0 ? `${t('auth.resendIn')} (${resendCooldown}s)` : t('auth.resend')}
              </button>
            </div>
          )}

          {mode === 'forgot' && forgotStep === 'newPassword' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean">{t('auth.newPassword')}</Label>
                <Input type="password" placeholder={authText(authLocale, 'ruleLength')} value={password} onChange={(e) => setPassword(e.target.value)} minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
                <PasswordRules password={password} locale={authLocale} />
              </div>
              <div className="space-y-2">
                <Label className="font-korean">{t('auth.confirmPassword')}</Label>
                <Input type="password" placeholder={t('auth.confirmPassword')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={handleResetPassword}>
                {isLoading ? t('auth.changingPassword') : t('auth.changePassword')}
              </Button>
            </div>
          )}

          {/* Mode switch */}
          <div className="mt-8 text-center">
            {mode === 'login' && (
              <p className="text-muted-foreground font-korean">
                {t('auth.noAccount')}
                <button onClick={() => handleModeChange('signup')} className="ml-2 text-foreground font-medium hover:text-accent transition-colors font-korean">{t('auth.signup')}</button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-muted-foreground font-korean">
                {t('auth.hasAccount')}
                <button onClick={() => handleModeChange('login')} className="ml-2 text-foreground font-medium hover:text-accent transition-colors font-korean">{t('auth.loginBtn')}</button>
              </p>
            )}
            {mode === 'forgot' && (
              <p className="text-muted-foreground font-korean">
                <button onClick={() => handleModeChange('login')} className="text-foreground font-medium hover:text-accent transition-colors font-korean">{t('auth.backToLogin')}</button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
