import { Button } from '@/components/ui/button';
import { X, Users, Clock } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface QueueStatus {
  totalQueued: number;
  totalProcessing: number;
  userPosition: number | null;
  estimatedWaitMinutes: number | null;
  recentThroughput: number;
}

interface GenerationProgressProps {
  isVisible: boolean;
  progress: number;
  status: string;
  queueStatus?: QueueStatus | null;
  onCancel: () => void;
}

const getStatusMessages = (t: (key: string) => string): Record<string, { label: string; emoji: string }> => ({
  queued: { label: t('generationProgress.queued'), emoji: '⏳' },
  processing: { label: t('generationProgress.processing'), emoji: '🔄' },
  generating_style: { label: t('generationProgress.generatingStyle'), emoji: '🎨' },
  generating_image: { label: t('generationProgress.generatingImage'), emoji: '✨' },
  completed: { label: t('generationProgress.completed'), emoji: '🎉' },
  failed: { label: t('generationProgress.failed'), emoji: '❌' },
});

// Pre-calculated particle positions for consistent rendering
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  size: 3 + (i % 4) * 2,
  left: (i * 8.3) % 100,
  delay: i * 0.3,
  duration: 3 + (i % 3),
  drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 5),
  color: i % 3,
}));

const ORBIT_DOTS = [
  { id: 0, radius: 55, duration: 4, delay: 0 },
  { id: 1, radius: 62, duration: 5, delay: 0.5 },
  { id: 2, radius: 70, duration: 6, delay: 1 },
];

export const GenerationProgress = ({ 
  isVisible, 
  progress, 
  status,
  queueStatus,
  onCancel 
}: GenerationProgressProps) => {
  const { t } = useLanguage();
  if (!isVisible) return null;

  const statusMessages = getStatusMessages(t);
  const statusInfo = statusMessages[status] || { label: t('generationProgress.defaultStatus'), emoji: '⏳' };
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference * (1 - progress / 100);

  // Queue position info
  const isQueued = status === 'queued';
  const position = queueStatus?.userPosition;
  const waitMinutes = queueStatus?.estimatedWaitMinutes;
  const aheadCount = position && position > 1 ? position - 1 : 0;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-border relative overflow-hidden max-h-[90%] overflow-y-auto">
        
        {/* Background floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full animate-float-particle"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.left}%`,
                bottom: 0,
                background: p.color === 0 
                  ? 'hsl(var(--accent))' 
                  : p.color === 1 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--magenta))',
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                '--drift': `${p.drift}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* 취소 버튼 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors z-10"
          aria-label={t('generationProgress.cancel')}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* 원형 프로그레스 + 로고 */}
        <div className="relative w-36 h-36 mx-auto mb-6">
          
          {/* Expanding ring effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full rounded-full border-2 border-accent/30 animate-ring-expand" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ animationDelay: '1s' }}>
            <div className="w-full h-full rounded-full border border-primary/20 animate-ring-expand" style={{ animationDelay: '1s' }} />
          </div>
          
          {/* Outer spinning dashed ring */}
          <div className="absolute -inset-4 flex items-center justify-center">
            <div className="w-44 h-44 rounded-full border-2 border-dashed border-accent/40 animate-spin-slow" />
          </div>
          
          {/* Rotating gradient ring */}
          <div className="absolute -inset-2 flex items-center justify-center">
            <div 
              className="w-40 h-40 rounded-full animate-spin-reverse opacity-60"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, hsl(var(--accent)) 15%, transparent 30%, hsl(var(--primary)) 50%, transparent 65%, hsl(var(--magenta)) 85%, transparent 100%)',
                filter: 'blur(2px)',
              }}
            />
          </div>
          
          {/* Inner glow pulse */}
          <div className="absolute inset-2 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-accent/30 via-primary/20 to-magenta/30 animate-pulse-glow" />
          </div>

          {/* SVG Progress circle */}
          <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
            {/* 배경 원 */}
            <circle 
              cx="50" 
              cy="50" 
              r="42" 
              fill="none" 
              stroke="hsl(var(--secondary))" 
              strokeWidth="4" 
              opacity="0.5"
            />
            {/* 프로그레스 원 (그라데이션) */}
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--accent))" />
                <stop offset="50%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--magenta))" />
              </linearGradient>
            </defs>
            <circle 
              cx="50" 
              cy="50" 
              r="42" 
              fill="none" 
              stroke="url(#progressGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
              style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary)))' }}
            />
          </svg>

          {/* 중앙 로고 컨테이너 - 투명 배경 유지 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center">
              {/* 배경 원 */}
              <div className="absolute inset-0 rounded-full bg-background shadow-2xl border-2 border-accent/30" />
              {/* 회전하는 글로우 링 (로고 뒤) */}
              <div 
                className="absolute inset-[-4px] rounded-full opacity-50"
                style={{
                  background: 'conic-gradient(from 0deg, hsl(var(--accent)), hsl(var(--primary)), hsl(var(--magenta)), hsl(var(--accent)))',
                  filter: 'blur(6px)',
                  animation: 'spin 8s linear infinite',
                }}
              />
              {/* Logo with glow - 투명 배경 유지 */}
              <img 
                src={showmelookLogo} 
                alt="ShowMeLook" 
                width={48}
                height={48}
                className="w-12 h-12 object-contain relative z-10"
                style={{
                  animation: 'logo-glow 3s ease-in-out infinite',
                }}
              />
            </div>
          </div>
          
          {/* Orbiting dots */}
          {ORBIT_DOTS.map((dot) => (
            <div
              key={dot.id}
              className="absolute inset-0 flex items-center justify-center"
              style={{ 
                animation: `orbit ${dot.duration}s linear infinite`,
                animationDelay: `${dot.delay}s`,
                '--orbit-radius': `${dot.radius}px`,
              } as React.CSSProperties}
            >
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ 
                  background: dot.id === 0 
                    ? 'hsl(var(--accent))' 
                    : dot.id === 1 
                      ? 'hsl(var(--primary))' 
                      : 'hsl(var(--magenta))',
                  boxShadow: `0 0 12px ${dot.id === 0 ? 'hsl(var(--accent))' : dot.id === 1 ? 'hsl(var(--primary))' : 'hsl(var(--magenta))'}`,
                }}
              />
            </div>
          ))}
        </div>

        {/* 진행률 텍스트 */}
        <div className="text-center space-y-2 relative z-10">
          <p className="text-4xl font-bold text-foreground">
            {progress}%
          </p>
          <p className="text-base text-muted-foreground font-korean flex items-center justify-center gap-2">
            <span>{statusInfo.emoji}</span>
            <span>{statusInfo.label}</span>
            {/* Bouncing dots */}
            <span className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce-dot"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </p>
        </div>

        {/* 대기 상태 정보 (Phase 3) */}
        {isQueued && queueStatus && (
          <div className="mt-4 space-y-2 relative z-10">
            {/* 앞에 대기 중인 인원 */}
            {aheadCount > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="font-korean">
                  {t('generationProgress.waitingAhead')} <span className="text-foreground font-semibold">{aheadCount}</span>{t('generationProgress.people')}
                </span>
              </div>
            )}
            
            {/* 예상 대기 시간 */}
            {waitMinutes !== null && waitMinutes > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-korean">
                  {t('generationProgress.estimatedWait')} <span className="text-foreground font-semibold">{waitMinutes}</span>{t('generationProgress.minutes')}
                </span>
              </div>
            )}

            {/* 처리 중인 경우 (position === 0) */}
            {position === 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <span className="font-korean font-semibold">{t('generationProgress.startingSoon')}</span>
              </div>
            )}
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="mt-6 p-3 bg-secondary/50 rounded-xl relative z-10">
          <p className="text-xs text-muted-foreground text-center font-korean whitespace-pre-line">
            {isQueued && aheadCount > 0
              ? t('generationProgress.busyMessage')
              : t('generationProgress.creatingMessage')}
          </p>
        </div>

        {/* 취소 버튼 */}
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          className="mt-6 w-full font-korean text-muted-foreground hover:text-foreground relative z-10"
        >
          {t('generationProgress.cancelBtn')}
        </Button>
      </div>
    </div>
  );
};

export default GenerationProgress;
