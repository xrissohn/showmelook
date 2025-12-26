import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share, MoreVertical, Plus, Download, Smartphone, Monitor, Apple, Chrome } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';

type DeviceType = 'ios' | 'android' | 'desktop' | 'unknown';

const Install = () => {
  const navigate = useNavigate();
  const [deviceType, setDeviceType] = useState<DeviceType>('unknown');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDeviceType('ios');
    } else if (/android/.test(userAgent)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const InstallStepCard = ({ step, icon: Icon, title, description }: { 
    step: number; 
    icon: React.ElementType; 
    title: string; 
    description: string;
  }) => (
    <div className="flex gap-4 p-4 bg-secondary/50 rounded-xl border border-border">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold">
        {step}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-5 h-5 text-accent" />
          <h3 className="font-korean font-medium text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground font-korean">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
            <img src={showmelookLogo} alt="쇼미룩 로고" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[60px] sm:h-[80px] object-contain -ml-2" />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-brand p-0.5">
            <div className="w-full h-full bg-background rounded-2xl flex items-center justify-center">
              <img src={showmelookLogo} alt="" className="w-12 h-12 object-contain" />
            </div>
          </div>
          <h1 className="font-korean text-2xl sm:text-3xl text-foreground mb-2">
            쇼미룩 앱 설치하기
          </h1>
          <p className="font-korean text-muted-foreground">
            홈 화면에 추가하고 더 빠르게 이용하세요
          </p>
        </div>

        {/* Already Installed */}
        {isInstalled && (
          <div className="mb-8 p-6 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
              <Download className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="font-korean text-lg font-medium text-green-600 mb-1">
              이미 설치되어 있습니다!
            </h2>
            <p className="font-korean text-sm text-green-600/80">
              홈 화면에서 쇼미룩 앱을 찾아보세요
            </p>
          </div>
        )}

        {/* Install Button (for supported browsers) */}
        {deferredPrompt && !isInstalled && (
          <div className="mb-8">
            <Button 
              variant="gold" 
              size="xl" 
              className="w-full font-korean"
              onClick={handleInstallClick}
            >
              <Download className="w-5 h-5 mr-2" />
              지금 설치하기
            </Button>
          </div>
        )}

        {/* Device-specific instructions */}
        {!isInstalled && (
          <div className="space-y-6">
            {/* Device tabs */}
            <div className="flex gap-2 p-1 bg-secondary rounded-xl">
              <button
                onClick={() => setDeviceType('ios')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-korean text-sm transition-colors ${
                  deviceType === 'ios' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Apple className="w-4 h-4" />
                iPhone
              </button>
              <button
                onClick={() => setDeviceType('android')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-korean text-sm transition-colors ${
                  deviceType === 'android' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Android
              </button>
              <button
                onClick={() => setDeviceType('desktop')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-korean text-sm transition-colors ${
                  deviceType === 'desktop' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="w-4 h-4" />
                PC
              </button>
            </div>

            {/* iOS Instructions */}
            {deviceType === 'ios' && (
              <div className="space-y-3">
                <h2 className="font-korean text-lg font-medium text-foreground mb-4">
                  Safari에서 설치하기
                </h2>
                <InstallStepCard 
                  step={1}
                  icon={Share}
                  title="공유 버튼 탭"
                  description="Safari 하단의 공유 아이콘(네모에서 화살표)을 탭하세요"
                />
                <InstallStepCard 
                  step={2}
                  icon={Plus}
                  title="홈 화면에 추가"
                  description="스크롤해서 '홈 화면에 추가'를 찾아 탭하세요"
                />
                <InstallStepCard 
                  step={3}
                  icon={Download}
                  title="추가 완료"
                  description="우측 상단의 '추가'를 탭하면 홈 화면에 앱이 생성됩니다"
                />
                <p className="text-xs text-muted-foreground font-korean mt-4 p-3 bg-muted/50 rounded-lg">
                  💡 Chrome이나 다른 브라우저를 사용 중이라면 Safari로 이 페이지를 열어주세요
                </p>
              </div>
            )}

            {/* Android Instructions */}
            {deviceType === 'android' && (
              <div className="space-y-3">
                <h2 className="font-korean text-lg font-medium text-foreground mb-4">
                  Chrome에서 설치하기
                </h2>
                <InstallStepCard 
                  step={1}
                  icon={MoreVertical}
                  title="메뉴 열기"
                  description="Chrome 우측 상단의 점 3개(⋮) 메뉴를 탭하세요"
                />
                <InstallStepCard 
                  step={2}
                  icon={Plus}
                  title="앱 설치 또는 홈 화면에 추가"
                  description="'앱 설치' 또는 '홈 화면에 추가'를 탭하세요"
                />
                <InstallStepCard 
                  step={3}
                  icon={Download}
                  title="설치 완료"
                  description="'설치'를 탭하면 홈 화면에 앱이 생성됩니다"
                />
                <p className="text-xs text-muted-foreground font-korean mt-4 p-3 bg-muted/50 rounded-lg">
                  💡 설치 팝업이 자동으로 나타나면 바로 설치할 수 있어요
                </p>
              </div>
            )}

            {/* Desktop Instructions */}
            {deviceType === 'desktop' && (
              <div className="space-y-3">
                <h2 className="font-korean text-lg font-medium text-foreground mb-4">
                  PC에서 설치하기
                </h2>
                <InstallStepCard 
                  step={1}
                  icon={Chrome}
                  title="Chrome 또는 Edge 사용"
                  description="Chrome이나 Microsoft Edge 브라우저에서 이 페이지를 열어주세요"
                />
                <InstallStepCard 
                  step={2}
                  icon={Download}
                  title="설치 아이콘 클릭"
                  description="주소창 오른쪽의 설치 아이콘(⊕)을 클릭하세요"
                />
                <InstallStepCard 
                  step={3}
                  icon={Monitor}
                  title="앱으로 실행"
                  description="설치 후 바탕화면이나 시작메뉴에서 앱을 실행할 수 있습니다"
                />
                <p className="text-xs text-muted-foreground font-korean mt-4 p-3 bg-muted/50 rounded-lg">
                  💡 위의 '지금 설치하기' 버튼이 보이면 바로 클릭해서 설치하세요
                </p>
              </div>
            )}
          </div>
        )}

        {/* Benefits */}
        <div className="mt-10 p-6 bg-gradient-to-br from-accent/5 to-purple/5 rounded-2xl border border-accent/20">
          <h2 className="font-korean text-lg font-medium text-foreground mb-4 text-center">
            앱으로 설치하면 좋은 점
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-accent/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-accent" />
              </div>
              <p className="font-korean text-sm text-foreground">빠른 실행</p>
              <p className="font-korean text-xs text-muted-foreground">홈 화면에서 바로</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-purple" />
              </div>
              <p className="font-korean text-sm text-foreground">오프라인 지원</p>
              <p className="font-korean text-xs text-muted-foreground">일부 기능 사용 가능</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-coral/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-coral" />
              </div>
              <p className="font-korean text-sm text-foreground">전체 화면</p>
              <p className="font-korean text-xs text-muted-foreground">더 넓은 화면</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-sky/10 flex items-center justify-center">
                <Chrome className="w-5 h-5 text-sky" />
              </div>
              <p className="font-korean text-sm text-foreground">저장 공간 절약</p>
              <p className="font-korean text-xs text-muted-foreground">앱스토어 불필요</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button 
            variant="hero" 
            size="lg" 
            className="font-korean"
            onClick={() => navigate('/style')}
          >
            스타일 생성하러 가기
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Install;