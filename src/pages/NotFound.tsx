import { useLocation } from "react-router-dom";
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
        </div>
      </div>
    </div>
  );
};

export default NotFound;
