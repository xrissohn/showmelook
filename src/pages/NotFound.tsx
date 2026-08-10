import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import MainNavigation from "@/components/MainNavigation";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead pageKey="notFound" />
      <MainNavigation />
      
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-16">
        <div className="text-center px-4">
          <h1 className="mb-4 text-6xl font-bold font-korean bg-gradient-brand bg-clip-text text-transparent">
            {t('notFound.title')}
          </h1>
          <p className="mb-6 text-xl text-muted-foreground font-korean">
            {t('notFound.message')}
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            variant="hero"
            className="font-korean rounded-full"
          >
            <Home className="w-4 h-4 mr-2" />
            {t('notFound.goHome')}
          </Button>

          <nav className="mt-10">
            <p className="mb-3 text-sm text-muted-foreground font-korean">
              찾으시는 페이지 대신 아래 페이지는 어떠세요?
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {[
                { to: '/', label: '홈' },
                { to: '/guide', label: '스타일 가이드' },
                { to: '/community', label: '스타일 갤러리' },
                { to: '/style', label: 'AI 스타일 생성' },
                { to: '/pricing', label: '요금제' },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="inline-block rounded-full border border-border px-4 py-2 text-sm font-korean hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
