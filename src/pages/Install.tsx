import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Share, MoreVertical, Plus, Download, Smartphone, Monitor, Apple, Chrome } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.webp';
import MainNavigation from '@/components/MainNavigation';
import { useLanguage } from '@/contexts/LanguageContext';

type DeviceType = 'ios' | 'android' | 'desktop' | 'unknown';

const Install = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [deviceType, setDeviceType] = useState<DeviceType>('unknown');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDeviceType('ios');
    } else if (/android/.test(userAgent)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

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
      <MainNavigation showBackButton />

      <main className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-8 max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-brand p-0.5">
            <div className="w-full h-full bg-background rounded-2xl flex items-center justify-center">
              <img src={showmelookLogo} alt="" width={48} height={48} className="w-12 h-12 object-contain" />
            </div>
          </div>
          <h1 className="font-korean text-2xl sm:text-3xl text-foreground mb-2">
            {t('install.title')}
          </h1>
          <p className="font-korean text-muted-foreground">
            {t('install.subtitle')}
          </p>
        </div>

        {/* Already Installed */}
        {isInstalled && (
          <div className="mb-8 p-6 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
              <Download className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="font-korean text-lg font-medium text-green-600 mb-1">
              {t('install.alreadyInstalled')}
            </h2>
            <p className="font-korean text-sm text-green-600/80">
              {t('install.findOnHome')}
            </p>
          </div>
        )}

        {/* Install Button */}
        {deferredPrompt && !isInstalled && (
          <div className="mb-8">
            <Button 
              variant="gold" 
              size="xl" 
              className="w-full font-korean"
              onClick={handleInstallClick}
            >
              <Download className="w-5 h-5 mr-2" />
              {t('install.installNow')}
            </Button>
          </div>
        )}

        {/* Device-specific instructions */}
        {!isInstalled && (
          <div className="space-y-6">
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

            {/* iOS */}
            {deviceType === 'ios' && (
              <div className="space-y-3">
                <h2 className="font-korean text-lg font-medium text-foreground mb-4">{t('install.iosTitle')}</h2>
                <InstallStepCard step={1} icon={Share} title={t('install.iosStep1Title')} description={t('install.iosStep1Desc')} />
                <InstallStepCard step={2} icon={Plus} title={t('install.iosStep2Title')} description={t('install.iosStep2Desc')} />
                <InstallStepCard step={3} icon={Download} title={t('install.iosStep3Title')} description={t('install.iosStep3Desc')} />
                <p className="text-xs text-muted-foreground font-korean mt-4 p-3 bg-muted/50 rounded-lg">{t('install.iosTip')}</p>
              </div>
            )}

            {/* Android */}
            {deviceType === 'android' && (
              <div className="space-y-3">
                <h2 className="font-korean text-lg font-medium text-foreground mb-4">{t('install.androidTitle')}</h2>
                <InstallStepCard step={1} icon={MoreVertical} title={t('install.androidStep1Title')} description={t('install.androidStep1Desc')} />
                <InstallStepCard step={2} icon={Plus} title={t('install.androidStep2Title')} description={t('install.androidStep2Desc')} />
                <InstallStepCard step={3} icon={Download} title={t('install.androidStep3Title')} description={t('install.androidStep3Desc')} />
                <p className="text-xs text-muted-foreground font-korean mt-4 p-3 bg-muted/50 rounded-lg">{t('install.androidTip')}</p>
              </div>
            )}

            {/* Desktop */}
            {deviceType === 'desktop' && (
              <div className="space-y-3">
                <h2 className="font-korean text-lg font-medium text-foreground mb-4">{t('install.desktopTitle')}</h2>
                <InstallStepCard step={1} icon={Chrome} title={t('install.desktopStep1Title')} description={t('install.desktopStep1Desc')} />
                <InstallStepCard step={2} icon={Download} title={t('install.desktopStep2Title')} description={t('install.desktopStep2Desc')} />
                <InstallStepCard step={3} icon={Monitor} title={t('install.desktopStep3Title')} description={t('install.desktopStep3Desc')} />
                <p className="text-xs text-muted-foreground font-korean mt-4 p-3 bg-muted/50 rounded-lg">{t('install.desktopTip')}</p>
              </div>
            )}
          </div>
        )}

        {/* Benefits */}
        <div className="mt-10 p-6 bg-gradient-to-br from-accent/5 to-purple/5 rounded-2xl border border-accent/20">
          <h2 className="font-korean text-lg font-medium text-foreground mb-4 text-center">
            {t('install.benefits')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-accent/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-accent" />
              </div>
              <p className="font-korean text-sm text-foreground">{t('install.quickLaunch')}</p>
              <p className="font-korean text-xs text-muted-foreground">{t('install.quickLaunchDesc')}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-purple" />
              </div>
              <p className="font-korean text-sm text-foreground">{t('install.offlineSupport')}</p>
              <p className="font-korean text-xs text-muted-foreground">{t('install.offlineSupportDesc')}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-coral/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-coral" />
              </div>
              <p className="font-korean text-sm text-foreground">{t('install.fullScreen')}</p>
              <p className="font-korean text-xs text-muted-foreground">{t('install.fullScreenDesc')}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-sky/10 flex items-center justify-center">
                <Chrome className="w-5 h-5 text-sky" />
              </div>
              <p className="font-korean text-sm text-foreground">{t('install.saveSpace')}</p>
              <p className="font-korean text-xs text-muted-foreground">{t('install.saveSpaceDesc')}</p>
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
            {t('install.goToStyle')}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Install;
