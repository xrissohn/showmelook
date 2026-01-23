import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';

interface GenerationProgressProps {
  isVisible: boolean;
  progress: number;
  status: string;
  onCancel: () => void;
}

const statusMessages: Record<string, { label: string; emoji: string }> = {
  queued: { label: '대기 중...', emoji: '⏳' },
  processing: { label: '처리 시작...', emoji: '🔄' },
  generating_style: { label: '스타일 분석 중...', emoji: '🎨' },
  generating_image: { label: '이미지 생성 중...', emoji: '✨' },
  completed: { label: '완료!', emoji: '🎉' },
  failed: { label: '실패', emoji: '❌' },
};

export const GenerationProgress = ({ 
  isVisible, 
  progress, 
  status, 
  onCancel 
}: GenerationProgressProps) => {
  if (!isVisible) return null;

  const statusInfo = statusMessages[status] || { label: '처리 중...', emoji: '⏳' };
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-border relative">
        {/* 취소 버튼 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors"
          aria-label="취소"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* 원형 프로그레스 + 로고 */}
        <div className="relative w-28 h-28 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* 배경 원 */}
            <circle 
              cx="50" 
              cy="50" 
              r="42" 
              fill="none" 
              stroke="hsl(var(--secondary))" 
              strokeWidth="6" 
            />
            {/* 프로그레스 원 (그라데이션) */}
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <circle 
              cx="50" 
              cy="50" 
              r="42" 
              fill="none" 
              stroke="url(#progressGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          {/* 중앙 로고 */}
          <div className="absolute inset-4 flex items-center justify-center">
            <img 
              src={showmelookLogo} 
              alt="ShowMeLook" 
              className="w-14 h-14 object-contain animate-pulse"
            />
          </div>
        </div>

        {/* 진행률 텍스트 */}
        <div className="text-center space-y-2">
          <p className="text-4xl font-bold text-foreground">
            {progress}%
          </p>
          <p className="text-base text-muted-foreground font-korean flex items-center justify-center gap-2">
            <span>{statusInfo.emoji}</span>
            <span>{statusInfo.label}</span>
          </p>
        </div>

        {/* 안내 메시지 */}
        <div className="mt-6 p-3 bg-secondary/50 rounded-xl">
          <p className="text-xs text-muted-foreground text-center font-korean">
            AI가 당신만을 위한 스타일을 만들고 있어요.<br />
            잠시만 기다려주세요 ✨
          </p>
        </div>

        {/* 취소 버튼 */}
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          className="mt-6 w-full font-korean text-muted-foreground hover:text-foreground"
        >
          취소하기
        </Button>
      </div>
    </div>
  );
};

export default GenerationProgress;
