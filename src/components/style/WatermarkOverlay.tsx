/**
 * WatermarkOverlay - 무료 플랜 사용자에게 보이는 워터마크 오버레이
 * 이미지 위에 투명 레이어로 표시되며, 다운로드 시에는 캔버스로 워터마크 적용
 */

import showmelookWatermark from '@/assets/showmelook-watermark-logo.png';

interface WatermarkOverlayProps {
  show: boolean;
  size?: 'small' | 'medium' | 'large';
  position?: 'bottom-right' | 'bottom-left' | 'center';
  opacity?: number;
}

export function WatermarkOverlay({ 
  show, 
  size = 'medium',
  position = 'bottom-right',
  opacity = 0.7 
}: WatermarkOverlayProps) {
  if (!show) return null;

  const sizeClasses = {
    small: 'w-8 h-auto',
    medium: 'w-12 h-auto',
    large: 'w-16 h-auto',
  };

  const positionClasses = {
    'bottom-right': 'bottom-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  return (
    <div 
      className={`absolute ${positionClasses[position]} z-10 pointer-events-none select-none`}
      style={{ opacity }}
    >
      <img 
        src={showmelookWatermark} 
        alt="ShowMeLook" 
        className={`${sizeClasses[size]} drop-shadow-lg`}
        draggable={false}
      />
    </div>
  );
}

// 갤러리 카드용 작은 워터마크
export function GalleryWatermarkOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div 
      className="absolute bottom-2 right-2 z-10 pointer-events-none select-none"
      style={{ opacity: 0.6 }}
    >
      <img 
        src={showmelookWatermark} 
        alt="ShowMeLook" 
        className="w-6 h-auto drop-shadow-md"
        draggable={false}
      />
    </div>
  );
}

// 모달/상세보기용 워터마크
export function ModalWatermarkOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div 
      className="absolute bottom-3 right-3 z-20 pointer-events-none select-none"
      style={{ opacity: 0.7 }}
    >
      <img 
        src={showmelookWatermark} 
        alt="ShowMeLook" 
        className="w-10 h-auto drop-shadow-lg"
        draggable={false}
      />
    </div>
  );
}
