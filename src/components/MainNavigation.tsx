/**
 * MainNavigation - Unified navigation component for all pages
 * Version: 2.0 - Mobile hamburger menu with active state highlighting
 * Last updated: 2026-01-13
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, ShoppingBag, ArrowLeft, Menu, X, User, LogOut, ImageIcon, Crown } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
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
  const { user, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isLandingPage = location.pathname === '/';
  const currentPath = location.pathname;
  
  // Helper function for active state styling
  const isActive = (path: string) => currentPath === path;
  const getMenuItemClass = (path: string) => `w-full flex items-center gap-3 px-4 py-3 text-left font-korean transition-colors ${
    isActive(path) 
      ? 'bg-primary/10 text-primary border-l-2 border-primary' 
      : 'text-foreground hover:bg-muted'
  }`;

  const handleNavigate = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    navigate('/');
  };
  
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
              width={40}
              height={40}
              className="object-contain w-8 h-8 sm:w-10 sm:h-10" 
            />
            <img 
              src={showmelookKoreanLogo} 
              alt="쇼미룩" 
              width={90}
              height={90}
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
              {/* Desktop Navigation */}
              <div className="hidden sm:flex items-center gap-3">
                {/* 요금제 */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/pricing')} 
                  className="font-korean text-sm px-3"
                >
                  요금제
                </Button>
                
                {/* 앱 설치 */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/install')} 
                  className="font-korean text-sm px-3"
                >
                  <Download className="w-4 h-4 mr-1" />
                  앱 설치
                </Button>
                
                {user ? (
                  <>
                    {/* 장바구니 */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => navigate('/cart')} 
                      className="w-9 h-9 rounded-full"
                    >
                      <ShoppingBag className="w-5 h-5" />
                    </Button>
                    
                    {/* 스타일 만들기 버튼 */}
                    <Button 
                      variant="hero" 
                      size="sm"
                      onClick={() => navigate('/style')}
                      className="font-korean text-sm px-4 h-9 rounded-full shadow-md"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      내 스타일 만들기
                    </Button>
                  </>
                ) : (
                  <>
                    {/* 로그인 버튼 */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate('/auth')} 
                      className="font-korean text-sm px-4 h-9"
                    >
                      로그인
                    </Button>
                    
                    {/* 시작하기 버튼 */}
                    <Button 
                      variant="hero" 
                      size="sm"
                      onClick={() => navigate('/auth')}
                      className="font-korean text-sm px-4 h-9 rounded-full shadow-md"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      시작하기
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile Navigation */}
              <div className="flex sm:hidden items-center gap-1">
                {user && (
                  <Button 
                    variant="hero" 
                    size="sm"
                    onClick={() => navigate('/style')}
                    className="font-korean text-xs px-2.5 h-8 rounded-full shadow-md"
                  >
                    <Sparkles className="w-3 h-3 mr-0.5" />
                    시작
                  </Button>
                )}
                
                {/* Hamburger Menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] p-0">
                    <SheetTitle className="sr-only">메뉴</SheetTitle>
                    <div className="flex flex-col h-full">
                      {/* Menu Header */}
                      <div className="p-4 border-b border-border">
                        <div className="flex items-center gap-2">
                          <img src={showmelookLogo} alt="쇼미룩" width={32} height={32} className="w-8 h-8" />
                          <span className="font-korean text-lg font-semibold text-foreground">쇼미룩</span>
                        </div>
                      </div>
                      
                      {/* Menu Items */}
                      <div className="flex-1 py-4">
                        {user ? (
                          <>
                            <button
                              onClick={() => handleNavigate('/style')}
                              className={getMenuItemClass('/style')}
                            >
                              <Sparkles className={`w-5 h-5 ${isActive('/style') ? 'text-primary' : 'text-primary'}`} />
                              내 스타일 만들기
                            </button>
                            <button
                              onClick={() => handleNavigate('/style')}
                              className={getMenuItemClass('/style')}
                            >
                              <ImageIcon className={`w-5 h-5 ${isActive('/style') ? 'text-primary' : 'text-muted-foreground'}`} />
                              내 룩 갤러리
                            </button>
                            <button
                              onClick={() => handleNavigate('/cart')}
                              className={getMenuItemClass('/cart')}
                            >
                              <ShoppingBag className={`w-5 h-5 ${isActive('/cart') ? 'text-primary' : 'text-muted-foreground'}`} />
                              장바구니
                            </button>
                            <button
                              onClick={() => handleNavigate('/mypage')}
                              className={getMenuItemClass('/mypage')}
                            >
                              <User className={`w-5 h-5 ${isActive('/mypage') ? 'text-primary' : 'text-muted-foreground'}`} />
                              마이페이지
                            </button>
                            <button
                              onClick={() => handleNavigate('/pricing')}
                              className={getMenuItemClass('/pricing')}
                            >
                              <Crown className={`w-5 h-5 ${isActive('/pricing') ? 'text-primary' : 'text-amber-500'}`} />
                              요금제
                            </button>
                            <div className="my-2 mx-4 border-t border-border" />
                            <button
                              onClick={() => handleNavigate('/install')}
                              className={getMenuItemClass('/install')}
                            >
                              <Download className={`w-5 h-5 ${isActive('/install') ? 'text-primary' : 'text-muted-foreground'}`} />
                              앱 설치
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleNavigate('/auth')}
                              className={getMenuItemClass('/auth')}
                            >
                              <Sparkles className={`w-5 h-5 ${isActive('/auth') ? 'text-primary' : 'text-primary'}`} />
                              시작하기
                            </button>
                            <button
                              onClick={() => handleNavigate('/auth')}
                              className={getMenuItemClass('/auth')}
                            >
                              <User className={`w-5 h-5 ${isActive('/auth') ? 'text-primary' : 'text-muted-foreground'}`} />
                              로그인
                            </button>
                            <div className="my-2 mx-4 border-t border-border" />
                            <button
                              onClick={() => handleNavigate('/install')}
                              className={getMenuItemClass('/install')}
                            >
                              <Download className={`w-5 h-5 ${isActive('/install') ? 'text-primary' : 'text-muted-foreground'}`} />
                              앱 설치
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Menu Footer */}
                      {user && (
                        <div className="p-4 border-t border-border">
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left font-korean text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <LogOut className="w-5 h-5" />
                            로그아웃
                          </button>
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
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
