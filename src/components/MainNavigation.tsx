import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, ShoppingBag, ArrowLeft } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

interface MainNavigationProps {
  showBackButton?: boolean;
  rightContent?: React.ReactNode;
  title?: string;
}

const MainNavigation = ({ showBackButton = false, rightContent, title }: MainNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  
  const isLandingPage = location.pathname === '/';
  
  // Scroll detection for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/95 backdrop-blur-lg border-b border-border shadow-lg' 
        : 'bg-background/60 backdrop-blur-md border-b border-transparent'
    }`}>
      <div className="container mx-auto px-3 sm:px-6 h-12 sm:h-16 flex items-center justify-between">
        {/* Left side - Back button or Logo */}
        <div className="flex items-center gap-1 sm:gap-2">
          {showBackButton && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-0 hover:opacity-80 transition-all duration-300"
          >
            <img 
              src={showmelookLogo} 
              alt="쇼미룩 로고" 
              className="object-contain w-8 h-8 sm:w-10 sm:h-10" 
            />
            <img 
              src={showmelookKoreanLogo} 
              alt="쇼미룩" 
              className="object-contain -ml-2 sm:-ml-3 h-[60px] sm:h-[90px]" 
            />
          </button>
        </div>
        
        {/* Center - Title (optional) */}
        {title && (
          <span className="font-korean text-lg sm:text-xl text-foreground absolute left-1/2 transform -translate-x-1/2">
            {title}
          </span>
        )}
        
        {/* Right side - Navigation buttons */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Custom right content */}
          {rightContent ? (
            rightContent
          ) : (
            <>
              {/* 앱 설치 - 데스크탑 */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/install')} 
                className="font-korean text-xs sm:text-sm px-2 sm:px-3 hidden sm:flex"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                앱 설치
              </Button>
              
              {/* 앱 설치 - 모바일 아이콘 */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/install')} 
                className="sm:hidden w-8 h-8 rounded-full"
              >
                <Download className="w-4 h-4" />
              </Button>
              
              {user ? (
                <>
                  {/* 장바구니 */}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/cart')} 
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full"
                  >
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  
                  {/* 스타일 만들기 버튼 */}
                  <Button 
                    variant="hero" 
                    size="sm"
                    onClick={() => navigate('/style')}
                    className="font-korean text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9 rounded-full shadow-md"
                  >
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">내 스타일 만들기</span>
                    <span className="sm:hidden">시작</span>
                  </Button>
                </>
              ) : (
                <>
                  {/* 로그인 버튼 */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/auth')} 
                    className="font-korean text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                  >
                    로그인
                  </Button>
                  
                  {/* 시작하기 버튼 */}
                  <Button 
                    variant="hero" 
                    size="sm"
                    onClick={() => navigate('/auth')}
                    className="font-korean text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9 rounded-full shadow-md"
                  >
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">시작하기</span>
                    <span className="sm:hidden">시작</span>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Animated gradient line at bottom of nav when scrolled */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-brand transition-opacity duration-300 ${
        isScrolled ? 'opacity-100' : 'opacity-0'
      }`} />
    </nav>
  );
};

export default MainNavigation;
