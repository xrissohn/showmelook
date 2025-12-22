import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      if (!user) return;
      
      // Check if profile has been completed
      const { data: profile } = await supabase
        .from('profiles')
        .select('height, weight, style_preferences')
        .eq('user_id', user.id)
        .single();
      
      // If new user or incomplete profile, go to profile setup
      if (isNewUser || !profile?.height || !profile?.style_preferences?.length) {
        navigate('/profile-setup');
      } else {
        navigate('/style');
      }
    };
    
    checkProfileAndRedirect();
  }, [user, navigate, isNewUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: '로그인 실패',
            description: error.message === 'Invalid login credentials' 
              ? '이메일 또는 비밀번호가 올바르지 않습니다.' 
              : error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: '로그인 성공!',
            description: '환영합니다.',
          });
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({
            title: '회원가입 실패',
            description: error.message === 'User already registered'
              ? '이미 가입된 이메일입니다.'
              : error.message,
            variant: 'destructive',
          });
        } else {
          setIsNewUser(true);
          toast({
            title: '회원가입 성공!',
            description: '프로필을 설정해주세요.',
          });
        }
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-primary-foreground/80 text-xl font-korean font-light max-w-md">
            AI가 만들어주는 나만의 스타일
          </p>
          <p className="text-primary-foreground/60 mt-4 text-lg font-korean">
            당신만을 위한 패션을 경험하세요
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="flex items-center justify-center gap-0 mb-2">
              <img src={showmelookLogo} alt="쇼미룩 로고" className="w-10 h-10 object-contain" />
              <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[90px] object-contain -ml-3" />
            </div>
            <p className="text-muted-foreground font-korean">AI가 만들어주는 나만의 스타일</p>
          </div>

          <div className="mb-8">
            <h2 className="font-korean text-3xl text-foreground mb-2">
              {isLogin ? '다시 만나서 반가워요' : '쇼미룩에 오신 것을 환영합니다'}
            </h2>
            <p className="text-muted-foreground font-korean">
              {isLogin ? '계정에 로그인하세요' : '몇 초만에 시작할 수 있어요'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium font-korean">이름</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="홍길동"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  className="font-korean"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium font-korean">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="hello@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium font-korean">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="xl"
              className="w-full mt-6 font-korean"
              disabled={isLoading}
            >
              {isLoading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground font-korean">
              {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-foreground font-medium hover:text-accent transition-colors font-korean"
              >
                {isLogin ? '회원가입' : '로그인'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
