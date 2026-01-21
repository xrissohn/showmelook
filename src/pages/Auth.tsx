import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, User, Loader2, Gift } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

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
  const [mode, setMode] = useState<AuthMode>('login');
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
  
  const { signIn, signUp, user, sendVerificationEmail, verifyEmailCode, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // URL 파라미터에서 ref 코드 감지 및 localStorage 저장
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      // localStorage에 7일 만료로 저장
      const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7일
      localStorage.setItem('referral_code', refCode.toUpperCase());
      localStorage.setItem('referral_code_expiry', expiry.toString());
      
      // URL에서 ref 파라미터 제거 (깔끔한 URL 유지)
      window.history.replaceState({}, '', '/auth');
      
      toast({
        title: '🎁 추천 링크로 접속하셨네요!',
        description: '가입 완료 시 보너스가 자동 적용됩니다.',
      });
    }
  }, [toast]);

  // localStorage에 저장된 추천 코드 확인
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
      toast({ title: '이메일을 입력해주세요.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await sendVerificationEmail(email, purpose);
    setIsLoading(false);
    
    if (result.success) {
      setResendCooldown(60);
      if (result.expiresAt) setExpiresAt(new Date(result.expiresAt));
      
      if (purpose === 'signup') setSignupStep('verify');
      else setForgotStep('verify');
      
      toast({ title: '인증코드가 발송되었습니다.', description: '이메일을 확인해주세요.' });
    } else {
      toast({ title: '발송 실패', description: result.error, variant: 'destructive' });
    }
  };

  const handleVerifyCode = async (purpose: 'signup' | 'password_reset') => {
    if (otpCode.length !== 6) {
      toast({ title: '6자리 인증코드를 입력해주세요.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await verifyEmailCode(email, otpCode, purpose);
    setIsLoading(false);
    
    if (result.verified) {
      if (result.verificationId) setVerificationId(result.verificationId);
      
      if (purpose === 'signup') setSignupStep('details');
      else setForgotStep('newPassword');
      
      toast({ title: '이메일이 인증되었습니다.' });
    } else {
      toast({ title: '인증 실패', description: result.error, variant: 'destructive' });
    }
  };

  const handleSignup = async () => {
    if (password.length < 6) {
      toast({ title: '비밀번호는 최소 6자 이상이어야 합니다.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    
    if (!error) {
      // Get user data after signup
      const { data: { user: newUser } } = await supabase.auth.getUser();
      
      // 추천 코드 우선순위: 직접 입력 > localStorage
      let finalReferralCode = referralCode;
      if (!finalReferralCode) {
        const storedCode = localStorage.getItem('referral_code');
        const expiry = localStorage.getItem('referral_code_expiry');
        if (storedCode && expiry && Date.now() < parseInt(expiry)) {
          finalReferralCode = storedCode;
        }
      }
      
      // Apply referral code if available
      if (finalReferralCode && newUser) {
        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/apply-referral-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referral_code: finalReferralCode,
              new_user_id: newUser.id,
              new_user_email: email,
              new_user_name: fullName,
            }),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: '🎉 추천 코드 적용!', description: result.message });
          }
          // localStorage 정리
          localStorage.removeItem('referral_code');
          localStorage.removeItem('referral_code_expiry');
        } catch (e) {
          console.log('Referral code application failed:', e);
        }
      }
      
      // Send welcome email
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, fullName }),
        });
      } catch (e) {
        console.log('Welcome email failed:', e);
      }
      toast({ title: '회원가입 완료!', description: '프로필을 설정해주세요.' });
    } else {
      toast({ title: '회원가입 실패', description: error.message, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    if (password.length < 6) {
      toast({ title: '비밀번호는 최소 6자 이상이어야 합니다.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: '비밀번호가 일치하지 않습니다.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await resetPassword(email, password, verificationId);
    setIsLoading(false);
    
    if (result.success) {
      toast({ title: '비밀번호가 변경되었습니다.', description: '새 비밀번호로 로그인해주세요.' });
      resetForm();
      setMode('login');
    } else {
      toast({ title: '변경 실패', description: result.error, variant: 'destructive' });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (error) {
      toast({ 
        title: '로그인 실패', 
        description: error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message,
        variant: 'destructive' 
      });
    } else {
      toast({ title: '로그인 성공!', description: '환영합니다.' });
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
  };

  const handleModeChange = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile-setup`,
      },
    });
    if (error) {
      toast({ title: 'Google 로그인 실패', description: error.message, variant: 'destructive' });
      setIsGoogleLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'login') return '다시 만나서 반가워요';
    if (mode === 'forgot') return '비밀번호 찾기';
    if (signupStep === 'email') return '이메일 인증';
    if (signupStep === 'verify') return '인증코드 입력';
    return '계정 정보 입력';
  };

  const getSubtitle = () => {
    if (mode === 'login') return '계정에 로그인하세요';
    if (mode === 'forgot') {
      if (forgotStep === 'email') return '가입한 이메일을 입력하세요';
      if (forgotStep === 'verify') return '이메일로 전송된 인증코드를 입력하세요';
      return '새로운 비밀번호를 설정하세요';
    }
    if (signupStep === 'email') return '이메일을 인증하고 시작하세요';
    if (signupStep === 'verify') return '이메일로 전송된 인증코드를 입력하세요';
    return '마지막 단계입니다';
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-gradient-brand rounded-full blur-3xl opacity-20 animate-gradient-flow" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-gradient-sky rounded-full blur-3xl opacity-15 animate-gradient-flow" style={{ animationDelay: '1s' }} />
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-0 mb-6">
            <img src={showmelookLogo} alt="쇼미룩 로고" className="w-10 h-10 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[90px] object-contain -ml-3" />
          </div>
          <p className="text-primary-foreground/80 text-xl font-korean font-light max-w-md">AI가 만들어주는 나만의 스타일</p>
          <p className="text-primary-foreground/60 mt-4 text-lg font-korean">당신만을 위한 패션을 경험하세요</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-0 mb-2">
              <img src={showmelookLogo} alt="쇼미룩 로고" className="w-8 h-8 object-contain" />
              <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[70px] object-contain -ml-2" />
            </div>
            <p className="text-muted-foreground font-korean text-sm">AI가 만들어주는 나만의 스타일</p>
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
              <ArrowLeft className="w-4 h-4" /> 이전
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
                <Label htmlFor="email" className="font-korean">이메일</Label>
                <Input id="email" type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-korean">비밀번호</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => handleModeChange('forgot')} className="text-sm text-muted-foreground hover:text-accent transition-colors font-korean">
                비밀번호를 잊으셨나요?
              </button>
              <Button type="submit" variant="hero" size="xl" className="w-full font-korean" disabled={isLoading}>
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground font-korean">또는</span>
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
                Google로 계속하기
              </Button>
            </form>
          )}

          {/* SIGNUP MODE */}
          {mode === 'signup' && signupStep === 'email' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><Mail className="w-4 h-4" /> 이메일</Label>
                <Input type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={() => handleSendCode('signup')}>
                {isLoading ? '발송 중...' : '인증코드 받기'}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground font-korean">또는</span>
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
                Google로 계속하기
              </Button>
            </div>
          )}

          {mode === 'signup' && signupStep === 'verify' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label className="font-korean">6자리 인증코드</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-sm text-muted-foreground text-center font-korean">{email}로 전송됨</p>
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading || otpCode.length !== 6} onClick={() => handleVerifyCode('signup')}>
                {isLoading ? '확인 중...' : '인증 확인'}
              </Button>
              <button type="button" disabled={resendCooldown > 0} onClick={() => handleSendCode('signup')} className="w-full text-sm text-muted-foreground hover:text-accent disabled:opacity-50 font-korean">
                {resendCooldown > 0 ? `재전송 (${resendCooldown}초)` : '인증코드 재전송'}
              </button>
            </div>
          )}

          {mode === 'signup' && signupStep === 'details' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><User className="w-4 h-4" /> 이름</Label>
                <Input type="text" placeholder="홍길동" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><KeyRound className="w-4 h-4" /> 비밀번호</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} placeholder="최소 6자 이상" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><Gift className="w-4 h-4" /> 추천 코드 <span className="text-xs text-muted-foreground">(선택)</span></Label>
                <Input 
                  type="text" 
                  placeholder="추천 코드가 있다면 입력하세요" 
                  value={referralCode} 
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())} 
                  maxLength={8}
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground font-korean">추천 코드 입력 시 보너스 생성 5회를 받아요!</p>
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={handleSignup}>
                {isLoading ? '가입 중...' : '가입 완료'}
              </Button>
            </div>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === 'forgot' && forgotStep === 'email' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean flex items-center gap-2"><Mail className="w-4 h-4" /> 이메일</Label>
                <Input type="email" placeholder="가입한 이메일 입력" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={() => handleSendCode('password_reset')}>
                {isLoading ? '발송 중...' : '인증코드 받기'}
              </Button>
            </div>
          )}

          {mode === 'forgot' && forgotStep === 'verify' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label className="font-korean">6자리 인증코드</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading || otpCode.length !== 6} onClick={() => handleVerifyCode('password_reset')}>
                {isLoading ? '확인 중...' : '인증 확인'}
              </Button>
              <button type="button" disabled={resendCooldown > 0} onClick={() => handleSendCode('password_reset')} className="w-full text-sm text-muted-foreground hover:text-accent disabled:opacity-50 font-korean">
                {resendCooldown > 0 ? `재전송 (${resendCooldown}초)` : '인증코드 재전송'}
              </button>
            </div>
          )}

          {mode === 'forgot' && forgotStep === 'newPassword' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-korean">새 비밀번호</Label>
                <Input type="password" placeholder="최소 6자 이상" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
              </div>
              <div className="space-y-2">
                <Label className="font-korean">비밀번호 확인</Label>
                <Input type="password" placeholder="비밀번호 다시 입력" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button variant="hero" size="xl" className="w-full font-korean" disabled={isLoading} onClick={handleResetPassword}>
                {isLoading ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </div>
          )}

          {/* Mode switch */}
          <div className="mt-8 text-center">
            {mode === 'login' && (
              <p className="text-muted-foreground font-korean">
                계정이 없으신가요?
                <button onClick={() => handleModeChange('signup')} className="ml-2 text-foreground font-medium hover:text-accent transition-colors font-korean">회원가입</button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-muted-foreground font-korean">
                이미 계정이 있으신가요?
                <button onClick={() => handleModeChange('login')} className="ml-2 text-foreground font-medium hover:text-accent transition-colors font-korean">로그인</button>
              </p>
            )}
            {mode === 'forgot' && (
              <p className="text-muted-foreground font-korean">
                <button onClick={() => handleModeChange('login')} className="text-foreground font-medium hover:text-accent transition-colors font-korean">로그인으로 돌아가기</button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
