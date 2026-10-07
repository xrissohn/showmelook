import { useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play } from 'lucide-react';
import { LazyImage } from '@/components/LazyImage';

interface PreviewLook { id: string; image_url: string; like_count: number; }
interface Props {
  looks: PreviewLook[];
  likedIds: Set<string>;
  onSelect: (index: number) => void;
  paused?: boolean;
  english?: boolean;
}

export function FlowingGallery({ looks, likedIds, onSelect, paused = false, english = false }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);
  const [nearby, setNearby] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 640px)');
    const update = () => setColumns(media.matches ? 6 : 3);
    update();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    media.addEventListener('change', update);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const preload = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearby(true); preload.disconnect(); }
    }, { rootMargin: '200px' });
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) { preload.observe(root.current); observer.observe(root.current); }
    return () => {
      media.removeEventListener('change', update);
      motion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', visibility);
      preload.disconnect(); observer.disconnect();
    };
  }, []);
  const fewLooks = looks.length < columns * 3;
  const staticLayout = userPaused || reducedMotion || fewLooks;
  const running = visible && pageVisible && !staticLayout && !paused;
  return (
    <div className="mb-8 sm:mb-10">
      <div ref={root} className="flowing-gallery" data-running={running} data-static={staticLayout} role="region" aria-label={english ? 'Recent and popular shared looks' : '최신 룩과 인기 룩 모음'}>
        {nearby && Array.from({ length: columns }, (_, column) => {
          const items = looks.map((look, index) => ({ look, index })).filter(({ index }) => index % columns === column);
          if (!items.length) return null;
          return (
            <div className="flowing-gallery-column" key={column}>
              <div className="flowing-gallery-track" style={{ animationDirection: column % 2 ? 'reverse' : 'normal', animationDelay: `${-column * 15}s`, animationDuration: `${100 + column * 8}s` }}>
                {[0, 1].map(copy => (
                  <div className="flowing-gallery-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                    {items.map(({ look, index }) => (
                      <button key={look.id} type="button" tabIndex={copy || !staticLayout ? -1 : 0} onClick={event => { if (!staticLayout) event.currentTarget.blur(); onSelect(index); }} className="flowing-gallery-card" aria-label={english ? `Open look ${index + 1}, ${look.like_count} likes` : `${index + 1}번째 룩 보기, 좋아요 ${look.like_count}개`}>
                        <LazyImage src={look.image_url} alt="" className="w-full object-contain" naturalAspect width={320} priority />
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-xs text-white">
                          <Heart className={`h-3.5 w-3.5 ${likedIds.has(look.id) ? 'fill-red-500 text-red-500' : ''}`} />{look.like_count}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!reducedMotion && !fewLooks && <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => setUserPaused(value => !value)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-pressed={userPaused}>
          {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {userPaused ? (english ? 'Play motion' : '움직임 재생') : (english ? 'Pause motion' : '움직임 멈추기')}
        </button>
      </div>}
    </div>
  );
}
