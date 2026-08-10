/**
 * MainNavigation - Unified navigation component for all pages
 * Version: 2.1 - Added tier badge to mypage button
 * Last updated: 2026-02-01
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePurchaseStats } from '@/hooks/usePurchaseStats';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { Download, Sparkles, ShoppingBag, ArrowLeft, Menu, User, LogOut, ImageIcon, Crown, Images, Globe } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { stats, isLoading: isTierLoading } = usePurchaseStats(user?.id);
  const { language, toggleLanguage, t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isLandingPage = location.pathname === '/';
  const currentTier = stats?.currentTier || 'free';
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
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2" aria-label="이전 페이지로 돌아가기">
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
          <span className="font-korean text-base sm:text-lg text-foreground truncate max-w-[120px] sm:max-w-none">
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
              {/* Desktop Navigation - Only on lg (1024px+) */}
              <div className="hidden lg:flex items-center gap-3">
                {/* Language Toggle */}
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  aria-label="Toggle language"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {language === 'ko' ? 'EN' : 'KO'}
                </button>

                {/* 스타일 갤러리 */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/community')} 
                  className="font-korean text-sm px-3"
                >
                  <Images className="w-4 h-4 mr-1" />
                  {t('nav.styleGallery')}
                </Button>
                
                {/* 요금제 */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/pricing')} 
                  className="font-korean text-sm px-3"
                >
                  {t('nav.pricing')}
                </Button>
                
                {/* 앱 설치 */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/install')} 
                  className="font-korean text-sm px-3"
                >
                  <Download className="w-4 h-4 mr-1" />
                  {t('nav.install')}
                </Button>
                
                {user ? (
                  <>
                    {/* 마이페이지 + 등급 배지 */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate('/mypage')} 
                      className="font-korean text-sm px-3 gap-2"
                    >
                      <User className="w-4 h-4" />
                      {t('nav.mypage')}
                      {!isTierLoading && <TierBadge tier={currentTier} size="sm" />}
                    </Button>
                    
                    {/* 장바구니 */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => navigate('/cart')} 
                      className="w-9 h-9 rounded-full"
                      aria-label="장바구니 열기"
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
                      {t('nav.createStyle')}
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
                      {t('nav.login')}
                    </Button>
                    
                    {/* 시작하기 버튼 */}
                    <Button 
                      variant="hero" 
                      size="sm"
                      onClick={() => navigate('/auth')}
                      className="font-korean text-sm px-4 h-9 rounded-full shadow-md"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      {t('nav.getStarted')}
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile/Tablet Navigation - Show on screens below lg (1024px) */}
              <div className="flex lg:hidden items-center gap-1 sm:gap-2">
                {user && (
                  <Button 
                    variant="hero" 
                    size="sm"
                    onClick={() => navigate('/style')}
                    className="font-korean text-xs sm:text-sm px-2.5 sm:px-3 h-8 sm:h-9 rounded-full shadow-md"
                  >
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">스타일 만들기</span>
                    <span className="sm:hidden">시작</span>
                  </Button>
                )}
                
                {/* Hamburger Menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" aria-label="메인 메뉴 열기">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] p-0">
                    <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
                    <div className="flex flex-col h-full">
                      {/* Menu Header */}
                      <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img src={showmelookLogo} alt="쇼미룩" width={32} height={32} className="w-8 h-8" />
                            <span className="font-korean text-lg font-semibold text-foreground">{t('nav.showmelook')}</span>
                          </div>
                          <button
                            onClick={toggleLanguage}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            {language === 'ko' ? 'EN' : 'KO'}
                          </button>
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
                              {t('nav.createStyle')}
                            </button>
                            <button
                              onClick={() => handleNavigate('/community')}
                              className={getMenuItemClass('/community')}
                            >
                              <Images className={`w-5 h-5 ${isActive('/community') ? 'text-primary' : 'text-muted-foreground'}`} />
                              {t('nav.styleGallery')}
                            </button>
                            <button
                              onClick={() => handleNavigate('/cart')}
                              className={getMenuItemClass('/cart')}
                            >
                              <ShoppingBag className={`w-5 h-5 ${isActive('/cart') ? 'text-primary' : 'text-muted-foreground'}`} />
                              {t('nav.cart')}
                            </button>
                            <button
                              onClick={() => handleNavigate('/mypage')}
                              className={getMenuItemClass('/mypage')}
                            >
                              <User className={`w-5 h-5 ${isActive('/mypage') ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="flex-1">{t('nav.mypage')}</span>
                              {user && !isTierLoading && <TierBadge tier={currentTier} size="sm" />}
                            </button>
                            <button
                              onClick={() => handleNavigate('/pricing')}
                              className={getMenuItemClass('/pricing')}
                            >
                              <Crown className={`w-5 h-5 ${isActive('/pricing') ? 'text-primary' : 'text-amber-500'}`} />
                              {t('nav.pricing')}
                            </button>
                            <div className="my-2 mx-4 border-t border-border" />
                            <button
                              onClick={() => handleNavigate('/install')}
                              className={getMenuItemClass('/install')}
                            >
                              <Download className={`w-5 h-5 ${isActive('/install') ? 'text-primary' : 'text-muted-foreground'}`} />
                              {t('nav.install')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleNavigate('/auth')}
                              className={getMenuItemClass('/auth')}
                            >
                              <Sparkles className={`w-5 h-5 ${isActive('/auth') ? 'text-primary' : 'text-primary'}`} />
                              {t('nav.getStarted')}
                            </button>
                            <button
                              onClick={() => handleNavigate('/auth')}
                              className={getMenuItemClass('/auth')}
                            >
                              <User className={`w-5 h-5 ${isActive('/auth') ? 'text-primary' : 'text-muted-foreground'}`} />
                              {t('nav.login')}
                            </button>
                            <div className="my-2 mx-4 border-t border-border" />
                            <button
                              onClick={() => handleNavigate('/install')}
                              className={getMenuItemClass('/install')}
                            >
                              <Download className={`w-5 h-5 ${isActive('/install') ? 'text-primary' : 'text-muted-foreground'}`} />
                              {t('nav.install')}
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
                            {t('nav.logout')}
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
