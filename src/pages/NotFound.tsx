import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import MainNavigation from "@/components/MainNavigation";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const NotFound = () => {
  const location = useLocation();

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
            404
          </h1>
          <p className="mb-6 text-xl text-muted-foreground font-korean">
            페이지를 찾을 수 없습니다
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            variant="hero"
            className="font-korean rounded-full"
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
